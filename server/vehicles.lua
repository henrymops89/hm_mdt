-- ── Fahrzeug-Suche (Kennzeichen) ─────────────────────────────────────────────

lib.callback.register('hm_police:mdtSearchVehicle', function(source, plate)
    if not HasMDTAccess(source) then return { results = {} } end
    if not plate or type(plate) ~= 'string' or #plate < 2 then return { results = {} } end

    -- 1. Suche in MDT-Datenbank
    local results = MySQL.query.await([[
        SELECT v.*, p.name AS owner_name
        FROM hm_mdt_vehicles v
        LEFT JOIN hm_mdt_profiles p ON p.citizenid = v.citizenid
        WHERE v.plate LIKE ?
        ORDER BY v.plate ASC
        LIMIT 20
    ]], { '%' .. plate .. '%' }) or {}

    -- 2. Zusaetzlich Game-Daten durchsuchen (player_vehicles / owned_vehicles)
    local existingPlates = {}
    for _, v in ipairs(results) do
        existingPlates[v.plate:upper()] = true
    end

    local ok, gameVehicles = pcall(MySQL.query.await, [[
        SELECT pv.plate, pv.vehicle, pv.citizenid, p.charinfo
        FROM player_vehicles pv
        LEFT JOIN players p ON p.citizenid = pv.citizenid
        WHERE pv.plate LIKE ?
        LIMIT 20
    ]], { '%' .. plate .. '%' })

    if not ok then
        -- Fallback: ESX owned_vehicles
        ok, gameVehicles = pcall(MySQL.query.await, [[
            SELECT ov.plate, ov.vehicle, ov.owner AS citizenid
            FROM owned_vehicles ov
            WHERE ov.plate LIKE ?
            LIMIT 20
        ]], { '%' .. plate .. '%' })
    end

    if ok and gameVehicles then
        for _, gv in ipairs(gameVehicles) do
            local gamePlate = (gv.plate or ''):upper():gsub('%s+', '')
            if not existingPlates[gamePlate] and gamePlate ~= '' then
                local ownerName = ''
                if gv.charinfo then
                    local okDec, info = pcall(json.decode, gv.charinfo)
                    if okDec and info then
                        ownerName = (info.firstname or '') .. ' ' .. (info.lastname or '')
                    end
                end

                -- Modell aus vehicle JSON extrahieren
                local model = ''
                if gv.vehicle then
                    local okV, vData = pcall(json.decode, gv.vehicle)
                    if okV and vData and vData.model then
                        model = tostring(vData.model)
                    end
                end

                table.insert(results, {
                    plate      = gamePlate,
                    model      = model,
                    citizenid  = gv.citizenid or '',
                    owner_name = ownerName,
                    color      = '',
                    status     = 'clean',
                    stolen     = 0,
                    flags      = '',
                    notes      = '',
                    _from_game = true, -- Flag fuer Frontend
                })
                existingPlates[gamePlate] = true
            end
        end
    end

    -- BOLO-Alert: Pruefen ob ein gesuchtes Kennzeichen dabei ist
    local boloAlerts = {}
    local activeBolos = MySQL.query.await([[
        SELECT * FROM hm_bolos WHERE plate LIKE ? AND (status = 'active' OR status IS NULL)
        AND (expire_at IS NULL OR expire_at > NOW())
    ]], { '%' .. plate .. '%' }) or {}
    for _, bolo in ipairs(activeBolos) do
        table.insert(boloAlerts, {
            id    = bolo.id,
            title = bolo.title,
            plate = bolo.plate,
            description = bolo.description,
            image_url   = bolo.image_url,
        })
    end

    return { results = results, boloAlerts = boloAlerts }
end)

-- ── Fahrzeug bearbeiten (erweitert) ──────────────────────────────────────────

lib.callback.register('hm_police:mdtUpdateVehicle', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.plate then return false end

    local existing = MySQL.single.await('SELECT plate FROM hm_mdt_vehicles WHERE plate = ?', { data.plate })
    
    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    if existing then
        MySQL.update.await([[
            UPDATE hm_mdt_vehicles
            SET citizenid = ?, model = ?, color = ?, vehicle_class = ?, status = ?,
                stolen = ?, flags = ?, notes = ?, image_url = ?, edit_log = ?
            WHERE plate = ?
        ]], {
            data.citizenid or '', data.model or '', data.color or '',
            data.vehicle_class or '', data.status or 'clean',
            data.stolen and 1 or 0, data.flags or '', SanitizeText(data.notes, 5000),
            SanitizeImageUrl(data.image_url), editLog, data.plate
        })
    else
        MySQL.insert.await([[
            INSERT INTO hm_mdt_vehicles (plate, citizenid, model, color, vehicle_class, status, stolen, flags, notes, image_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            data.plate, data.citizenid or '', data.model or '', data.color or '',
            data.vehicle_class or '', data.status or 'clean',
            data.stolen and 1 or 0, data.flags or '', SanitizeText(data.notes, 5000),
            SanitizeImageUrl(data.image_url), os.time()
        })
    end

    MDTAuditLog(source, 'vehicle', data.plate, 'update', 'Status: ' .. (data.status or ''))

    return true
end)

-- ── Fahrzeug-Profil laden ────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtGetVehicleProfile', function(source, plate)
    if not HasMDTAccess(source) then return nil end
    if not plate or plate == '' then return nil end

    local vehicle = MySQL.single.await([[
        SELECT v.*, p.name AS owner_name, p.image_url AS owner_image_url
        FROM hm_mdt_vehicles v
        LEFT JOIN hm_mdt_profiles p ON p.citizenid = v.citizenid
        WHERE v.plate = ?
    ]], { plate })

    if not vehicle then
        -- Auto-create: versuche Game-Daten zu holen
        local gameModel, gameCid, gameOwner = '', '', ''

        local ok, gv = pcall(MySQL.single.await, [[
            SELECT pv.plate, pv.vehicle, pv.citizenid, p.charinfo
            FROM player_vehicles pv
            LEFT JOIN players p ON p.citizenid = pv.citizenid
            WHERE pv.plate = ?
        ]], { plate })

        if not ok then
            ok, gv = pcall(MySQL.single.await, [[
                SELECT ov.plate, ov.vehicle, ov.owner AS citizenid
                FROM owned_vehicles ov WHERE ov.plate = ?
            ]], { plate })
        end

        if ok and gv then
            gameCid = gv.citizenid or ''
            if gv.vehicle then
                local okV, vData = pcall(json.decode, gv.vehicle)
                if okV and vData and vData.model then
                    gameModel = tostring(vData.model)
                end
            end
            if gv.charinfo then
                local okD, info = pcall(json.decode, gv.charinfo)
                if okD and info then
                    gameOwner = (info.firstname or '') .. ' ' .. (info.lastname or '')
                end
            end
        end

        MySQL.insert.await([[
            INSERT INTO hm_mdt_vehicles (plate, citizenid, model, status, created_at)
            VALUES (?, ?, ?, 'clean', ?)
        ]], { plate, gameCid, gameModel, os.time() })

        -- Ensure profile exists for owner
        if gameCid ~= '' then
            local existingProfile = MySQL.single.await('SELECT citizenid FROM hm_mdt_profiles WHERE citizenid = ?', { gameCid })
            if not existingProfile then
                MySQL.insert.await([[
                    INSERT INTO hm_mdt_profiles (citizenid, name, firstname, lastname) VALUES (?, ?, ?, ?)
                ]], { gameCid, gameOwner, gameOwner:match('^(%S+)') or '', gameOwner:match('%s(.+)$') or '' })
            end
        end

        vehicle = MySQL.single.await([[
            SELECT v.*, p.name AS owner_name
            FROM hm_mdt_vehicles v
            LEFT JOIN hm_mdt_profiles p ON p.citizenid = v.citizenid
            WHERE v.plate = ?
        ]], { plate })
    end

    -- Halter-Records (falls citizenid vorhanden)
    local ownerRecords = {}
    if vehicle and vehicle.citizenid and vehicle.citizenid ~= '' then
        ownerRecords = MySQL.query.await([[
            SELECT * FROM hm_mdt_records WHERE citizenid = ? ORDER BY timestamp DESC LIMIT 10
        ]], { vehicle.citizenid }) or {}
    end

    -- Beweise, die das Kennzeichen oder die Beschreibung betreffen
    local evidences = MySQL.query.await([[
        SELECT * FROM hm_mdt_evidences
        WHERE description LIKE ? OR title LIKE ? OR location LIKE ?
        ORDER BY id DESC LIMIT 10
    ]], { '%' .. plate .. '%', '%' .. plate .. '%', '%' .. plate .. '%' }) or {}

    -- Fahrzeug-Notizen
    local notes = MySQL.query.await([[
        SELECT * FROM hm_mdt_vehicle_notes WHERE plate = ? ORDER BY created_at DESC LIMIT 30
    ]], { plate }) or {}

    return {
        vehicle      = vehicle,
        ownerRecords = ownerRecords,
        evidences    = evidences,
        notes        = notes,
    }
end)

-- ── Fahrzeug-Notizen CRUD ────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddVehicleNote', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.plate or not data.title then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_vehicle_notes (plate, title, content, tag, expire_at, officer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.plate, SanitizeText(data.title, 200), SanitizeText(data.content, 5000),
        data.tag or '', data.expire_at or '', officerName, os.time(),
    })

    MDTAuditLog(source, 'vehicle_note', data.plate, 'create', data.title)
    return true
end)

lib.callback.register('hm_police:mdtDeleteVehicleNote', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'vehicle_note', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_vehicle_notes WHERE id = ?', { id })
    return true
end)

-- ── Schnell-Lookup für Verkehrskontrolle (ID eingeben → Profil + Fahrzeuge) ──

lib.callback.register('hm_police:mdtQuickLookup', function(source, targetSrc)
    if not HasMDTAccess(source) then return nil end
    if not targetSrc then return nil end

    local targetCid = exports['hm_lib']:GetIdentifier(targetSrc)
    if not targetCid then return nil end

    local name = exports['hm_lib']:GetPlayerName(targetSrc)

    -- Auto-create Profil falls nötig
    local profile = MySQL.single.await('SELECT * FROM hm_mdt_profiles WHERE citizenid = ?', { targetCid })
    if not profile then
        local now = os.time()
        MySQL.insert.await([[
            INSERT INTO hm_mdt_profiles (citizenid, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        ]], { targetCid, name, now, now })
        profile = MySQL.single.await('SELECT * FROM hm_mdt_profiles WHERE citizenid = ?', { targetCid })
    end

    local recordCount = MySQL.single.await(
        'SELECT COUNT(*) AS cnt FROM hm_mdt_records WHERE citizenid = ?', { targetCid }
    )

    return {
        citizenid      = targetCid,
        name           = name,
        license_status = profile and profile.license_status or 'valid',
        wanted_level   = profile and profile.wanted_level or 0,
        record_count   = recordCount and recordCount.cnt or 0,
    }
end)

