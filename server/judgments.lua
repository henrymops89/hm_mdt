-- ══════════════════════════════════════════════════════════════════════════════
--  Judgments (Urteile)
-- ══════════════════════════════════════════════════════════════════════════════

lib.callback.register('hm_police:mdtIssueJudgment', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'judgment_issue') then return { success = false } end
    if not HMCheckRateLimit(source, 'mdt_write', 5, 30) then return { success = false } end
    if not data or not data.citizens or #data.citizens == 0 then return { success = false, error = 'no_citizens' } end
    if not data.charges or #data.charges == 0 then return { success = false, error = 'no_charges' } end

    local officerName = exports['hm_lib']:GetPlayerName(source)
    local officerCid  = exports['hm_lib']:GetIdentifier(source)

    local multiplier = tonumber(data.multiplier) or 1.0
    if multiplier < 0.1 then multiplier = 0.1 end
    if multiplier > 5.0 then multiplier = 5.0 end
    local pleaDeal = data.plea_deal and true or false
    if pleaDeal then multiplier = multiplier * 0.5 end

    local baseFine = 0
    local baseJail = 0
    local chargeNames = {}

    for _, ch in ipairs(data.charges) do
        local count = math.max(1, tonumber(ch.count) or 1)
        baseFine = baseFine + ((ch.fine or 0) * count)
        baseJail = baseJail + ((ch.jail or 0) * count)
        local label = ch.title or ch.offense_id or ''
        if count > 1 then label = count .. 'x ' .. label end
        chargeNames[#chargeNames + 1] = label
    end

    local totalFine = math.floor(baseFine * multiplier)
    local totalJail = math.floor(baseJail * multiplier)
    local chargesStr = table.concat(chargeNames, ', ')
    local note = SanitizeText(data.note, 5000)
    local chargesJson = json.encode(data.charges)

    -- Verkehrsdelikte-IDs fuer Fuehrerschein-Entzug
    local trafficIds = { ['V-004'] = true, ['V-005'] = true, ['V-006'] = true, ['V-007'] = true, ['V-010'] = true }
    local hasTrafficOffense = false
    for _, ch in ipairs(data.charges) do
        if trafficIds[ch.offense_id] then hasTrafficOffense = true break end
    end

    -- Fuer jeden ausgewaehlten Buerger
    for _, citizen in ipairs(data.citizens) do
        local cid = citizen.citizenid or citizen.cid or ''
        if cid ~= '' then
            local titlePrefix = pleaDeal and 'Plea Deal: ' or 'Urteil: '
            if multiplier ~= 1.0 and not pleaDeal then titlePrefix = string.format('Urteil (x%.1f): ', multiplier) end

            -- Unabhängige Schreibvorgänge parallel abfeuern.
            AwaitParallel({
                { fn = MySQL.insert, sql = [[
                    INSERT INTO hm_mdt_judgments (citizenid, citizen_name, charges, total_fine, total_jail, multiplier, plea_deal, note, officer, officer_cid)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ]], params = {
                    cid, citizen.name or '', chargesJson, totalFine, totalJail,
                    multiplier, pleaDeal and 1 or 0, note, officerName, officerCid
                } },
                { fn = MySQL.insert, sql = [[
                    INSERT INTO hm_mdt_records (citizenid, type, title, description, fine, jail_time, officer, timestamp)
                    VALUES (?, 'arrest', ?, ?, ?, ?, ?, ?)
                ]], params = {
                    cid,
                    titlePrefix .. chargesStr,
                    note ~= '' and ('Bemerkung: ' .. note .. '\nAnklagen: ' .. chargesStr) or ('Anklagen: ' .. chargesStr),
                    totalFine, totalJail, officerName, os.time()
                } },
                { fn = MySQL.update, sql = 'UPDATE hm_mdt_profiles SET status = ? WHERE citizenid = ?', params = { 'criminal', cid } },
                { fn = MySQL.update, sql = [[
                    UPDATE hm_warrants SET status = 'closed'
                    WHERE status = 'active' AND (subject LIKE ? OR subject LIKE ?)
                ]], params = { '%' .. cid .. '%', '%' .. (citizen.name or '') .. '%' } },
            })

            if totalFine > 0 then
                pcall(function()
                    local targetSrc = exports['hm_lib']:GetPlayerSource(cid)
                    if targetSrc then
                        exports['hm_lib']:RemoveMoney(targetSrc, totalFine)
                    end
                end)
            end

            if totalJail > 0 then
                pcall(SendCitizenToJail, cid, totalJail, data.charges, officerName, source)
            end

            if hasTrafficOffense then
                pcall(function()
                    local license = MySQL.single.await('SELECT id FROM hm_mdt_licenses WHERE citizenid = ? AND type = ? AND status = ?', { cid, 'driving', 'valid' })
                    if license then
                        MySQL.update.await('UPDATE hm_mdt_licenses SET status = ? WHERE id = ?', { 'suspended', license.id })
                    end
                end)
            end

            local extraInfo = ''
            if pleaDeal then extraInfo = ' [PLEA DEAL]' end
            if multiplier ~= 1.0 and not pleaDeal then extraInfo = string.format(' [x%.1f]', multiplier) end
            MDTAuditLog(source, 'judgment', cid, 'issued', string.format('$%d / %d Mon.%s — %s', totalFine, totalJail, extraInfo, chargesStr))
        end
    end

    return { success = true, totalFine = totalFine, totalJail = totalJail }
end)

-- Vorstrafen-Check: Gibt Anzahl Records und letztes Urteil zurueck
lib.callback.register('hm_police:mdtGetPriorRecord', function(source, citizenid)
    if not HasMDTAccess(source) then return {} end
    if not citizenid or citizenid == '' then return {} end

    local recordCount = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_records WHERE citizenid = ?', { citizenid }) or {}).c or 0
    local judgmentCount = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_judgments WHERE citizenid = ?', { citizenid }) or {}).c or 0
    local lastJudgment = MySQL.single.await('SELECT * FROM hm_mdt_judgments WHERE citizenid = ? ORDER BY created_at DESC LIMIT 1', { citizenid })

    return {
        records    = recordCount,
        judgments  = judgmentCount,
        recidivist = judgmentCount >= 3,
        last       = lastJudgment,
    }
end)

-- ── Job-Suche für Rolle hinzufügen ───────────────────────────────────────────

lib.callback.register('hm_police:mdtSearchJob', function(source, data)
    if not HMCheckBossPermission(source) then return { results = {} } end
    local query = ((data and data.query) or ''):lower()
    local jobs = exports['hm_lib']:GetJobs() or {}
    local results = {}
    for jobName, jobData in pairs(jobs) do
        local label = (type(jobData) == 'table' and jobData.label) or jobName
        if query == '' or jobName:lower():find(query, 1, true) or label:lower():find(query, 1, true) then
            results[#results + 1] = { name = jobName, label = label }
        end
        if #results >= 12 then break end
    end
    table.sort(results, function(a, b) return a.name < b.name end)
    return { results = results }
end)

-- Judgment-Historie abrufen
lib.callback.register('hm_police:mdtGetJudgmentHistory', function(source, query)
    if not HasMDTAccess(source) then return { results = {} } end
    if not query or type(query) ~= 'string' or #query < 2 then
        -- Ohne Query: letzte 30
        local results = MySQL.query.await('SELECT * FROM hm_mdt_judgments ORDER BY created_at DESC LIMIT 30') or {}
        return { results = results }
    end
    local results = MySQL.query.await([[
        SELECT * FROM hm_mdt_judgments
        WHERE citizenid LIKE ? OR citizen_name LIKE ? OR officer LIKE ? OR charges LIKE ?
        ORDER BY created_at DESC LIMIT 30
    ]], { '%'..query..'%', '%'..query..'%', '%'..query..'%', '%'..query..'%' })
    return { results = results or {} }
end)
