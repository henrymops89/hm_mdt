-- ── NUI Callbacks → Server ───────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchPerson', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchPerson', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiSearchJob', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchJob', false, data)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiGetProfile', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetProfile', false, data.citizenid)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiSearchVehicle', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchVehicle', false, data.plate)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiAddRecord', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddRecord', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateRecord', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateRecord', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteRecord', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteRecord', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateProfile', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateProfile', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiAddNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddNote', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteNote', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateVehicle', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateVehicle', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiGetVehicleProfile', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetVehicleProfile', false, data.plate)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiAddVehicleNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddVehicleNote', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteVehicleNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteVehicleNote', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiAddWarrant', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddWarrant', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateWarrant', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateWarrant', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteWarrant', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteWarrant', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiAddBolo', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddBolo', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateBolo', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateBolo', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteBolo', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteBolo', false, data.id)
    cb({ success = ok })
end)

-- ── Properties NUI Callbacks ─────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchProperty', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchProperty', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiAddProperty', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddProperty', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateProperty', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateProperty', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteProperty', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteProperty', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiGetPropertyProfile', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetPropertyProfile', false, data.id)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiAddPropertyNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddPropertyNote', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeletePropertyNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeletePropertyNote', false, data.id)
    cb({ success = ok })
end)

-- ── Weapons NUI Callbacks ────────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchWeapon', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchWeapon', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiAddWeapon', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddWeapon', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateWeapon', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateWeapon', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteWeapon', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteWeapon', false, data.id)
    cb({ success = ok })
end)

-- ── Evidences NUI Callbacks ──────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchEvidence', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchEvidence', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiAddEvidence', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddEvidence', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateEvidence', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateEvidence', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteEvidence', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteEvidence', false, data.id)
    cb({ success = ok })
end)

-- ── Reports NUI Callbacks ───────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchReport', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchReport', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiCreateReport', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtCreateReport', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiUpdateReport', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateReport', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteReport', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteReport', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiGetReport', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetReport', false, data.id)
    cb(result or {})
end)

RegisterNUICallback('mdtReqDashboardUpdate', function(_, cb)
    local dashData = lib.callback.await('hm_police:mdtGetDashboard', false)
    if dashData then
        SendNUIMessage({
            action = 'openMDT',
            stats = dashData.stats or {},
            recentRecords = dashData.recentRecords or {},
            warrants = dashData.warrants or {},
            bolos = dashData.bolos or {},
            dispatches = dashData.dispatches or {},
        })
    end
    cb('ok')
end)
-- ── Audit Log NUI Callback ──────────────────────────────────────────────────

RegisterNUICallback('mdtNuiGetAuditLog', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetAuditLog', false, data)
    cb(result or {})
end)
-- ── Cases NUI Callbacks ─────────────────────────────────────────────────────

RegisterNUICallback('mdtNuiSearchCase', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSearchCase', false, data.query)
    cb(result or { results = {} })
end)

RegisterNUICallback('mdtNuiCreateCase', function(data, cb)
    local result = lib.callback.await('hm_police:mdtCreateCase', false, data)
    cb(result or { success = false })
end)

RegisterNUICallback('mdtNuiUpdateCase', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtUpdateCase', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteCase', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteCase', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiGetCase', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetCase', false, data.id)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiAddCaseLink', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddCaseLink', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiRemoveCaseLink', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtRemoveCaseLink', false, data.id)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiAddCaseNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddCaseNote', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiDeleteCaseNote', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtDeleteCaseNote', false, data.id)
    cb({ success = ok })
end)

-- ── Penal Code NUI Callbacks ────────────────────────────────────────────────

RegisterNUICallback('mdtNuiGetPenalCode', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetPenalCode', false)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiCreatePenalEntry', function(data, cb)
    local result = lib.callback.await('hm_police:mdtCreatePenalEntry', false, data)
    cb(result or { success = false })
end)

RegisterNUICallback('mdtNuiUpdatePenalEntry', function(data, cb)
    local result = lib.callback.await('hm_police:mdtUpdatePenalEntry', false, data)
    cb(result or { success = false })
end)

RegisterNUICallback('mdtNuiDeletePenalEntry', function(data, cb)
    local result = lib.callback.await('hm_police:mdtDeletePenalEntry', false, data.id)
    cb(result or { success = false })
end)

-- ── Judgment NUI Callback ───────────────────────────────────────────────────

RegisterNUICallback('mdtNuiIssueJudgment', function(data, cb)
    local result = lib.callback.await('hm_police:mdtIssueJudgment', false, data)
    cb(result or { success = false })
end)

RegisterNUICallback('mdtNuiGetPriorRecord', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetPriorRecord', false, data.citizenid)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiGetJudgmentHistory', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetJudgmentHistory', false, data.query)
    cb(result or { results = {} })
end)

-- ── Report Links NUI Callbacks ──────────────────────────────────────────────

RegisterNUICallback('mdtNuiAddReportLink', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtAddReportLink', false, data)
    cb({ success = ok })
end)

RegisterNUICallback('mdtNuiRemoveReportLink', function(data, cb)
    local ok = lib.callback.await('hm_police:mdtRemoveReportLink', false, data.id)
    cb({ success = ok })
end)

-- ── Access Management NUI Callbacks ─────────────────────────────────────────

RegisterNUICallback('mdtNuiGetAccessRoles', function(data, cb)
    local result = lib.callback.await('hm_police:mdtGetAccessRoles', false)
    cb(result or {})
end)

RegisterNUICallback('mdtNuiSaveAccessRole', function(data, cb)
    local result = lib.callback.await('hm_police:mdtSaveAccessRole', false, data)
    cb(result or { success = false })
end)

RegisterNUICallback('mdtNuiDeleteAccessRole', function(data, cb)
    local result = lib.callback.await('hm_police:mdtDeleteAccessRole', false, data.id)
    cb(result or { success = false })
end)
