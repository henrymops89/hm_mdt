-- hm_mdt | server/core/access.lua
-- Rollenbasierte MDT-Zugriffssteuerung (vormals Teil von hm_policemanager/server/utils.lua)
-- + Boss/Settings-Permission-Checks (vormals in server/mdt.lua)
---@diagnostic disable: undefined-global

-- ── Permission-Checks ─────────────────────────────────────────────────────────

-- Darf der Beamte den Strafenkatalog bearbeiten?
-- Rollen mit der 'penal_edit'-Aktion (z.B. Staatsanwalt via Config.MDTAccess) dürfen
-- immer, unabhängig vom Config.PenalCodeEditPermission-Fallback für Beamte/Boss.
function CanEditPenalCode(src)
    if CanMDTAction(src, 'penal_edit') then return true end
    local perm = Config.PenalCodeEditPermission or 'boss'
    if perm == 'officer' then return IsOfficer(src) end
    return HMCheckBossPermission(src)
end

-- Darf der Beamte die MDT-Einstellungen sehen?
function CanManageMDTSettings(src)
    local perm = Config.MDTSettingsPermission or 'boss'
    if perm == 'officer' then return IsOfficer(src) end
    if perm == 'admin' then
        local ace = Config.AcePermission or 'admin'
        return IsPlayerAceAllowed(tostring(src), ace)
    end
    return HMCheckBossPermission(src)
end

-- ── Rollenbasierter MDT-Zugriff ─────────────────────────────────────────────

local MDTAccessCache = nil

-- Laedt alle Rollen aus DB (oder Config als Fallback)
function LoadMDTAccessRoles()
    local rows = MySQL.query.await('SELECT * FROM hm_mdt_access_roles ORDER BY role ASC') or {}
    if #rows > 0 then
        local roles = {}
        for _, r in ipairs(rows) do
            local okT, tabs = pcall(json.decode, r.tabs)
            local okA, actions = pcall(json.decode, r.actions)
            roles[r.role] = {
                label   = r.label or r.role,
                tabs    = okT and tabs or 'all',
                actions = okA and actions or 'all',
            }
        end
        MDTAccessCache = roles
    else
        -- Fallback: Config
        MDTAccessCache = Config.MDTAccess or {}
    end
    return MDTAccessCache
end

-- Seed: Config-Rollen in DB schreiben (nur wenn DB leer)
CreateThread(function()
    Wait(3500)
    local count = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_access_roles') or {}).c or 0
    if count == 0 and Config.MDTAccess then
        print('[hm_mdt] Seeding MDT access roles from config...')
        for role, access in pairs(Config.MDTAccess) do
            local tabsJson = access.tabs == 'all' and '"all"' or json.encode(access.tabs or {})
            local actionsJson = access.actions == 'all' and '"all"' or json.encode(access.actions or {})
            pcall(MySQL.insert.await, [[
                INSERT IGNORE INTO hm_mdt_access_roles (role, label, tabs, actions)
                VALUES (?, ?, ?, ?)
            ]], { role, role:sub(1,1):upper() .. role:sub(2), tabsJson, actionsJson })
        end
        print('[hm_mdt] MDT access roles seeded.')
    end
    LoadMDTAccessRoles()
end)

-- Prueft ob ein Spieler MDT-Zugriff hat
function HasMDTAccess(src)
    if IsOfficer(src) then return true end
    local job = exports['hm_lib']:GetPlayerJob(src)
    local jobName = job and job.name or nil
    if not MDTAccessCache then LoadMDTAccessRoles() end
    if jobName and MDTAccessCache and MDTAccessCache[jobName] then return true end
    return false
end

-- Gibt die erlaubten Tabs und Aktionen zurueck
function GetMDTAccessLevel(src)
    local result = { tabs = {}, actions = {}, role = 'none' }
    if not MDTAccessCache then LoadMDTAccessRoles() end

    local job = exports['hm_lib']:GetPlayerJob(src)
    local jobName = job and job.name or nil

    if IsOfficer(src) then
        local cid = exports['hm_lib']:GetIdentifier(src)
        local dept = GetOfficerDept(cid, true)
        -- Try dept name first, then job name (dept.name vs role stored as job name)
        local key = (dept and MDTAccessCache and MDTAccessCache[dept]) and dept
                 or (jobName and MDTAccessCache and MDTAccessCache[jobName]) and jobName
                 or nil
        if key then
            local access = MDTAccessCache[key]
            result.tabs = access.tabs or {}
            result.actions = access.actions or {}
            result.role = key
        else
            result.tabs = 'all'
            result.actions = 'all'
            result.role = jobName or dept or 'police'
        end
        return result
    end

    if jobName and MDTAccessCache and MDTAccessCache[jobName] then
        local access = MDTAccessCache[jobName]
        result.tabs = access.tabs or {}
        result.actions = access.actions or {}
        result.role = jobName
    end
    return result
end

function CanMDTAction(src, action)
    local access = GetMDTAccessLevel(src)
    if access.actions == 'all' then return true end
    if type(access.actions) == 'table' then
        for _, a in ipairs(access.actions) do
            if a == action then return true end
        end
    end
    return false
end

-- ── Access Management CRUD ──────────────────────────────────────────────────

lib.callback.register('hm_police:mdtGetMyAccess', function(source)
    return {
        access            = GetMDTAccessLevel(source),
        canManageSettings = CanManageMDTSettings(source),
    }
end)

lib.callback.register('hm_police:mdtGetAccessRoles', function(source)
    if not HMCheckBossPermission(source) then return {} end
    local rows = MySQL.query.await('SELECT * FROM hm_mdt_access_roles ORDER BY role ASC') or {}
    return { roles = rows }
end)

lib.callback.register('hm_police:mdtSaveAccessRole', function(source, data)
    if not HMCheckBossPermission(source) then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.role or data.role == '' then return false end

    local tabsJson = data.tabs == 'all' and '"all"' or json.encode(data.tabs or {})
    local actionsJson = data.actions == 'all' and '"all"' or json.encode(data.actions or {})

    if data.id then
        MySQL.update.await([[
            UPDATE hm_mdt_access_roles SET role = ?, label = ?, tabs = ?, actions = ?, updated_at = NOW() WHERE id = ?
        ]], { data.role, data.label or data.role, tabsJson, actionsJson, data.id })
    else
        MySQL.insert.await([[
            INSERT INTO hm_mdt_access_roles (role, label, tabs, actions) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE label = VALUES(label), tabs = VALUES(tabs), actions = VALUES(actions), updated_at = NOW()
        ]], { data.role, data.label or data.role, tabsJson, actionsJson })
    end

    MDTAuditLog(source, 'access_role', data.role, data.id and 'update' or 'create', '')
    LoadMDTAccessRoles()
    TriggerClientEvent('hm_police:mdtAccessUpdated', -1)
    return { success = true }
end)

lib.callback.register('hm_police:mdtDeleteAccessRole', function(source, id)
    if not HMCheckBossPermission(source) then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end
    local role = MySQL.single.await('SELECT role FROM hm_mdt_access_roles WHERE id = ?', { id })
    MDTAuditLog(source, 'access_role', role and role.role or tostring(id), 'delete', '')
    MySQL.update.await('DELETE FROM hm_mdt_access_roles WHERE id = ?', { id })
    LoadMDTAccessRoles()
    TriggerClientEvent('hm_police:mdtAccessUpdated', -1)
    return { success = true }
end)
