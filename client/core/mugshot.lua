-- ── Screenshot Upload NUI Callback ──────────────────────────────────────────

-- Hilfsfunktion: Screenshot nehmen + zu FiveManage hochladen
local function doScreenshotUpload(apiKey, onDone)
    exports['screenshot-basic']:requestScreenshotUpload(
        'https://api.fivemanage.com/api/v3/file',
        'file',
        { headers = { ['Authorization'] = apiKey } },
        function(responseData)
            local ok, decoded = pcall(json.decode, responseData)
            local url = (ok and decoded and decoded.data and decoded.data.url) or nil
            if not url and type(responseData) == 'string' and responseData:match('^https?://') then
                url = responseData
            end
            onDone(url)
        end
    )
end

-- Kamera-Prop + Animation (Paparazzi-Pose)
local _mugshotAnimDict = 'amb@world_human_paparazzi@male@base'
local _mugshotAnimIdle = 'base'

local function attachCameraProp(ped)
    local model = `prop_pap_camera_01`
    RequestModel(model)
    local t = 0
    while not HasModelLoaded(model) and t < 100 do Wait(10); t = t + 1 end
    local prop = CreateObject(model, 0.0, 0.0, 0.0, true, true, false)
    -- Bone 28422 = SKEL_R_Hand, folgt der Animation korrekt
    AttachEntityToEntity(prop, ped, GetPedBoneIndex(ped, 28422),
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(model)
    return prop
end

local function playMugshotIdleAnim(ped)
    RequestAnimDict(_mugshotAnimDict)
    local t = 0
    while not HasAnimDictLoaded(_mugshotAnimDict) and t < 200 do Wait(10); t = t + 1 end
    -- Flag 1 = Loop | 16 = oberkörper, Füße bleiben frei
    TaskPlayAnim(ped, _mugshotAnimDict, _mugshotAnimIdle, 3.0, -8.0, -1, 17, 0.0, false, false, false)
end

local function playMugshotShootAnim(ped)
    -- kurz freeze in aktueller Pose (Auslöser-Effekt via Kamera-Shake reicht)
    TaskPlayAnim(ped, _mugshotAnimDict, _mugshotAnimIdle, 8.0, -8.0, 500, 17, 0.0, false, false, false)
end

local function cleanupMugshotAnim(ped, prop)
    ClearPedTasks(ped)
    RemoveAnimDict(_mugshotAnimDict)
    if prop and DoesEntityExist(prop) then
        DetachEntity(prop, true, true)
        DeleteObject(prop)
    end
end

-- NUI → fragt Server, ob das Ziel online ist (echter Mugshot) oder der Beamte
-- selbst fotografieren muss (Fallback).
RegisterNUICallback('mdtNuiRequestMugshot', function(data, cb)
    local result = lib.callback.await('hm_police:mdtRequestMugshot', false, data)
    cb(result or { success = false, error = 'no_response' })
end)

-- Ergebnis eines Remote-Mugshots, kommt asynchron zurück.
RegisterNetEvent('hm_police:mugshotResult', function(result)
    SendNUIMessage({ action = 'screenshotResult', result = result })
end)

-- NUI → Mugshot-Modus: Tablet erst verstecken, dann Fokus freigeben
RegisterNUICallback('mdtNuiStartCapture', function(data, cb)
    cb('ok')

    local ped = PlayerPedId()

    -- 1. MDT-Frame verstecken
    SendNUIMessage({ action = 'mugshotHideMDT' })
    Wait(150)

    -- 2. Kamera-Prop spawnen + Idle-Pose starten
    local cameraProp = attachCameraProp(ped)
    playMugshotIdleAnim(ped)

    -- 3. GTA-Steuerung freigeben
    SetNuiFocus(false, false)

    CreateThread(function()
        local captureKey = Config.MugshotKey or 166
        local cancelled  = false

        while true do
            Wait(0)
            if IsControlJustPressed(0, captureKey) then break end
            if IsControlJustPressed(0, 200) then cancelled = true; break end
        end

        -- Overlay ausblenden
        SendNUIMessage({ action = 'mugshotHideOverlay' })

        local result = { success = false, error = 'cancelled' }

        if not cancelled then
            -- Auslöse-Animation + kurze Pause (Overlay ist schon weg → im Screenshot sieht man Klick-Pose)
            playMugshotShootAnim(ped)
            Wait(250)

            local p = promise.new()
            doScreenshotUpload(data.apiKey, function(url)
                if url then
                    local saveResult = lib.callback.await('hm_police:mdtTakeScreenshot', false, {
                        target = data.target, targetId = data.targetId, url = url
                    })
                    p:resolve(saveResult or { success = false, error = 'save_failed' })
                else
                    p:resolve({ success = false, error = 'upload_failed' })
                end
            end)
            result = Citizen.Await(p)
        end

        -- Prop + Animation aufräumen
        cleanupMugshotAnim(ped, cameraProp)

        -- MDT und Fokus wiederherstellen
        SetNuiFocus(true, true)
        SendNUIMessage({ action = 'mugshotShowMDT' })
        SendNUIMessage({ action = 'screenshotResult', result = result })
    end)
end)

-- NUI → manuelle URL direkt speichern
RegisterNUICallback('mdtNuiTakeScreenshot', function(data, cb)
    if data and data.url and data.url ~= '' then
        local result = lib.callback.await('hm_police:mdtTakeScreenshot', false, data)
        cb(result or { success = false, error = 'save_failed' })
        return
    end
    cb({ success = false, error = 'no_url' })
end)

-- Wird getriggert wenn dieser Client einen Mugshot für jemand anderen machen soll
RegisterNetEvent('hm_police:takeMugshot', function(mugshotData)
    doScreenshotUpload(mugshotData.apiKey, function(url)
        local result = { success = false, error = 'upload_failed' }
        if url then
            result = lib.callback.await('hm_police:mdtTakeScreenshot', false, {
                target   = mugshotData.target,
                targetId = mugshotData.targetId,
                url      = url
            })
        end
        -- Ergebnis zurück an den anfragenden Beamten
        TriggerServerEvent('hm_police:mugshotDone', mugshotData.requestedBy, result)
    end)
end)
