-- hm_mdt | shared/locale.lua
-- Lädt nur die konfigurierte Sprache
---@diagnostic disable: undefined-global

_G.Lang = {}

local locale = Config and Config.Locale or 'en'
local res    = GetCurrentResourceName()
local path   = ('locales/%s.lua'):format(locale)
local raw    = LoadResourceFile(res, path)

if raw then
    -- Ersetze "Lang = Lang or {}" am Anfang durch nichts (schon initialisiert)
    local fn, err = load(raw, '@hm_mdt/' .. path, 't', _ENV)
    if fn then
        fn()
    else
        -- Fallback: versuche mit globalem Environment
        local fn2, err2 = load(raw, '@hm_mdt/' .. path)
        if fn2 then
            fn2()
        else
            print(('[hm_mdt] ^1Locale parse error (%s): %s^7'):format(path, err2 or err))
        end
    end
else
    print(('[hm_mdt] ^1Locale file not found: %s — check files{} in fxmanifest^7'):format(path))
end

-- Key-Count für Debug
local count = 0
for _ in pairs(_G.Lang) do count = count + 1 end
print(('[hm_mdt] Locale loaded: %s (%d keys)'):format(locale, count))

-- Vergleicht die Key-Sets aller locales/*.lua-Dateien und warnt bei fehlenden Keys.
if IsDuplicityVersion() then
    CreateThread(function()
        local checkLocales = { 'de', 'en' } -- bei weiteren Sprachen hier ergänzen
        local keysByLocale = {}
        for _, loc in ipairs(checkLocales) do
            local raw = LoadResourceFile(res, ('locales/%s.lua'):format(loc))
            local keys = {}
            if raw then
                for k in raw:gmatch("Lang%['([%w_]+)'%]%s*=") do
                    keys[k] = true
                end
            end
            keysByLocale[loc] = keys
        end
        for i = 1, #checkLocales do
            for j = 1, #checkLocales do
                if i ~= j then
                    local a, b = checkLocales[i], checkLocales[j]
                    local missing = {}
                    for k in pairs(keysByLocale[a]) do
                        if not keysByLocale[b][k] then missing[#missing + 1] = k end
                    end
                    if #missing > 0 then
                        table.sort(missing)
                        print(('[hm_mdt] ^3Locale-Drift: %s hat %d Key(s), die in %s fehlen: %s^7'):format(a, #missing, b, table.concat(missing, ', ')))
                    end
                end
            end
        end
    end)
end

---Übersetzt einen Locale-Key, optional mit string.format-Parametern
_G._T = function(key, ...)
    local val = _G.Lang[key]
    if not val then
        print(('[hm_mdt] ^3Missing locale key: %s^7'):format(tostring(key)))
        return tostring(key)
    end
    local argCount = select('#', ...)
    if argCount > 0 then
        local ok, result = pcall(string.format, val, ...)
        if ok then return result end
    end
    return val
end
