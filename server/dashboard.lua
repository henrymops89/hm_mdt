-- ── Dashboard Data ───────────────────────────────────────────────────────────

lib.callback.register('hm_police:mdtGetDashboard', function(source)
    if not HasMDTAccess(source) then return nil end

    local ownCid = exports['hm_lib']:GetIdentifier(source)

    local results = AwaitParallel({
        { fn = MySQL.single, sql = 'SELECT image_url FROM hm_mdt_profiles WHERE citizenid = ?', params = { ownCid } },
        { fn = MySQL.single, sql = [[
            SELECT
                (SELECT COUNT(*) FROM hm_mdt_profiles) AS profiles,
                (SELECT COUNT(*) FROM hm_mdt_profiles WHERE wanted_level > 0) AS wanted,
                (SELECT COUNT(*) FROM hm_mdt_records) AS records,
                (SELECT COUNT(*) FROM hm_mdt_vehicles WHERE stolen = 1) AS stolen,
                (SELECT COUNT(*) FROM hm_mdt_properties) AS properties,
                (SELECT COUNT(*) FROM hm_mdt_weapons) AS weapons,
                (SELECT COUNT(*) FROM hm_mdt_evidences WHERE status = 'active') AS evidences,
                (SELECT COUNT(*) FROM hm_warrants WHERE status = 'active') AS openWarrants,
                (SELECT COUNT(*) FROM hm_mdt_records WHERE type = 'arrest' AND timestamp > ?) AS arrestsWeek,
                (SELECT COUNT(*) FROM hm_mdt_reports WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS reportsWeek
        ]], params = { os.time() - 604800 } },
        { fn = MySQL.query, sql = [[
            SELECT r.*, p.name FROM hm_mdt_records r
            LEFT JOIN hm_mdt_profiles p ON p.citizenid = r.citizenid
            ORDER BY r.timestamp DESC LIMIT 8
        ]] },
        { fn = MySQL.query, sql = "SELECT * FROM hm_warrants WHERE status = 'active' ORDER BY id DESC LIMIT 20" },
        { fn = MySQL.query, sql = "SELECT * FROM hm_bolos ORDER BY id DESC LIMIT 20" },
        { fn = MySQL.query, sql = [[
            SELECT v.*, p.name AS owner_name FROM hm_mdt_vehicles v
            LEFT JOIN hm_mdt_profiles p ON p.citizenid = v.citizenid
            WHERE v.stolen = 1 ORDER BY v.plate ASC LIMIT 10
        ]] },
        { fn = MySQL.query, sql = "SELECT * FROM hm_mdt_reports ORDER BY updated_at DESC LIMIT 8" },
    })

    local ownProf        = results[1]
    local statsRow       = results[2] or {}
    local recentRecords  = results[3] or {}
    local warrants       = results[4] or {}
    local bolos          = results[5] or {}
    local stolenVehicles = results[6] or {}
    local recentReports  = results[7] or {}

    local officerImage = ownProf and ownProf.image_url or ''
    local stats = {
        profiles     = statsRow.profiles or 0,
        wanted       = statsRow.wanted or 0,
        records      = statsRow.records or 0,
        stolen       = statsRow.stolen or 0,
        properties   = statsRow.properties or 0,
        weapons      = statsRow.weapons or 0,
        evidences    = statsRow.evidences or 0,
        openWarrants = statsRow.openWarrants or 0,
        arrestsWeek  = statsRow.arrestsWeek or 0,
        reportsWeek  = statsRow.reportsWeek or 0,
    }

    -- Aktive Beamte (online im Dienst)
    local activeOfficers = {}
    local players = GetPlayers()
    for _, playerId in ipairs(players) do
        local src = tonumber(playerId)
        if src and IsOfficer(src) then
            local oName = exports['hm_lib']:GetPlayerName(src) or ('Officer #' .. src)
            local oCid = exports['hm_lib']:GetIdentifier(src) or ''
            local oJob = exports['hm_lib']:GetPlayerJob(src)
            local oLabel = oJob and oJob.grade_label or oJob and oJob.label or ''
            table.insert(activeOfficers, {
                name  = oName,
                cid   = oCid,
                grade = oLabel,
            })
        end
    end

    -- Optionale Soft-Integration: nur genutzt, wenn hm_policemanager zufällig mitläuft (kein Hard-Dependency)
    local activeDispatches = GetResourceState('hm_policemanager') == 'started'
        and (exports['hm_policemanager']:GetActiveCalls() or {})
        or {}
    local dispatches = {}
    -- Reverse iteration to get newest first
    local count = 0
    for i = #activeDispatches, 1, -1 do
        table.insert(dispatches, activeDispatches[i])
        count = count + 1
        if count >= 15 then break end
    end

    return {
        officerImage    = officerImage,
        stats           = stats,
        recentRecords   = recentRecords or {},
        recentReports   = recentReports,
        warrants        = warrants,
        bolos           = bolos,
        stolenVehicles  = stolenVehicles,
        dispatches      = dispatches,
        activeOfficers  = activeOfficers,
        locale           = GetMDTLocale(),
        penalCode        = GetPenalCodeGrouped(),
        canEditPenalCode  = CanEditPenalCode(source),
        canManageSettings = CanManageMDTSettings(source),
        access            = GetMDTAccessLevel(source),
        dateLocale       = Config.JSDateLocale or 'de-DE',
        dateFormat       = Config.DateFormat or '%d.%m.%Y',
        timeFormat       = Config.TimeFormat or '%H:%M',
        dateTimeFormat   = Config.DateTimeFormat or '%d.%m.%Y %H:%M',
        fivemanageKey    = Config.FiveManageAPIKey or '',
    }
end)
