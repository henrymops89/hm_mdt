-- ── Warrants (Haftbefehle) ─────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddWarrant', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.subject then return false end
    
    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)
    local officer = GetOfficerDeptRow(cid)
    local dept = officer and (officer.qbx_job ~= '' and officer.qbx_job or officer.name) or 'police'
    local dateStr = FormatDate()

    MySQL.insert.await([[
        INSERT INTO hm_warrants (dept, subject, charges, issued_by, issued_date, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], { dept, SanitizeText(data.subject, 100), SanitizeText(data.charges, 5000), officerName, dateStr, data.priority or 'medium', data.status or 'active' })

    MDTAuditLog(source, 'warrant', data.subject, 'create', data.charges or '')
    return true
end)

lib.callback.register('hm_police:mdtUpdateWarrant', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end
    
    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_warrants
        SET subject = ?, charges = ?, priority = ?, status = ?, edit_log = ?
        WHERE id = ?
    ]], { SanitizeText(data.subject, 100), SanitizeText(data.charges, 5000), data.priority or 'medium', data.status or 'active', editLog, data.id })

    MDTAuditLog(source, 'warrant', tostring(data.id), 'update', data.subject or '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteWarrant', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'warrant', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_warrants WHERE id = ?', { id })
    return true
end)

-- ── BOLOs (Fahndungen) ───────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddBolo', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.title then return false end
    
    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)
    local officer = GetOfficerDeptRow(cid)
    local dept = officer and (officer.qbx_job ~= '' and officer.qbx_job or officer.name) or 'police'
    local dateStr = FormatDate()

    MySQL.insert.await([[
        INSERT INTO hm_bolos (dept, type, title, plate, description, image_url, expire_at, status, issued_by, issued_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ]], { dept, data.type or 'vehicle', SanitizeText(data.title, 100), data.plate or '', SanitizeText(data.description, 5000),
          SanitizeImageUrl(data.image_url), data.expire_at ~= '' and data.expire_at or nil, officerName, dateStr })

    MDTAuditLog(source, 'bolo', data.title, 'create', data.plate or '')
    return true
end)

lib.callback.register('hm_police:mdtUpdateBolo', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end
    
    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_bolos
        SET type = ?, title = ?, plate = ?, description = ?, image_url = ?, expire_at = ?, edit_log = ?
        WHERE id = ?
    ]], { data.type or 'vehicle', SanitizeText(data.title, 100), data.plate or '', SanitizeText(data.description, 5000),
          SanitizeImageUrl(data.image_url), data.expire_at ~= '' and data.expire_at or nil, editLog, data.id })

    MDTAuditLog(source, 'bolo', tostring(data.id), 'update', data.title or '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteBolo', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'bolo', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_bolos WHERE id = ?', { id })
    return true
end)

