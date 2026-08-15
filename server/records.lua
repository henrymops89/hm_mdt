-- ── CreateRecord Export (für hm_policemanager, z.B. der Citation-Bezahlt-Flow) ──
-- Nimmt eine Server-seitig bereits validierte Record-Struktur entgegen (kein
-- source/Officer-Check hier, da der Aufrufer — hm_policemanager — das selbst prüft).

exports('CreateRecord', function(data)
    if not data or not data.citizenid then return nil end
    return MySQL.insert.await([[
        INSERT INTO hm_mdt_records (citizenid, type, title, description, fine, jail_time, officer, dept, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.citizenid,
        data.type or 'citation',
        data.title or '',
        data.description or '',
        tonumber(data.fine) or 0,
        tonumber(data.jail_time) or 0,
        data.officer or '',
        data.dept or '',
        data.timestamp or os.time(),
    })
end)

-- ── Strafakte hinzufügen (Arrest, Citation, Warning) ─────────────────────────

lib.callback.register('hm_police:mdtAddRecord', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'create') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.citizenid or not data.title then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local cid = exports['hm_lib']:GetIdentifier(source)
    local officer = GetOfficerDeptRow(cid)

    MySQL.insert.await([[
        INSERT INTO hm_mdt_records (citizenid, type, title, description, fine, jail_time, officer, dept, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        data.citizenid,
        data.type or 'arrest',
        SanitizeText(data.title, 150),
        SanitizeText(data.description, 5000),
        tonumber(data.fine) or 0,
        tonumber(data.jail_time) or 0,
        officerName,
        officer and officer.name or '',
        os.time(),
    })

    MDTAuditLog(source, 'profile', data.citizenid, 'record_add', data.title or '')

    return true
end)

-- ── Strafakte bearbeiten ─────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtUpdateRecord', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local editLog = CreateEditLog(officerName)

    MySQL.update.await([[
        UPDATE hm_mdt_records
        SET type = ?, title = ?, description = ?, fine = ?, jail_time = ?, edit_log = ?
        WHERE id = ?
    ]], {
        data.type or 'citation',
        SanitizeText(data.title, 150),
        SanitizeText(data.description, 5000),
        tonumber(data.fine) or 0,
        tonumber(data.jail_time) or 0,
        editLog,
        data.id
    })

    MDTAuditLog(source, 'record', tostring(data.id), 'update', data.title or '')

    return true
end)

-- ── Strafakte löschen ────────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtDeleteRecord', function(source, recordId)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'delete') then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not recordId then return false end

    MDTAuditLog(source, 'record', tostring(recordId), 'delete', '')
    MySQL.update.await('DELETE FROM hm_mdt_records WHERE id = ?', { recordId })
    return true
end)

