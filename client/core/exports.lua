-- ── Exports für Radialmenü ───────────────────────────────────────────────────

exports('OpenMDT', OpenMDT)
exports('MDTSearchPerson', function()
    CreateThread(function()
        OpenMDT()
        -- Nach dem Öffnen direkt auf Personen-Tab wechseln
        Wait(200)
        SendNUIMessage({ action = 'switchTab', tab = 'persons' })
    end)
end)
exports('MDTSearchVehicle', function()
    CreateThread(function()
        OpenMDT()
        Wait(200)
        SendNUIMessage({ action = 'switchTab', tab = 'vehicles' })
    end)
end)
exports('MDTQuickLookup', function()
    CreateThread(function()
        -- Nächsten Spieler finden und Profil direkt öffnen
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local best, bestDist = -1, 5.0
        for _, pid in ipairs(GetActivePlayers()) do
            if pid ~= PlayerId() then
                local d = #(coords - GetEntityCoords(GetPlayerPed(pid)))
                if d < bestDist then bestDist = d; best = pid end
            end
        end
        if best == -1 then
            lib.notify({ type = 'error', description = _T('no_player_nearby', 5) })
            return
        end
        local targetSrc = GetPlayerServerId(best)
        local data = lib.callback.await('hm_police:mdtQuickLookup', false, targetSrc)
        if not data then
            lib.notify({ type = 'error', description = _T('mdt_profile_not_found') })
            return
        end
        OpenMDT()
        Wait(300)
        SendNUIMessage({ action = 'openProfile', citizenid = data.citizenid })
    end)
end)
