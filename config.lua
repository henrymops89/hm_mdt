Config                       = {}
Config.Locale                = 'de'
Config.AcePermission         =
'admin'                        -- ACE-Permission für Admin-Zugriff (z.B. MDT-Einstellungen mit Config.MDTSettingsPermission = 'admin')

-- ── Eigene Dienst-/Beamten-Verwaltung ────────────────────────────────────────
-- hm_mdt führt seine eigene, unabhängige Dienst-Liste (rein im Server-Speicher,
-- kein hm_policemanager oder anderes Department-Script nötig). Ein Spieler gilt
-- als "Beamter", wenn sein Framework-Job (ESX/QBCore/QBX, via hm_lib) hier
-- gelistet ist UND er sich über den Sign-In-Screen im Tablet eingedienst hat.
--
-- minGradeBoss = ab welchem Job-Grade (ESX grade / QB grade.level) jemand als
-- "Boss" gilt (darf z.B. MDT-Zugriffsrollen, Strafenkatalog etc. verwalten).
Config.OfficerJobs           = {
    police  = { label = 'Police', minGradeBoss = 3 },
    sheriff = { label = 'Sheriff', minGradeBoss = 3 },
    fbi     = { label = 'FBI', minGradeBoss = 3 },
}

-- ── Role-Based MDT Access ────────────────────────────────────────────────────
-- 'all' = access to everything. Empty array = no access.
-- Jobs NOT listed here have NO MDT access.
--
-- Available tabs:
--   dashboard, warrants, bolos, cases, judgments,
--   persons, vehicles, properties, weapons, evidences, reports, penalcode
-- Available actions: create, edit, delete, judgment_issue, penal_edit
Config.MDTAccess             = {
    police     = { tabs = 'all', actions = 'all' },
    sheriff    = { tabs = 'all', actions = 'all' },
    fbi        = { tabs = 'all', actions = 'all' },
    judge      = { tabs = { 'dashboard', 'persons', 'judgments', 'cases', 'reports', 'penalcode', 'warrants' }, actions = { 'create', 'edit', 'judgment_issue', 'penal_edit' } },
    prosecutor = { tabs = { 'dashboard', 'persons', 'vehicles', 'evidences', 'judgments', 'cases', 'reports', 'penalcode', 'warrants' }, actions = { 'create', 'edit', 'judgment_issue' } },
    lawyer     = { tabs = { 'dashboard', 'persons', 'warrants', 'cases', 'reports' }, actions = {} },
    ambulance  = { tabs = { 'dashboard', 'persons' }, actions = {} },
}

-- Minimum grade required to approve / reject / archive reports.
-- Example: 3 → grades 0, 1, 2 can approve; grade 3+ cannot.
Config.ReportApproveMinGrade = 3

Config.MugshotKey            = 166 -- Screenshot key (166 = F5, 38 = E, 191 = Enter)

-- Aufbewahrungsdauer für hm_mdt_audit_log in Tagen. 0 = keine automatische Löschung.
Config.AuditLogRetentionDays = 90

-- Erlaubte Hosts für Bild-URLs (Mugshots, Fahrzeuge, BOLOs, Beweismittel, Immobilien).
-- Leer = keine Einschränkung.
--   Config.AllowedImageHosts = { 'cdn.fivemanage.com', 'cdn.discordapp.com' }
Config.AllowedImageHosts     = {}

--[[
    ══════════════════════════════════════════════════════════════════
    Server-Only Konfiguration (vormals config/server.lua in hm_policemanager)
    ══════════════════════════════════════════════════════════════════
]]

-- ── FiveManage Screenshot Upload ─────────────────────────────────────────
-- API-Key von https://fivemanage.com - wird fuer Mugshot-Upload im MDT benoetigt
Config.FiveManageAPIKey        = '' -- Get your key at https://fivemanage.com

-- ── Fall-Akten (Cases) ───────────────────────────────────────────────────
-- Format fuer die automatisch generierte Fall-Nummer
-- Verfuegbare Platzhalter:
--   {YEAR}    = aktuelles Jahr (z.B. 2026)
--   {MONTH}   = aktueller Monat 2-stellig (z.B. 05)
--   {COUNT}   = fortlaufende Nummer, wird mit Nullen aufgefuellt
--   {DEPT}    = Abteilungskuerzel des Beamten (z.B. LSPD, BCSO)
--
-- Beispiele:
--   'CASE-{YEAR}-{COUNT}'          => CASE-2026-0001
--   '{DEPT}-{YEAR}{MONTH}-{COUNT}' => LSPD-202605-0001
--   'AZ-{COUNT}/{YEAR}'            => AZ-0001/2026
--   'ERV-{YEAR}-{MONTH}-{COUNT}'   => ERV-2026-05-0001
Config.CaseNumberFormat        = 'CASE-{YEAR}-{COUNT}'
Config.CaseNumberPadding       = 4 -- Anzahl Stellen fuer {COUNT} (4 = 0001, 5 = 00001)

-- ── Datumsformat ─────────────────────────────────────────────────────────
-- Lua os.date Platzhalter: %d=Tag, %m=Monat, %Y=Jahr, %H=Stunde, %M=Minute
-- Beispiele:
--   '%d.%m.%Y'     => 22.05.2026  (deutsch)
--   '%m/%d/%Y'     => 05/22/2026  (US)
--   '%Y-%m-%d'     => 2026-05-22  (ISO)
--   '%d/%m/%Y'     => 22/05/2026  (UK/FR)
Config.DateFormat              = '%d.%m.%Y'
Config.TimeFormat              = '%H:%M'
Config.DateTimeFormat          = '%d.%m.%Y %H:%M'

-- JS-Locale fuer Datumsanzeige im Frontend (BCP 47)
-- 'de-DE' = deutsch, 'en-US' = US, 'en-GB' = UK, 'fr-FR' = franzoesisch
Config.JSDateLocale            = 'de-DE'

-- Strafenkatalog im MDT bearbeiten: 'boss' = nur Boss-Rang, 'officer' = jeder Beamte
Config.PenalCodeEditPermission = 'boss'

-- MDT Einstellungen-Tab sichtbar für: 'boss' = nur Boss/Admin, 'officer' = jeder Beamte, 'admin' = nur Ace-Admin
Config.MDTSettingsPermission   = 'boss'

-- ── Haft-Integration für ausgestellte Urteile ────────────────────────────────
-- 'none' = Urteile mit Haftzeit werden nur protokolliert, niemand wird tatsächlich eingesperrt.
-- Sonst: Name eines externen Prison-Scripts aus Config.PrisonExports (muss laufen).
Config.PrisonSystem            = 'none'

Config.PrisonExports           = {
    ['rip-prison'] = {
        resource = 'rip-prison',
        -- RiP-Prison: JailPlayer(source, time_minutes, bail, reason, officer)
        jail = function(src, timeMinutes, charges, officerName)
            local chargeNames = {}
            for _, charge in ipairs(charges or {}) do
                table.insert(chargeNames, charge.name or charge)
            end
            exports['rip-prison']:JailPlayer(src, timeMinutes, 0, table.concat(chargeNames, ', '), officerName)
        end
    },
    rcore_prison = {
        resource = 'rcore_prison',
        -- rcore_prison: JailPlayer(playerId, time_seconds, options)
        jail = function(src, timeMinutes, charges, officerName)
            local chargeNames = {}
            for _, charge in ipairs(charges or {}) do
                table.insert(chargeNames, charge.name or charge)
            end
            exports.rcore_prison:JailPlayer(src, timeMinutes * 60, { reason = table.concat(chargeNames, ', ') })
        end
    },
}
