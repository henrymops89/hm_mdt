-- hm_mdt | server/core/utils.lua
---@diagnostic disable: undefined-global

function FormatDate(timestamp)
    local fmt = Config.DateFormat or '%d.%m.%Y'
    if timestamp then return os.date(fmt, timestamp) end
    return os.date(fmt)
end

function FormatTime(timestamp)
    local fmt = Config.TimeFormat or '%H:%M'
    if timestamp then return os.date(fmt, timestamp) end
    return os.date(fmt)
end

function FormatDateTime(timestamp)
    local fmt = Config.DateTimeFormat or '%d.%m.%Y %H:%M'
    if timestamp then return os.date(fmt, timestamp) end
    return os.date(fmt)
end

function GetOfficerDeptRow(citizenid)
    local info = GetOfficerDeptInfo(citizenid)
    if not info then return nil end
    return { qbx_job = info.qbx_job, name = info.dept_name }
end

function CreateEditLog(officerName)
    local dateStr = FormatDateTime()
    return '[Bearbeitet am ' .. dateStr .. ' Uhr von ' .. officerName .. ']'
end

function GetMDTLocale()
    local result = {}
    for key, value in pairs(Lang) do
        if key:sub(1, 4) == 'mdt_' then
            result[key] = value
        end
    end
    return result
end

-- Feuert mehrere MySQL-Abfragen parallel ab statt sie einzeln zu awaiten.
-- calls: { { fn = MySQL.query|MySQL.single|..., sql = '...', params = {...} }, ... }
function AwaitParallel(calls)
    local n = #calls
    if n == 0 then return {} end
    local results = {}
    local remaining = n
    local p = promise.new()
    for i, c in ipairs(calls) do
        c.fn(c.sql, c.params or {}, function(result)
            results[i] = result
            remaining = remaining - 1
            if remaining <= 0 then p:resolve(true) end
        end)
    end
    Citizen.Await(p)
    return results
end

function SanitizeImageUrl(url)
    if not url or url == '' then return '' end
    if not url:match('^https?://') then return '' end

    local allowed = Config.AllowedImageHosts
    if not allowed or #allowed == 0 then return url end

    local host = url:match('^https?://([^/]+)')
    if not host then return '' end
    host = host:lower():gsub(':%d+$', '')

    for _, allowedHost in ipairs(allowed) do
        allowedHost = allowedHost:lower()
        if host == allowedHost or host:sub(-(#allowedHost + 1)) == '.' .. allowedHost then
            return url
        end
    end
    return ''
end

function SanitizeText(text, maxLen)
    if not text or type(text) ~= 'string' then return '' end
    if maxLen and #text > maxLen then
        return text:sub(1, maxLen)
    end
    return text
end

function MDTAuditLog(source, entityType, entityId, action, details)
    local officerName = exports['hm_lib']:GetPlayerName(source) or 'Unknown'
    local cid = exports['hm_lib']:GetIdentifier(source) or ''
    pcall(MySQL.insert.await, [[
        INSERT INTO hm_mdt_audit_log (entity_type, entity_id, action, officer, officer_cid, details)
        VALUES (?, ?, ?, ?, ?, ?)
    ]], { entityType, tostring(entityId), action, officerName, cid, details or '' })
end
