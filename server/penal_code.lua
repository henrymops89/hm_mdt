-- ══════════════════════════════════════════════════════════════════════════════
--  Strafenkatalog (Penal Code) — DB-basiert
-- ══════════════════════════════════════════════════════════════════════════════

-- In-Memory-Cache, da der Katalog bei jedem Dashboard-Load gebraucht wird, sich
-- zur Laufzeit aber quasi nie ändert. Invalidiert bei jeder CRUD-Änderung unten.
local penalCodeCache = nil

function GetPenalCodeGrouped()
    if penalCodeCache then return penalCodeCache end

    local rows = MySQL.query.await('SELECT * FROM hm_mdt_penal_code ORDER BY category ASC, offense_id ASC') or {}
    local categories = {}
    local catOrder = {}
    for _, r in ipairs(rows) do
        local cat = r.category or 'Sonstiges'
        if not categories[cat] then
            categories[cat] = {}
            catOrder[#catOrder + 1] = cat
        end
        categories[cat][#categories[cat] + 1] = {
            id    = r.offense_id,
            title = r.title,
            desc  = r.description or '',
            type  = r.type or 'citation',
            fine  = r.fine or 0,
            jail  = r.jail or 0,
        }
    end
    local result = {}
    for _, cat in ipairs(catOrder) do
        result[#result + 1] = { category = cat, offenses = categories[cat] }
    end
    -- Fallback: wenn DB leer, Config nutzen (bewusst nicht gecacht, da sich das
    -- nach dem Seeding unten sofort ändert)
    if #result == 0 and PenalCode and #PenalCode > 0 then
        return PenalCode
    end

    penalCodeCache = result
    return penalCodeCache
end

function InvalidatePenalCodeCache()
    penalCodeCache = nil
end

-- Seed: Config-Eintraege in DB schreiben (nur wenn DB leer)
CreateThread(function()
    Wait(3000) -- Warten bis MySQL ready
    local count = (MySQL.single.await('SELECT COUNT(*) AS c FROM hm_mdt_penal_code') or {}).c or 0
    if count == 0 and PenalCode and #PenalCode > 0 then
        print('[hm_police] Seeding penal code from config (' .. #PenalCode .. ' categories)...')
        for _, cat in ipairs(PenalCode) do
            for _, o in ipairs(cat.offenses or {}) do
                pcall(MySQL.insert.await, [[
                    INSERT IGNORE INTO hm_mdt_penal_code (offense_id, category, title, description, type, fine, jail)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ]], { o.id, cat.category, o.title, o.desc or '', o.type or 'citation', o.fine or 0, o.jail or 0 })
            end
        end
        InvalidatePenalCodeCache()
        print('[hm_police] Penal code seeded successfully.')
    end
end)

-- CRUD Callbacks

lib.callback.register('hm_police:mdtGetPenalCode', function(source)
    if not HasMDTAccess(source) then return {} end
    local rows = MySQL.query.await('SELECT * FROM hm_mdt_penal_code ORDER BY category ASC, offense_id ASC') or {}
    return { entries = rows, canEdit = CanEditPenalCode(source) }
end)

lib.callback.register('hm_police:mdtCreatePenalEntry', function(source, data)
    if not CanEditPenalCode(source) then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.offense_id or not data.title then return false end

    local existing = MySQL.single.await('SELECT id FROM hm_mdt_penal_code WHERE offense_id = ?', { data.offense_id })
    if existing then return { success = false, error = 'duplicate_id' } end

    MySQL.insert.await([[
        INSERT INTO hm_mdt_penal_code (offense_id, category, title, description, type, fine, jail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], { data.offense_id, data.category or 'Sonstiges', SanitizeText(data.title, 200), SanitizeText(data.description, 5000), data.type or 'citation', data.fine or 0, data.jail or 0 })

    InvalidatePenalCodeCache()
    MDTAuditLog(source, 'penal_code', data.offense_id, 'create', data.title)
    return { success = true }
end)

lib.callback.register('hm_police:mdtUpdatePenalEntry', function(source, data)
    if not CanEditPenalCode(source) then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not data or not data.id then return false end

    MySQL.update.await([[
        UPDATE hm_mdt_penal_code SET offense_id = ?, category = ?, title = ?, description = ?, type = ?, fine = ?, jail = ?
        WHERE id = ?
    ]], { data.offense_id or '', data.category or 'Sonstiges', SanitizeText(data.title, 200), SanitizeText(data.description, 5000), data.type or 'citation', data.fine or 0, data.jail or 0, data.id })

    InvalidatePenalCodeCache()
    MDTAuditLog(source, 'penal_code', data.offense_id or tostring(data.id), 'update', data.title or '')
    return { success = true }
end)

lib.callback.register('hm_police:mdtDeletePenalEntry', function(source, id)
    if not CanEditPenalCode(source) then return false end
    if not HMCheckRateLimit(source, 'mdt_write', 10, 30) then return false end
    if not id then return false end

    local entry = MySQL.single.await('SELECT offense_id, title FROM hm_mdt_penal_code WHERE id = ?', { id })
    MDTAuditLog(source, 'penal_code', entry and entry.offense_id or tostring(id), 'delete', entry and entry.title or '')
    MySQL.update.await('DELETE FROM hm_mdt_penal_code WHERE id = ?', { id })
    InvalidatePenalCodeCache()
    return { success = true }
end)
