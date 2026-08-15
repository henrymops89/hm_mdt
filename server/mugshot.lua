-- ══════════════════════════════════════════════════════════════════════════════
--  Screenshot / Mugshot
--  • Ziel online  → Screenshot wird auf dessen Client gemacht (echter Mugshot)
--  • Ziel offline → Screenshot wird auf dem Beamten-Client gemacht (Fallback)
--  • vehicle/bolo → immer auf Beamten-Client
-- ══════════════════════════════════════════════════════════════════════════════

-- Ergebnis vom Ziel-Client zurück an den anfragenden Beamten weiterleiten.
RegisterNetEvent('hm_police:mugshotDone', function(requestedBySrc, result)
    TriggerClientEvent('hm_police:mugshotResult', requestedBySrc, result)
end)

-- Hilfsfunktion: URL in DB speichern
local function saveMugshotUrl(source, targetType, targetId, url)
    if targetType == 'profile' and targetId then
        MySQL.update.await('UPDATE hm_mdt_profiles SET image_url = ? WHERE citizenid = ?', { url, targetId })
        MDTAuditLog(source, 'profile', targetId, 'mugshot', url)
    elseif targetType == 'vehicle' and targetId then
        MySQL.update.await('UPDATE hm_mdt_vehicles SET image_url = ? WHERE plate = ?', { url, targetId })
        MDTAuditLog(source, 'vehicle', targetId, 'photo', url)
    elseif targetType == 'bolo' and targetId then
        MySQL.update.await('UPDATE hm_bolos SET image_url = ? WHERE id = ?', { url, targetId })
        MDTAuditLog(source, 'bolo', tostring(targetId), 'photo', url)
    end
end

-- Wird vom Client nach dem Upload aufgerufen (mit fertiger URL)
lib.callback.register('hm_police:mdtTakeScreenshot', function(source, data)
    if not HasMDTAccess(source) or not CanMDTAction(source, 'edit') then return { success = false, error = 'unauthorized' } end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return { success = false, error = 'rate_limited' } end
    if not data or not data.target or not data.url then
        return { success = false, error = 'no_data' }
    end
    local safeUrl = SanitizeImageUrl(data.url)
    if safeUrl == '' then
        return { success = false, error = 'invalid_url' }
    end

    saveMugshotUrl(source, data.target, data.targetId, safeUrl)
    return { success = true, url = safeUrl }
end)

-- Gibt zurück: welcher Client soll den Screenshot machen + API-Key
lib.callback.register('hm_police:mdtRequestMugshot', function(source, data)
    if not HasMDTAccess(source) then return { success = false, error = 'unauthorized' } end
    if not Config.FiveManageAPIKey or Config.FiveManageAPIKey == '' then
        return { success = false, error = 'no_api_key' }
    end

    local apiKey     = Config.FiveManageAPIKey
    local targetType = data and data.target or 'profile'
    local targetId   = data and data.targetId or ''
    local targetSrc  = nil

    -- Bei Personen-Profil: Ziel-Spieler suchen (echter Mugshot)
    if targetType == 'profile' and targetId ~= '' then
        targetSrc = exports['hm_lib']:GetPlayerSource(targetId)
    end

    if targetSrc and tonumber(targetSrc) then
        -- Ziel ist online → Screenshot auf deren Client triggern
        TriggerClientEvent('hm_police:takeMugshot', tonumber(targetSrc), {
            apiKey      = apiKey,
            requestedBy = source,
            target      = targetType,
            targetId    = targetId
        })
        return { success = true, mode = 'remote' }
    else
        -- Ziel offline oder vehicle/bolo → Beamter macht Screenshot selbst
        return { success = true, mode = 'self', apiKey = apiKey }
    end
end)
