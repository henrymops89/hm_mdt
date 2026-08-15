fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'hm_mdt'
description 'HM Mobile Data Terminal'
version '1.0.0'
author 'MopsScripts'

shared_scripts {
    '@ox_lib/init.lua',
    '@hm_lib/imports.lua',
    'config.lua',
    'config/penal_code.lua',
    'shared/locale.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/core/migrations.lua',
    'server/core/duty.lua',
    'server/core/jail.lua',
    'server/core/utils.lua',
    'server/core/access.lua',
    'server/profiles.lua',
    'server/records.lua',
    'server/vehicles.lua',
    'server/warrants_bolos.lua',
    'server/properties.lua',
    'server/weapons.lua',
    'server/evidences.lua',
    'server/reports.lua',
    'server/cases.lua',
    'server/penal_code.lua',
    'server/judgments.lua',
    'server/audit.lua',
    'server/mugshot.lua',
    'server/dashboard.lua',
}

client_scripts {
    'client/core/main.lua',
    'client/core/exports.lua',
    'client/core/mugshot.lua',
    'client/callbacks/*.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/mdt.css',
    'html/mdt.js',
    'html/img/*.png',
    'html/img/*.jpg',
    'html/img/*.webp',
    'locales/*.lua',
}

dependencies {
    'hm_lib',
    'oxmysql',
}

escrow_ignore {
    'config.lua',
    'config/*.lua',
    'shared/*.lua',
    'locales/*.lua',
}
