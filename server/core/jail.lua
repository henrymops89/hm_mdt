-- hm_mdt | server/core/jail.lua
-- Optionale Haft-Integration für per Urteil verhängte Haftzeiten.
-- Kein eigenes Zellen-/Freilassungssystem — hm_mdt ist ein Datenterminal, keine
-- Gefängnissimulation. Wenn Config.PrisonSystem = 'none' (Standard), wird nur
-- geloggt (siehe MDTAuditLog in judgments.lua), niemand wird tatsächlich inhaftiert.
---@diagnostic disable: undefined-global

---@param citizenid string
---@param months number
---@param charges table
---@param officerName string
---@param officerSrc number|nil Server-ID des ausstellenden Beamten (für Benachrichtigung)
function SendCitizenToJail(citizenid, months, charges, officerName, officerSrc)
    if not citizenid or not months or months <= 0 then return false, 'invalid_data' end

    local prisonConfig = Config.PrisonSystem ~= 'none' and Config.PrisonExports[Config.PrisonSystem]
    if not prisonConfig or not prisonConfig.resource then
        return false, 'no_prison_integration'
    end

    if GetResourceState(prisonConfig.resource) ~= 'started' then
        print(('^3[hm_mdt] Config.PrisonSystem = %s, aber Resource läuft nicht — Urteil wird nur protokolliert.^7'):format(Config.PrisonSystem))
        return false, 'prison_resource_not_running'
    end

    local targetSrc = exports['hm_lib']:GetPlayerSource(citizenid)
    if not targetSrc then
        return false, 'target_offline'
    end

    local ok, err = pcall(prisonConfig.jail, targetSrc, math.floor(months), charges or {}, officerName or 'Unbekannt')
    if not ok then
        print(('^1[hm_mdt] Fehler bei %s Integration: %s^7'):format(Config.PrisonSystem, tostring(err)))
        return false, 'jail_error'
    end

    if officerSrc then
        exports['hm_lib']:NotifyServer(officerSrc, 'success', ('Beamter wurde via %s inhaftiert (%d Monate).'):format(Config.PrisonSystem, months))
    end

    return true
end
