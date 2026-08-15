-- ══════════════════════════════════════════════════════════════════════════════
--  Properties (Immobilien)
-- ══════════════════════════════════════════════════════════════════════════════

lib.callback.register('hm_police:mdtSearchProperty', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_properties
        WHERE address LIKE ? OR owner_name LIKE ? OR owner_cid LIKE ?
        ORDER BY id DESC LIMIT 20
    ]], { '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%' })

    return { results = results or {} }
end)

lib.callback.register('hm_police:mdtAddProperty', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.address or data.address == '' then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    local id = MySQL.insert.await([[
        INSERT INTO hm_mdt_properties (address, owner_cid, owner_name, type, status, flags, notes, officer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        SanitizeText(data.address, 200),
        data.owner_cid or '',
        data.owner_name or '',
        data.type or 'house',
        data.status or 'clear',
        data.flags or '',
        SanitizeText(data.notes, 5000),
        officerName,
        os.time(),
    })

    MDTAuditLog(source, 'property', tostring(id or 0), 'create', data.address or '')
    return true
end)

lib.callback.register('hm_police:mdtUpdateProperty', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_mdt_properties
        SET address = ?, owner_cid = ?, owner_name = ?, type = ?, status = ?, flags = ?, notes = ?, image_url = ?, edit_log = ?
        WHERE id = ?
    ]], {
        SanitizeText(data.address, 200),
        data.owner_cid or '',
        data.owner_name or '',
        data.type or 'house',
        data.status or 'clear',
        data.flags or '',
        SanitizeText(data.notes, 5000),
        SanitizeImageUrl(data.image_url),
        editLog,
        data.id,
    })

    MDTAuditLog(source, 'property', tostring(data.id), 'update', data.address or '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteProperty', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'property', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_properties WHERE id = ?', { id })
    return true
end)

-- ── Immobilien-Profil laden ──────────────────────────────────────────────────

lib.callback.register('hm_police:mdtGetPropertyProfile', function(source, id)
    if not HasMDTAccess(source) then return nil end
    if not id then return nil end

    local property = MySQL.single.await('SELECT * FROM hm_mdt_properties WHERE id = ?', { id })
    if not property then return nil end

    -- Eigentümer-Records (falls owner_cid vorhanden)
    local ownerRecords = {}
    if property.owner_cid and property.owner_cid ~= '' then
        ownerRecords = MySQL.query.await([[
            SELECT * FROM hm_mdt_records WHERE citizenid = ? ORDER BY timestamp DESC LIMIT 10
        ]], { property.owner_cid }) or {}
    end

    -- Beweise, die die Adresse betreffen
    local evidences = MySQL.query.await([[
        SELECT * FROM hm_mdt_evidences
        WHERE description LIKE ? OR title LIKE ? OR location LIKE ?
        ORDER BY id DESC LIMIT 10
    ]], { '%' .. property.address .. '%', '%' .. property.address .. '%', '%' .. property.address .. '%' }) or {}

    -- Immobilien-Notizen
    local notes = MySQL.query.await([[
        SELECT * FROM hm_mdt_property_notes WHERE property_id = ? ORDER BY created_at DESC LIMIT 30
    ]], { id }) or {}

    return {
        property     = property,
        ownerRecords = ownerRecords,
        evidences    = evidences,
        notes        = notes,
    }
end)

-- ── Immobilien-Notizen CRUD ──────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddPropertyNote', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.property_id or not data.title then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_property_notes (property_id, title, content, tag, expire_at, officer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.property_id, SanitizeText(data.title, 200), SanitizeText(data.content, 5000),
        data.tag or '', data.expire_at or '', officerName, os.time(),
    })

    MDTAuditLog(source, 'property_note', tostring(data.property_id), 'create', data.title)
    return true
end)

lib.callback.register('hm_police:mdtDeletePropertyNote', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'property_note', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_property_notes WHERE id = ?', { id })
    return true
end)
