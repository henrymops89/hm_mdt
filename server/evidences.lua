-- ══════════════════════════════════════════════════════════════════════════════
--  Evidences (Beweismittel)
-- ══════════════════════════════════════════════════════════════════════════════

lib.callback.register('hm_police:mdtSearchEvidence', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_evidences
        WHERE case_id LIKE ? OR title LIKE ? OR description LIKE ? OR type LIKE ?
        ORDER BY id DESC LIMIT 20
    ]], { '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%', '%' .. query .. '%' })

    return { results = results or {} }
end)

local function GenerateEvidenceNumber()
    local year = os.date('%Y')
    local pad  = Config.CaseNumberPadding or 4
    local count = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_evidences WHERE YEAR(FROM_UNIXTIME(created_at)) = ?', { year }) or {}).c or 0
    local numStr = string.format('%0' .. pad .. 'd', count + 1)
    local result = 'BW-' .. year .. '-' .. numStr
    local existing = MySQL.single.await('SELECT id FROM hm_mdt_evidences WHERE evidence_number = ?', { result })
    if existing then
        for i = count + 2, count + 100 do
            local alt = 'BW-' .. year .. '-' .. string.format('%0' .. pad .. 'd', i)
            if not MySQL.single.await('SELECT id FROM hm_mdt_evidences WHERE evidence_number = ?', { alt }) then
                result = alt; break
            end
        end
    end
    return result
end

lib.callback.register('hm_police:mdtAddEvidence', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.title or data.title == '' then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)
    local off = GetOfficerDeptRow(cid)
    local dept = off and (off.qbx_job ~= '' and off.qbx_job or off.name) or 'police'

    -- Retry: zwei gleichzeitige Erstellungen können bei der Nummer kollidieren (TOCTOU).
    local id, evNum
    for attempt = 1, 3 do
        evNum = GenerateEvidenceNumber()
        id = MySQL.insert.await([[
            INSERT INTO hm_mdt_evidences (evidence_number, case_id, type, title, description, location, image_url, citizenid, citizen_name, status, officer, dept, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            evNum,
            data.case_id or '',
            data.type or 'physical',
            SanitizeText(data.title, 200),
            SanitizeText(data.description, 5000),
            data.location or '',
            SanitizeImageUrl(data.image_url),
            data.citizenid or '',
            data.citizen_name or '',
            data.status or 'active',
            officerName,
            dept,
            os.time(),
        })
        if id then break end
    end

    if not id then return false end

    MDTAuditLog(source, 'evidence', evNum, 'create', data.title)
    return { id = id, evidence_number = evNum }
end)

lib.callback.register('hm_police:mdtUpdateEvidence', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_mdt_evidences
        SET case_id = ?, type = ?, title = ?, description = ?, location = ?, image_url = ?, citizenid = ?, citizen_name = ?, status = ?, edit_log = ?
        WHERE id = ?
    ]], {
        data.case_id or '',
        data.type or 'physical',
        SanitizeText(data.title, 200),
        SanitizeText(data.description, 5000),
        data.location or '',
        SanitizeImageUrl(data.image_url),
        data.citizenid or '',
        data.citizen_name or '',
        data.status or 'active',
        editLog,
        data.id,
    })

    MDTAuditLog(source, 'evidence', tostring(data.id), 'update', data.title or '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteEvidence', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'evidence', tostring(id), 'delete', '')

    MySQL.update.await('DELETE FROM hm_mdt_evidences WHERE id = ?', { id })
    return true
end)
