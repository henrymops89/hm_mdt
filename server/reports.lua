-- ══════════════════════════════════════════════════════════════════════════════
--  Reports (Berichte)
-- ══════════════════════════════════════════════════════════════════════════════

lib.callback.register('hm_police:mdtSearchReport', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_reports
        WHERE title LIKE ? OR content LIKE ? OR citizenids LIKE ? OR vehicles LIKE ? OR officer LIKE ?
        ORDER BY updated_at DESC LIMIT 30
    ]], { '%'..query..'%', '%'..query..'%', '%'..query..'%', '%'..query..'%', '%'..query..'%' })

    return { results = results or {} }
end)

lib.callback.register('hm_police:mdtCreateReport', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.title or data.title == '' then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)

    local id = MySQL.insert.await([[
        INSERT INTO hm_mdt_reports (title, type, content, citizenids, citizen_names, vehicles, officer, officer_cid, status, location, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        SanitizeText(data.title, 200),
        data.type or 'incident',
        SanitizeText(data.content, 20000),
        data.citizenids or '',
        data.citizen_names or '',
        data.vehicles or '',
        officerName,
        cid,
        data.status or 'draft',
        data.location or nil,
        data.occurred_at ~= '' and data.occurred_at or nil
    })

    MDTAuditLog(source, 'report', tostring(id or 0), 'create', data.title or '')
    return id or true
end)

lib.callback.register('hm_police:mdtUpdateReport', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    -- Genehmigen/Ablehnen/Archivieren nur ab Config.ReportApproveMinGrade.
    local restrictedStatuses = { approved = true, rejected = true, archived = true }
    if data.status and restrictedStatuses[data.status] then
        local job = exports['hm_lib']:GetPlayerJob(source)
        local grade = (job and job.grade) or 999
        if grade >= (Config.ReportApproveMinGrade or 3) then return false end
    end

    MySQL.update.await([[
        UPDATE hm_mdt_reports SET title = ?, type = ?, content = ?, citizenids = ?, citizen_names = ?,
        vehicles = ?, status = ?, location = ?, occurred_at = ?, updated_at = NOW() WHERE id = ?
    ]], {
        SanitizeText(data.title, 200),
        data.type or 'incident',
        SanitizeText(data.content, 20000),
        data.citizenids or '',
        data.citizen_names or '',
        data.vehicles or '',
        data.status or 'draft',
        data.location or nil,
        data.occurred_at ~= '' and data.occurred_at or nil,
        data.id
    })

    MDTAuditLog(source, 'report', tostring(data.id), 'update', '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteReport', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'report', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_reports WHERE id = ?', { id })
    return true
end)

lib.callback.register('hm_police:mdtGetReport', function(source, id)
    if not HasMDTAccess(source) then return nil end
    if not id then return nil end

    local report = MySQL.single.await('SELECT * FROM hm_mdt_reports WHERE id = ?', { id })
    if not report then return nil end

    local links = MySQL.query.await('SELECT * FROM hm_mdt_report_links WHERE report_id = ? ORDER BY link_type ASC, created_at ASC', { id }) or {}

    return { report = report, links = links }
end)

-- Report-Links CRUD
lib.callback.register('hm_police:mdtAddReportLink', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.report_id or not data.link_type or not data.link_id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    MySQL.insert.await([[
        INSERT INTO hm_mdt_report_links (report_id, link_type, link_id, label, role, added_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], { data.report_id, data.link_type, data.link_id, data.label or '', data.role or '', officerName })

    MySQL.update.await('UPDATE hm_mdt_reports SET updated_at = NOW() WHERE id = ?', { data.report_id })
    MDTAuditLog(source, 'report', tostring(data.report_id), 'link_add', data.link_type .. ': ' .. data.link_id)
    return true
end)

lib.callback.register('hm_police:mdtRemoveReportLink', function(source, linkId)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not linkId then return false end

    local link = MySQL.single.await('SELECT report_id, link_type, link_id FROM hm_mdt_report_links WHERE id = ?', { linkId })
    MySQL.update.await('DELETE FROM hm_mdt_report_links WHERE id = ?', { linkId })
    if link then
        MySQL.update.await('UPDATE hm_mdt_reports SET updated_at = NOW() WHERE id = ?', { link.report_id })
        MDTAuditLog(source, 'report', tostring(link.report_id), 'link_remove', link.link_type .. ': ' .. link.link_id)
    end
    return true
end)
