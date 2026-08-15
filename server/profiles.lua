-- hm_mdt | server/profiles.lua
-- Personen-Akten, Vorstrafen (CreateEditLog lebt jetzt in core/utils.lua)
---@diagnostic disable: undefined-global

-- ── Personen-Suche (Name oder CitizenID) ─────────────────────────────────────

lib.callback.register('hm_police:mdtSearchPerson', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    -- Suche in MDT-Profilen
    local results = MySQL.query.await([[
        SELECT citizenid, name, firstname, lastname, dob, phone, license_status, wanted_level, image_url, status
        FROM hm_mdt_profiles
        WHERE citizenid LIKE ? OR name LIKE ? OR firstname LIKE ? OR lastname LIKE ?
        ORDER BY name ASC
        LIMIT 20
    ]], { '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%' })

    results = results or {}

    -- Zusätzlich in der players-Tabelle suchen (Framework)
    local knownCids = {}
    for _, r in ipairs(results) do
        knownCids[r.citizenid] = true
    end

    local ok, players = pcall(MySQL.query.await, [[
        SELECT citizenid, charinfo FROM players
        WHERE citizenid LIKE ? OR charinfo LIKE ?
        LIMIT 20
    ]], { '%' .. query .. '%', '%' .. query .. '%' })

    if ok and players then
        for _, p in ipairs(players) do
            if not knownCids[p.citizenid] then
                local name = p.citizenid
                local dob = ''
                if p.charinfo then
                    local okDec, info = pcall(json.decode, p.charinfo)
                    if okDec and info then
                        local fn = info.firstname or ''
                        local ln = info.lastname or ''
                        name = (fn .. ' ' .. ln):gsub('^%s+', ''):gsub('%s+$', '')
                        if name == '' then name = p.citizenid end
                        dob = info.birthdate or ''
                    end
                end
                results[#results + 1] = {
                    citizenid      = p.citizenid,
                    name           = name,
                    dob            = dob,
                    phone          = '',
                    license_status = 'valid',
                    wanted_level   = 0,
                    image_url      = '',
                    status         = 'neutral',
                }
                knownCids[p.citizenid] = true
            end
        end
    end

    return { results = results }
end)

-- ── Profil laden (vollständig mit allen Sub-Tabs) ────────────────────────────

lib.callback.register('hm_police:mdtGetProfile', function(source, citizenid)
    if not HasMDTAccess(source) then return nil end
    if not citizenid or citizenid == '' then return nil end

    -- Profil holen oder automatisch aus Framework erstellen
    local profile = MySQL.single.await([[
        SELECT * FROM hm_mdt_profiles WHERE citizenid = ?
    ]], { citizenid })

    if not profile then
        -- Auto-Create aus Framework-Daten
        local playerSrc = exports['hm_lib']:GetPlayerSource(citizenid)
        local name, firstName, lastName, jobLabel = '', '', '', ''
        if playerSrc then
            name = exports['hm_lib']:GetPlayerName(playerSrc)
            local parts = {}
            for word in name:gmatch('%S+') do parts[#parts+1] = word end
            firstName = parts[1] or ''
            lastName = table.concat(parts, ' ', 2) or ''
            local jobData = exports['hm_lib']:GetPlayerJob(playerSrc)
            jobLabel = jobData and jobData.label or ''
        end
        local now = os.time()
        MySQL.insert.await([[
            INSERT INTO hm_mdt_profiles (citizenid, name, firstname, lastname, job, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], { citizenid, name, firstName, lastName, jobLabel, now, now })
        profile = MySQL.single.await('SELECT * FROM hm_mdt_profiles WHERE citizenid = ?', { citizenid })
    end

    local pName = profile and profile.name or ''
    local results = AwaitParallel({
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_records WHERE citizenid = ? ORDER BY timestamp DESC LIMIT 50', params = { citizenid } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_vehicles WHERE citizenid = ? ORDER BY plate ASC', params = { citizenid } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_properties WHERE owner_cid = ? ORDER BY id DESC', params = { citizenid } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_licenses WHERE citizenid = ? ORDER BY id DESC', params = { citizenid } },
        { fn = MySQL.query, sql = "SELECT * FROM hm_warrants WHERE subject LIKE ? AND status = 'active' ORDER BY id DESC", params = { '%' .. pName .. '%' } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_notes WHERE citizenid = ? ORDER BY created_at DESC LIMIT 30', params = { citizenid } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_reports WHERE citizenids LIKE ? ORDER BY updated_at DESC LIMIT 20', params = { '%' .. citizenid .. '%' } },
        { fn = MySQL.query, sql = 'SELECT * FROM hm_mdt_judgments WHERE citizenid = ? ORDER BY created_at DESC LIMIT 20', params = { citizenid } },
    })

    local records    = results[1] or {}
    local vehicles   = results[2] or {}
    local properties = results[3] or {}
    local licenses   = results[4] or {}
    local warrants   = results[5] or {}
    local notes      = results[6] or {}
    local reports    = results[7] or {}
    local judgments  = results[8] or {}

    -- Game-Fahrzeuge die noch nicht im MDT sind
    local existingPlates = {}
    for _, v in ipairs(vehicles) do
        existingPlates[(v.plate or ''):upper()] = true
    end

    local okGV, gameVehicles = pcall(MySQL.query.await, [[
        SELECT plate, vehicle FROM player_vehicles WHERE citizenid = ?
    ]], { citizenid })
    if not okGV then
        okGV, gameVehicles = pcall(MySQL.query.await, [[
            SELECT plate, vehicle FROM owned_vehicles WHERE owner = ?
        ]], { citizenid })
    end
    if okGV and gameVehicles then
        for _, gv in ipairs(gameVehicles) do
            local gPlate = (gv.plate or ''):upper():gsub('%s+', '')
            if not existingPlates[gPlate] and gPlate ~= '' then
                local model = ''
                if gv.vehicle then
                    local okV, vData = pcall(json.decode, gv.vehicle)
                    if okV and vData and vData.model then model = tostring(vData.model) end
                end
                table.insert(vehicles, {
                    plate     = gPlate,
                    model     = model,
                    citizenid = citizenid,
                    status    = 'clean',
                    stolen    = 0,
                    _from_game = true,
                })
            end
        end
    end

    return {
        profile    = profile,
        records    = records or {},
        vehicles   = vehicles or {},
        properties = properties or {},
        licenses   = licenses or {},
        warrants   = warrants or {},
        notes      = notes or {},
        reports    = reports or {},
        judgments  = judgments or {},
    }
end)

-- ── Profil aktualisieren ──────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtUpdateProfile', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.citizenid then return false end

    local fn = data.firstname or ''
    local ln = data.lastname or ''
    local fullName = (fn .. ' ' .. ln):gsub('^%s+', ''):gsub('%s+$', '')

    MySQL.update.await([[
        UPDATE hm_mdt_profiles
        SET name = ?, firstname = ?, lastname = ?, dob = ?, gender = ?, nationality = ?,
            job = ?, status = ?, notes = ?, license_status = ?, wanted_level = ?,
            image_url = ?, updated_at = ?
        WHERE citizenid = ?
    ]], {
        fullName,
        fn,
        ln,
        data.dob or '',
        data.gender or 'male',
        data.nationality or '',
        data.job or '',
        data.status or 'neutral',
        SanitizeText(data.notes, 5000),
        data.license_status or 'valid',
        tonumber(data.wanted_level) or 0,
        SanitizeImageUrl(data.image_url),
        os.time(),
        data.citizenid,
    })

    MDTAuditLog(source, 'profile', data.citizenid, 'update', fullName)

    return true
end)

-- ── Notes CRUD ───────────────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddNote', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.citizenid or not data.title then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_notes (citizenid, title, content, tag, expire_at, officer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.citizenid,
        SanitizeText(data.title, 200),
        SanitizeText(data.content, 5000),
        data.tag or '',
        data.expire_at or '',
        officerName,
        os.time(),
    })

    MDTAuditLog(source, 'note', data.citizenid, 'create', data.title)
    return true
end)

lib.callback.register('hm_police:mdtDeleteNote', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'note', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_notes WHERE id = ?', { id })
    return true
end)

