-- hm_mdt | client/core/main.lua
-- Mobile Data Terminal — NUI Frontend
---@diagnostic disable: undefined-global

local mdtOpen           = false
local mdtLoading        = false
local mdtTabletProp     = nil
local mdtTabletCancel   = false

-- ── Dienststatus (eigene Verwaltung, siehe server/core/duty.lua) ─────────────
LocalOfficerOnDuty = false
LocalOfficerGrade  = 999

RegisterNetEvent('hm_mdt:dutyChanged', function(data)
    LocalOfficerOnDuty = (data and data.on_duty == true) or false
    LocalOfficerGrade  = (data and data.on_duty and data.grade) or 999
end)

-- ── Tablet-Prop & Animation ──────────────────────────────────────────────────

local TABLET_ANIM_DICT = 'amb@world_human_tourist_map@male@base'
local TABLET_ANIM_CLIP = 'base'
local TABLET_PROP_NAME = 'prop_cs_tablet'

-- Assets beim Resourcestart vorladen, damit kein Delay beim Öffnen entsteht
CreateThread(function()
    RequestAnimDict(TABLET_ANIM_DICT)
    RequestModel(GetHashKey(TABLET_PROP_NAME))
    local t = 0
    while (not HasAnimDictLoaded(TABLET_ANIM_DICT) or not HasModelLoaded(GetHashKey(TABLET_PROP_NAME))) and t < 200 do
        Wait(50); t = t + 1
    end
end)

local function AttachTablet()
    mdtTabletCancel = false
    local ped = PlayerPedId()

    if not HasAnimDictLoaded(TABLET_ANIM_DICT) then
        RequestAnimDict(TABLET_ANIM_DICT)
        local t = 0
        while not HasAnimDictLoaded(TABLET_ANIM_DICT) and t < 60 do Wait(50); t = t + 1 end
    end
    if mdtTabletCancel then return end

    local model = GetHashKey(TABLET_PROP_NAME)
    if not HasModelLoaded(model) then
        RequestModel(model)
        local t = 0
        while not HasModelLoaded(model) and t < 60 do Wait(50); t = t + 1 end
    end
    if mdtTabletCancel then SetModelAsNoLongerNeeded(model); return end

    TaskPlayAnim(ped, TABLET_ANIM_DICT, TABLET_ANIM_CLIP, 8.0, -8.0, -1, 49, 0, false, false, false)
    Wait(100)
    if mdtTabletCancel then ClearPedTasks(ped); SetModelAsNoLongerNeeded(model); return end

    local coords = GetEntityCoords(ped)
    mdtTabletProp = CreateObject(model, coords.x, coords.y, coords.z, false, false, false)
    SetEntityAsMissionEntity(mdtTabletProp, true, true)
    AttachEntityToEntity(
        mdtTabletProp, ped,
        GetPedBoneIndex(ped, 18905),
        0.0, 0.0, 0.03,
        -90.0, 0.0, 0.0,
        true, true, false, true, 1, true
    )
    SetModelAsNoLongerNeeded(model)
end

local function DetachTablet()
    mdtTabletCancel = true
    local ped = PlayerPedId()
    ClearPedTasks(ped)
    if mdtTabletProp then
        if DoesEntityExist(mdtTabletProp) then
            SetEntityAsMissionEntity(mdtTabletProp, false, true)
            DeleteEntity(mdtTabletProp)
        end
        mdtTabletProp = nil
    end
end

-- State bereinigen ohne der NUI 'closeMDT' zu schicken — für den Fall, dass sie
-- sich schon selbst geschlossen hat (mdtClose-Callback), sonst Lua↔JS-Ping-Pong.
local function ResetMDTState()
    mdtOpen    = false
    mdtLoading = false
    DetachTablet()
    SetNuiFocus(false, false)
end

-- State bereinigen UND der NUI sagen, dass sie sich schließen soll (Lua-initiiert:
-- ESC, Sign-Out, fehlgeschlagener Dashboard-Fetch, /mdt-Command während offen).
local function CloseMDTState()
    ResetMDTState()
    SendNUIMessage({ action = 'closeMDT' })
end

-- ── Dashboard laden + anzeigen (Beamter ist bereits im MDT-Dienst) ───────────

local function FetchAndShowDashboard()
    local ok, dashData = pcall(lib.callback.await, 'hm_police:mdtGetDashboard', false)

    if not ok or not dashData then
        CloseMDTState()
        return
    end

    local pd = exports['hm_lib']:GetPlayerData() or {}

    SendNUIMessage({
        action        = 'openMDT',
        officerName   = pd.name or '',
        officerImage  = dashData.officerImage or '',
        citizenid     = pd.identifier or '',
        deptLabel     = pd.job_label or '',
        stats         = dashData.stats or {},
        recentRecords = dashData.recentRecords or {},
        recentReports = dashData.recentReports or {},
        warrants      = dashData.warrants or {},
        bolos         = dashData.bolos or {},
        dispatches    = dashData.dispatches or {},
        activeOfficers= dashData.activeOfficers or {},
        locale        = dashData.locale or {},
        penalCode        = dashData.penalCode or {},
        canEditPenalCode  = dashData.canEditPenalCode or false,
        canManageSettings = dashData.canManageSettings or false,
        access            = dashData.access or {},
        officerGrade          = LocalOfficerGrade or 999,
        reportApproveMinGrade = Config.ReportApproveMinGrade or 3,
        dateLocale       = dashData.dateLocale or 'de-DE',
        dateFormat       = dashData.dateFormat or '%d.%m.%Y',
        timeFormat       = dashData.timeFormat or '%H:%M',
        dateTimeFormat   = dashData.dateTimeFormat or '%d.%m.%Y %H:%M',
        fivemanageKey    = dashData.fivemanageKey or '',
    })
end

-- ── Open MDT ─────────────────────────────────────────────────────────────────
-- Global, da client/core/exports.lua und der /mdt-Command darauf zugreifen.

function OpenMDT()
    if mdtOpen or mdtLoading then return end
    mdtLoading = true

    -- Tablet-Prop & Anim in eigenem Thread (blockiert NICHT die Statusabfrage)
    CreateThread(function()
        AttachTablet()
    end)

    CreateThread(function()
        local ok, status = pcall(lib.callback.await, 'hm_police:mdtGetLoginStatus', false)

        if not ok or not status or not status.eligible then
            mdtLoading = false
            DetachTablet()
            lib.notify({ type = 'error', description = _T('not_officer_job') })
            return
        end

        mdtOpen    = true
        mdtLoading = false

        SetNuiFocus(true, true)

        -- ESC-Detection auf Lua-Ebene (JS keydown erreicht die NUI bei ESC nicht zuverlässig)
        CreateThread(function()
            while mdtOpen do
                Wait(0)
                if IsDisabledControlJustPressed(0, 200) then -- INPUT_FRONTEND_CANCEL = ESC
                    CloseMDTState()
                    break
                end
            end
        end)

        if status.onDuty then
            FetchAndShowDashboard()
        else
            SendNUIMessage({
                action       = 'openMDT',
                needsSignIn  = true,
                officerName  = status.officerName or '',
                officerImage = status.officerImage or '',
                deptLabel    = status.deptLabel or '',
                locale       = status.locale or {},
            })
        end
    end)
end

-- ── Sign-In / Sign-Out über das Tablet (ersetzt den früheren /mdtduty-Command) ──

RegisterNUICallback('mdtNuiSignIn', function(_, cb)
    local result = lib.callback.await('hm_police:mdtSetDuty', false, true)
    cb(result or { success = false })
    if result and result.success then
        FetchAndShowDashboard()
    end
end)

RegisterNUICallback('mdtNuiSignOut', function(_, cb)
    lib.callback.await('hm_police:mdtSetDuty', false, false)
    cb('ok')
    CloseMDTState()
end)

-- ── Close MDT ────────────────────────────────────────────────────────────────

RegisterNUICallback('mdtClose', function(_, cb)
    ResetMDTState() -- NUI hat sich schon geschlossen, kein 'closeMDT' zurückschicken (sonst Ping-Pong)
    cb('ok')
end)

-- ── Live Access Refresh ──────────────────────────────────────────────────────

RegisterNetEvent('hm_police:mdtAccessUpdated')
AddEventHandler('hm_police:mdtAccessUpdated', function()
    if not mdtOpen then return end
    local result = lib.callback.await('hm_police:mdtGetMyAccess', false)
    if result then
        SendNUIMessage({ action = 'refreshAccess', access = result.access, canManageSettings = result.canManageSettings })
    end
end)

-- ── Live Dispatch Push ───────────────────────────────────────────────────────
-- Optionale, weiche Integration: hm_policemanager broadcastet neue Einsätze über
-- dieses Event an ALLE Clients (kein hartes Dependency, siehe dashboard.lua).
-- Nur relevant/verarbeitet, wenn dieser Spieler das MDT gerade offen hat.
RegisterNetEvent('hm_police:addDispatchCall')
AddEventHandler('hm_police:addDispatchCall', function(callData)
    if not mdtOpen or not callData then return end
    SendNUIMessage({ action = 'newDispatch', dispatch = callData })
end)

-- ── Keybind / Command ────────────────────────────────────────────────────────

RegisterCommand('mdt', function()
    if mdtLoading then return end -- ignorieren während das MDT noch lädt
    if mdtOpen then
        CloseMDTState()
    else
        OpenMDT()
    end
end, false)

RegisterKeyMapping('mdt', _T('keybind_mdt'), 'keyboard', 'F7')
