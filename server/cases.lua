-- ══════════════════════════════════════════════════════════════════════════════
--  Cases (Fall-Akten)
-- ══════════════════════════════════════════════════════════════════════════════

-- Generiert eine eindeutige Fall-Nummer basierend auf Config.CaseNumberFormat
local function GenerateCaseNumber(source)
    local year  = os.date('%Y')
    local month = os.date('%m')
    local pad   = Config.CaseNumberPadding or 4

    -- Abteilungskuerzel des Beamten
    local dept = 'PD'
    if source then
        local cid = exports['hm_lib']:GetIdentifier(source)
        if cid then
            local off = GetOfficerDeptRow(cid)
            if off and off.name then
                dept = off.name:upper()
            end
        end
    end

    -- Fortlaufende Nummer: zaehlt alle Faelle dieses Jahres
    local count = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_cases WHERE YEAR(created_at) = ?', { year }) or {}).c or 0
    local countStr = string.format('%0' .. pad .. 'd', count + 1)

    -- Format zusammenbauen
    local fmt = Config.CaseNumberFormat or 'CASE-{YEAR}-{COUNT}'
    local result = fmt
    result = result:gsub('{YEAR}',  year)
    result = result:gsub('{MONTH}', month)
    result = result:gsub('{COUNT}', countStr)
    result = result:gsub('{DEPT}',  dept)

    -- Sicherstellen dass die Nummer unique ist
    local existing = MySQL.single.await('SELECT id FROM hm_mdt_cases WHERE case_number = ?', { result })
    if existing then
        -- Fallback: hochzaehlen bis unique
        for i = count + 2, count + 100 do
            countStr = string.format('%0' .. pad .. 'd', i)
            local alt = fmt:gsub('{YEAR}', year):gsub('{MONTH}', month):gsub('{COUNT}', countStr):gsub('{DEPT}', dept)
            if not MySQL.single.await('SELECT id FROM hm_mdt_cases WHERE case_number = ?', { alt }) then
                result = alt
                break
            end
        end
    end

    return result
end

lib.callback.register('hm_police:mdtSearchCase', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then return { results = {} } end

    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_cases
        WHERE case_number LIKE ? OR title LIKE ? OR description LIKE ? OR lead_officer LIKE ?
        ORDER BY updated_at DESC LIMIT 30
    ]], { '%'..query..'%', '%'..query..'%', '%'..query..'%', '%'..query..'%' })

    return { results = results or {} }
end)

lib.callback.register('hm_police:mdtCreateCase', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.title or data.title == '' then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)

    -- Retry: zwei gleichzeitige Erstellungen können bei der Nummer kollidieren (TOCTOU).
    local id, caseNum
    for attempt = 1, 3 do
        caseNum = GenerateCaseNumber(source)
        id = MySQL.insert.await([[
            INSERT INTO hm_mdt_cases (case_number, title, type, description, status, priority, lead_officer, lead_cid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ]], {
            caseNum,
            SanitizeText(data.title, 200),
            data.type or 'investigation',
            SanitizeText(data.description, 20000),
            data.status or 'open',
            data.priority or 'medium',
            officerName,
            cid
        })
        if id then break end
    end

    if not id then return false end

    MDTAuditLog(source, 'case', tostring(id), 'create', caseNum .. ': ' .. data.title)
    return { id = id, case_number = caseNum }
end)

lib.callback.register('hm_police:mdtUpdateCase', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    MySQL.update.await([[
        UPDATE hm_mdt_cases SET title = ?, type = ?, description = ?, status = ?, priority = ?, updated_at = NOW()
        WHERE id = ?
    ]], { SanitizeText(data.title, 200), data.type or 'investigation', SanitizeText(data.description, 20000), data.status or 'open', data.priority or 'medium', data.id })

    MDTAuditLog(source, 'case', tostring(data.id), 'update', data.title or '')
    return true
end)

lib.callback.register('hm_police:mdtDeleteCase', function(source, id)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    MDTAuditLog(source, 'case', tostring(id), 'delete', '')
    MySQL.update.await('DELETE FROM hm_mdt_cases WHERE id = ?', { id })
    return true
end)

lib.callback.register('hm_police:mdtGetCase', function(source, id)
    if not HasMDTAccess(source) then return nil end
    if not id then return nil end

    local caseData = MySQL.single.await('SELECT * FROM hm_mdt_cases WHERE id = ?', { id })
    if not caseData then return nil end

    -- Links (Personen, Fahrzeuge, Beweise, Berichte)
    local links = MySQL.query.await('SELECT * FROM hm_mdt_case_links WHERE case_id = ? ORDER BY created_at ASC', { id }) or {}

    -- Notes
    local notes = MySQL.query.await('SELECT * FROM hm_mdt_case_notes WHERE case_id = ? ORDER BY created_at DESC', { id }) or {}

    -- Audit-Timeline
    local timeline = MySQL.query.await([[
        SELECT * FROM hm_mdt_audit_log WHERE entity_type = 'case' AND entity_id = ? ORDER BY created_at DESC LIMIT 30
    ]], { tostring(id) }) or {}

    return {
        case     = caseData,
        links    = links,
        notes    = notes,
        timeline = timeline,
    }
end)

-- ── Case Links (Verknuepfungen) ─────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddCaseLink', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.case_id or not data.link_type or not data.link_id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_case_links (case_id, link_type, link_id, label, role, added_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], { data.case_id, data.link_type, data.link_id, data.label or '', data.role or '', officerName })

    MySQL.update.await('UPDATE hm_mdt_cases SET updated_at = NOW() WHERE id = ?', { data.case_id })
    MDTAuditLog(source, 'case', tostring(data.case_id), 'link_add', data.link_type .. ': ' .. data.link_id)
    return true
end)

lib.callback.register('hm_police:mdtRemoveCaseLink', function(source, linkId)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not linkId then return false end

    local link = MySQL.single.await('SELECT * FROM hm_mdt_case_links WHERE id = ?', { linkId })
    if link then
        MDTAuditLog(source, 'case', tostring(link.case_id), 'link_remove', link.link_type .. ': ' .. link.link_id)
        MySQL.update.await('UPDATE hm_mdt_cases SET updated_at = NOW() WHERE id = ?', { link.case_id })
    end
    MySQL.update.await('DELETE FROM hm_mdt_case_links WHERE id = ?', { linkId })
    return true
end)

-- ── Case Notes ──────────────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtAddCaseNote', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.case_id or not data.title then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_case_notes (case_id, title, content, tag, officer)
        VALUES (?, ?, ?, ?, ?)
    ]], { data.case_id, SanitizeText(data.title, 200), SanitizeText(data.content, 5000), data.tag or '', officerName })

    MySQL.update.await('UPDATE hm_mdt_cases SET updated_at = NOW() WHERE id = ?', { data.case_id })
    MDTAuditLog(source, 'case', tostring(data.case_id), 'note_add', data.title)
    return true
end)

lib.callback.register('hm_police:mdtDeleteCaseNote', function(source, noteId)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not noteId then return false end

    local note = MySQL.single.await('SELECT case_id FROM hm_mdt_case_notes WHERE id = ?', { noteId })
    if note then
        MDTAuditLog(source, 'case', tostring(note.case_id), 'note_delete', tostring(noteId))
    end
    MySQL.update.await('DELETE FROM hm_mdt_case_notes WHERE id = ?', { noteId })
    return true
end)
