lib.callback.register('hm_police:mdtGetAuditLog', function(source, data)
    if not HasMDTAccess(source) then return {} end
    if not data or not data.entity_type or not data.entity_id then return {} end

    local logs = MySQL.query.await([[
        SELECT * FROM hm_mdt_audit_log
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC LIMIT 50
    ]], { data.entity_type, tostring(data.entity_id) })

    return logs or {}
end)

-- Löscht Audit-Log-Einträge älter als Config.AuditLogRetentionDays, alle 24h. 0 = deaktiviert.
CreateThread(function()
    local retentionDays = Config.AuditLogRetentionDays or 0
    if retentionDays <= 0 then return end

    while true do
        Wait(10000) -- kurze Verzögerung, damit MySQL/Migrations sicher bereit sind
        local ok, deleted = pcall(MySQL.update.await,
            'DELETE FROM hm_mdt_audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            { retentionDays }
        )
        if ok and deleted and deleted > 0 then
            print(('[hm_mdt] ^3Audit-Log-Retention: %d Eintraege aelter als %d Tage geloescht.^7'):format(deleted, retentionDays))
        end
        Wait(24 * 60 * 60 * 1000)
    end
end)
