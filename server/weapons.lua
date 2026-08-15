-- ══════════════════════════════════════════════════════════════════════════════
--  Weapons (Waffen-Register)
-- ══════════════════════════════════════════════════════════════════════════════

lib.callback.register('hm_police:mdtSearchWeapon', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_weapons
        WHERE serial_number LIKE ? OR owner_name LIKE ? OR owner_cid LIKE ? OR weapon_type LIKE ?
        ORDER BY id DESC LIMIT 20
    ]], { '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%' })

    return { results = results or {} }
end)

lib.callback.register('hm_police:mdtAddWeapon', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.serial_number or data.serial_number == '' then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_weapons (serial_number, owner_cid, owner_name, weapon_type, status, flags, notes, officer, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.serial_number,
        data.owner_cid or '',
        data.owner_name or '',
        data.weapon_type or '',
        data.status or 'registered',
        data.flags or '',
        SanitizeText(data.notes, 5000),
        officerName,
        os.time(),
    })

    MDTAuditLog(source, 'weapon', data.serial_number or '', 'create', data.weapon_type or '')
    return true
end)

lib.callback.register('hm_police:mdtUpdateWeapon', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_mdt_weapons
        SET serial_number = ?, owner_cid = ?, owner_name = ?, weapon_type = ?, status = ?, flags = ?, notes = ?, edit_log = ?
        WHERE id = ?
    ]], {
        data.serial_number or '',
        data.owner_cid or '',
        data.owner_name or '',
        data.weapon_type or '',
        data.status or 'registered',
        data.flags or '',
        SanitizeText(data.notes, 5000),
        editLog,
        data.id,
    })

    MDTAuditLog(source, 'weapon', data.serial_number or tostring(data.id), 'update', '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteWeapon', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'weapon', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_weapons WHERE id = ?', { id })
    return true
end)
