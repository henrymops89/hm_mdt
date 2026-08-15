-- hm_mdt | server/core/duty.lua
-- Eigene, von hm_policemanager unabhängige Dienst-/Beamten-/Berechtigungsverwaltung.
-- Basiert direkt auf dem Framework-Job (ESX/QBCore/QBX via hm_lib), keine eigene
-- DB-Tabelle nötig — Dienststatus lebt nur im Server-Speicher (reset bei Neustart).
-- Ein-/Ausdiensten passiert über den Sign-In-Screen im Tablet selbst (siehe
-- lib.callback 'hm_police:mdtSetDuty' unten), kein separater Chat-Command mehr.
---@diagnostic disable: undefined-global

local OnDutyOfficers = {} -- [citizenid] = { job = 'police', label = 'Police', grade = 3 }

local function getJobConfig(jobName)
    return Config.OfficerJobs and Config.OfficerJobs[jobName]
end

---Prüft ob ein Spieler aktuell als Beamter im Dienst ist
---@param src number
---@return boolean
function IsOfficer(src)
    local cid = exports['hm_lib']:GetIdentifier(src)
    if not cid then return false end
    return OnDutyOfficers[cid] ~= nil
end

---Gibt den Job-Namen des Beamten zurück (nur wenn im Dienst, oder generell falls requireOnDuty=false und online)
---@param citizenid string
---@param requireOnDuty boolean|nil
---@return string|nil
function GetOfficerDept(citizenid, requireOnDuty)
    local entry = OnDutyOfficers[citizenid]
    if entry then return entry.job end
    if requireOnDuty then return nil end

    -- Nicht im Dienst: versuche trotzdem den aktuellen Job zu ermitteln (falls online)
    local src = exports['hm_lib']:GetPlayerSource(citizenid)
    if not src then return nil end
    local job = exports['hm_lib']:GetPlayerJob(src)
    if job and job.name and getJobConfig(job.name) then return job.name end
    return nil
end

---Liefert dieselbe Form wie hm_policemanager's frühere hm_officers/hm_departments-JOIN-Query
---@param citizenid string
---@return table|nil { qbx_job, dept_name, dept_label, dept_id, officer_id, rank_id, rank_permissions }
function GetOfficerDeptInfo(citizenid)
    local entry = OnDutyOfficers[citizenid]
    local jobName, jobLabel, grade

    if entry then
        jobName, jobLabel, grade = entry.job, entry.label, entry.grade
    else
        local src = exports['hm_lib']:GetPlayerSource(citizenid)
        if not src then return nil end
        local job = exports['hm_lib']:GetPlayerJob(src)
        if not job or not job.name or not getJobConfig(job.name) then return nil end
        jobName, jobLabel, grade = job.name, job.label, job.grade
    end

    return {
        qbx_job = jobName,
        dept_name = jobLabel or jobName,
        dept_label = jobLabel or jobName,
        dept_id = nil,
        officer_id = nil,
        rank_id = grade,
        rank_permissions = nil,
    }
end

---Boss-Check: Job-Grade >= konfiguriertem Minimum, oder ACE-Admin
---@param src number
---@return boolean
function HMCheckBossPermission(src)
    local ace = Config.AcePermission or 'admin'
    if IsPlayerAceAllowed(tostring(src), ace) then return true end

    local job = exports['hm_lib']:GetPlayerJob(src)
    if not job or not job.name then return false end
    local jobCfg = getJobConfig(job.name)
    if not jobCfg then return false end

    return (job.grade or 0) >= (jobCfg.minGradeBoss or 999)
end

-- ── Rate Limiting (rein lokal, keine Framework-Abhängigkeit) ─────────────────

local _rateLimits = {}

---@param src number
---@param action string
---@param max number
---@param window number
---@return boolean allowed
function HMCheckRateLimit(src, action, max, window)
    local key  = action .. '_' .. src
    local now  = os.time()
    local data = _rateLimits[key]
    if not data then
        _rateLimits[key] = { requests = { now } }
        return true
    end
    local fresh = {}
    for _, t in ipairs(data.requests) do
        if now - t < window then fresh[#fresh + 1] = t end
    end
    if #fresh >= max then
        _rateLimits[key] = { requests = fresh }
        return false
    end
    fresh[#fresh + 1] = now
    _rateLimits[key]  = { requests = fresh }
    return true
end

AddEventHandler('playerDropped', function()
    local src = tostring(source)
    for key in pairs(_rateLimits) do
        if key:sub(-#src) == src then _rateLimits[key] = nil end
    end
end)

-- ── Duty Toggle (über den Sign-In-Screen im Tablet) ──────────────────────────

local function setDuty(src, onDuty)
    local cid = exports['hm_lib']:GetIdentifier(src)
    if not cid then return false, 'no_identifier' end

    local jobCfg, job
    if onDuty then
        job = exports['hm_lib']:GetPlayerJob(src)
        jobCfg = job and job.name and getJobConfig(job.name)
        if not jobCfg then
            exports['hm_lib']:NotifyServer(src, 'error', _T('not_officer_job'))
            return false, 'not_officer_job'
        end
        OnDutyOfficers[cid] = { job = job.name, label = jobCfg.label or job.label, grade = job.grade or 0 }
        exports['hm_lib']:NotifyServer(src, 'success', _T('mdt_duty_on'))
    else
        OnDutyOfficers[cid] = nil
        exports['hm_lib']:NotifyServer(src, 'primary', _T('mdt_duty_off'))
    end

    TriggerClientEvent('hm_mdt:dutyChanged', src, { on_duty = onDuty, grade = OnDutyOfficers[cid] and OnDutyOfficers[cid].grade or nil })
    return true, jobCfg and (jobCfg.label or job.label) or nil
end

---Leichtgewichtiger Status-Check fürs Öffnen des MDT: darf dieser Spieler grundsätzlich
---rein (passender Job), und ist er bereits im MDT-Dienst (dann direkt zum Dashboard) oder
---muss er sich erst über den Sign-In-Screen eindiensten?
lib.callback.register('hm_police:mdtGetLoginStatus', function(source)
    local cid = exports['hm_lib']:GetIdentifier(source)
    local job = exports['hm_lib']:GetPlayerJob(source)
    local jobCfg = job and job.name and getJobConfig(job.name)
    -- Config.MDTAccess-Rollen (Richter/Staatsanwalt/...) kennen kein "im Dienst" — direkter Zugriff ohne Sign-In.
    local nonOfficerAccess = not jobCfg and HasMDTAccess(source)
    local prof = cid and MySQL.single.await('SELECT image_url FROM hm_mdt_profiles WHERE citizenid = ?', { cid })
    return {
        eligible     = (jobCfg ~= nil) or nonOfficerAccess,
        onDuty       = nonOfficerAccess or (cid and OnDutyOfficers[cid] ~= nil or false),
        officerName  = exports['hm_lib']:GetPlayerName(source),
        officerImage = prof and prof.image_url or '',
        deptLabel    = jobCfg and (jobCfg.label or job.label) or (job and job.label) or '',
        locale       = GetMDTLocale(),
    }
end)

lib.callback.register('hm_police:mdtSetDuty', function(source, onDuty)
    local ok, labelOrErr = setDuty(source, onDuty and true or false)
    if not ok then
        return { success = false, error = labelOrErr }
    end
    return { success = true, onDuty = onDuty and true or false, deptLabel = labelOrErr }
end)

AddEventHandler('playerDropped', function()
    local src = source
    local cid = exports['hm_lib']:GetIdentifier(src)
    if cid then OnDutyOfficers[cid] = nil end
end)
