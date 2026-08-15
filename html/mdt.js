// ══════════════════════════════════════════════════════════════════
//  HM Police — MDT (Mobile Data Terminal)
//  NUI Logic: tabs, search, profile view, modals
// ══════════════════════════════════════════════════════════════════
'use strict';

const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

// Verzögert einen Funktionsaufruf, bis `delay`ms lang keine neue Eingabe kam —
// verhindert einen Server-Roundtrip pro Tastendruck bei den Suchfeldern.
function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

// ── Theme (Light/Dark) ───────────────────────────────────────────
// Sofort beim Skript-Start angewendet (vor dem ersten Paint), damit die NUI
// nicht kurz hell aufblitzt, bevor Dark Mode nachträglich greift.
const THEME_STORAGE_KEY = 'hm_mdt_theme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('#mdtThemeToggle');
    if (btn) btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
}

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light');

// ── NUI Post ─────────────────────────────────────────────────────

function nuiPost(endpoint, data) {
    const resName = (typeof GetParentResourceName !== 'undefined') ? GetParentResourceName() : 'hm_mdt';
    return fetch(`https://${resName}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
    }).then(r => r.json()).catch(err => { console.error('[MDT] nuiPost error:', endpoint, err); return null; });
}

// ── Locale System ────────────────────────────────────────────────

let _locale = {};
let _penalCode = [];
let _access = { tabs: 'all', actions: 'all', role: 'police' };
let _canManageSettings = false;
let _dateLocale      = 'de-DE';
let _dateFormat      = '%d.%m.%Y';
let _timeFormat      = '%H:%M';
let _dateTimeFormat  = '%d.%m.%Y %H:%M';
let _fivemanageKey   = '';
let _officerGrade         = 999;
let _reportApproveMinGrade = 3;
let _ownCitizenId = '';

function L(key) {
    return _locale[key] || key;
}

// ── Date Formatting ─────────────────────────────────────────────

function formatDate(input) {
    if (!input) return '—';
    let d;
    if (typeof input === 'number') {
        d = new Date(input > 9999999999 ? input : input * 1000);
    } else if (typeof input === 'string') {
        d = new Date(input);
    } else {
        d = input;
    }
    if (isNaN(d.getTime())) return input || '—';
    return d.toLocaleDateString(_dateLocale);
}

function formatTime(input) {
    if (!input) return '—';
    let d;
    if (typeof input === 'number') {
        d = new Date(input > 9999999999 ? input : input * 1000);
    } else if (typeof input === 'string') {
        d = new Date(input);
    } else {
        d = input;
    }
    if (isNaN(d.getTime())) return input || '—';
    return d.toLocaleTimeString(_dateLocale, { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(input) {
    if (!input) return '—';
    let d;
    if (typeof input === 'number') {
        d = new Date(input > 9999999999 ? input : input * 1000);
    } else if (typeof input === 'string') {
        d = new Date(input);
    } else {
        d = input;
    }
    if (isNaN(d.getTime())) return input || '—';
    return d.toLocaleDateString(_dateLocale) + ' ' + d.toLocaleTimeString(_dateLocale, { hour: '2-digit', minute: '2-digit' });
}

// ── Lightbox ─────────────────────────────────────────────────────
function openLightbox(src) {
    const lb = document.getElementById('mdtLightbox');
    const img = document.getElementById('mdtLightboxImg');
    if (!lb || !img || !src) return;
    img.src = src;
    lb.style.display = 'flex';
}
// Alle MDT-Bilder per Event-Delegation klickbar machen
document.addEventListener('click', e => {
    const img = e.target.closest('img[data-lightbox]');
    if (img) { e.stopPropagation(); openLightbox(img.src); }
});

// Codeblöcke (RTE "Code Block"-Button) in Anzeigen per Klick kopierbar — nicht im
// aktiven Editor selbst (.mdt-rte-body), da dort ein Klick nur den Cursor setzen soll.
document.addEventListener('click', e => {
    const pre = e.target.closest(
        '.mdt-report-detail-content pre, .mdt-case-description pre, .mdt-note-card-body pre, .mdt-note-body pre'
    );
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent || '').then(() => {
        pre.classList.add('mdt-copied');
        setTimeout(() => pre.classList.remove('mdt-copied'), 700);
    }).catch(() => {});
});

// ── Card Photo Helper ────────────────────────────────────────────
// Gibt ein Foto-Div zurück wenn imageUrl vorhanden, sonst das Icon-Fallback
function cardPhoto(imageUrl, fallbackIcon, fallbackStyle) {
    if (imageUrl) {
        return `<div class="mdt-card-photo">
            <img src="${escHtml(imageUrl)}" alt="" data-lightbox style="cursor:zoom-in" onerror="this.parentElement.innerHTML='<i class=\\"fa-solid ${fallbackIcon || 'fa-user'}\\"></i>'">
        </div>`;
    }
    return `<div class="mdt-card-icon"${fallbackStyle ? ` style="${fallbackStyle}"` : ''}><i class="fa-solid ${fallbackIcon || 'fa-user'}"></i></div>`;
}

// ── Date helpers: konfiguriertes Format ↔ ISO ───────────────────
// Leitet Placeholder-String aus strftime-Format ab: %d→DD, %m→MM, %Y→YYYY, %H→HH, %M→mm
function datePlaceholder(fmt) {
    return (fmt || _dateFormat)
        .replace('%d','DD').replace('%m','MM').replace('%Y','YYYY')
        .replace('%H','HH').replace('%M','mm');
}
// Baut aus dem Format einen Regex + Gruppen-Mapping
function _parseFmtParts(fmt) {
    const sep = (fmt.replace(/%[A-Za-z]/g,'').match(/[^A-Za-z0-9]/)||['.'])[0];
    return { sep, parts: fmt.split(sep) };
}
// Konfiguriertes Datumsformat → YYYY-MM-DD
function deToISO(s, fmt) {
    if (!s || !s.trim()) return null;
    fmt = fmt || _dateFormat;
    const { sep, parts } = _parseFmtParts(fmt);
    const vals = s.trim().split(sep);
    if (vals.length < 3) return null;
    let d = '', m = '', y = '';
    parts.forEach((p, i) => {
        if (p === '%d') d = String(parseInt(vals[i] || '0', 10)).padStart(2, '0');
        else if (p === '%m') m = String(parseInt(vals[i] || '0', 10)).padStart(2, '0');
        else if (p === '%Y') y = (vals[i] || '').trim();
    });
    if (!d || !m || !y || y.length !== 4) return null;
    const result = `${y}-${m}-${d}`;
    const test = new Date(result + 'T12:00:00');
    if (isNaN(test.getTime())) return null;
    return result;
}
// Konfiguriertes Datum+Uhrzeit → ISO-String (YYYY-MM-DDTHH:MM)
function deToISODateTime(s, fmtDate) {
    if (!s || !s.trim()) return null;
    const parts = s.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const isoDate = deToISO(parts[0], fmtDate || _dateFormat);
    if (!isoDate) return null;
    return `${isoDate}T${parts[1]}`;
}
// ISO YYYY-MM-DD → konfiguriertes Datumsformat
function isoToDE(s, fmt) {
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    return (fmt || _dateFormat)
        .replace('%Y', m[1]).replace('%m', m[2]).replace('%d', m[3]);
}
// ISO-Datetime → konfiguriertes Datum+Uhrzeit
function isoToDeDateTime(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(_dateLocale) + ' ' +
           d.toLocaleTimeString(_dateLocale, { hour: '2-digit', minute: '2-digit' });
}

// ── Access Control ──────────────────────────────────────────────

function hasTabAccess(tab) {
    if (_access.tabs === 'all') return true;
    if (Array.isArray(_access.tabs)) return _access.tabs.includes(tab);
    return false;
}

function hasActionAccess(action) {
    if (_access.actions === 'all') return true;
    if (Array.isArray(_access.actions)) return _access.actions.includes(action);
    return false;
}

function applyAccessControl() {
    const OPS_TABS = ['dashboard','warrants','bolos','cases','judgments'];
    const REC_TABS = ['persons','vehicles','properties','weapons','evidences','reports','penalcode'];

    $$('.mdt-nav-item[data-tab]').forEach(btn => {
        const tab = btn.dataset.tab;
        if (tab === 'mdtsettings') {
            btn.style.display = _canManageSettings ? '' : 'none';
            return;
        }
        btn.style.display = hasTabAccess(tab) ? '' : 'none';
    });

    const opsVisible = OPS_TABS.some(t => hasTabAccess(t));
    const recVisible = REC_TABS.some(t => hasTabAccess(t));
    const opsEl = $('#sidebarSectionOps');
    const recEl = $('#sidebarSectionRec');
    if (opsEl) opsEl.style.display = opsVisible ? '' : 'none';
    if (recEl) recEl.style.display = recVisible ? '' : 'none';
    const canCreate = hasActionAccess('create');
    ['#warrantAddBtn', '#boloAddBtn', '#reportAddBtn', '#caseAddBtn',
     '#evidenceAddBtn', '#propertyAddBtn', '#weaponAddBtn'].forEach(sel => {
        const el = $(sel);
        if (el) el.style.display = canCreate ? '' : 'none';
    });
    const judgBtn = $('#judgIssueBtn');
    if (judgBtn) judgBtn.style.display = hasActionAccess('judgment_issue') ? '' : 'none';
    const judgAddBtns = ['#judgAddCitizenBtn', '#judgAddChargeBtn'];
    judgAddBtns.forEach(sel => {
        const el = $(sel);
        if (el) el.style.display = hasActionAccess('judgment_issue') ? '' : 'none';
    });
}

// Build penal code <select> options grouped by category
function buildPenalCodeOptions() {
    if (!_penalCode || !_penalCode.length) return '';
    let html = `<option value="">${L('mdt_penal_select')}</option>`;
    for (const cat of _penalCode) {
        html += `<optgroup label="${escHtml(cat.category)}">`;
        for (const o of cat.offenses) {
            html += `<option value="${escHtml(o.id)}" data-title="${escHtml(o.title)}" data-desc="${escHtml(o.desc || '')}" data-type="${o.type}" data-fine="${o.fine}" data-jail="${o.jail}">[${escHtml(o.id)}] ${escHtml(o.title)} — $${o.fine}${o.jail ? ' / ' + o.jail + ' ' + L('mdt_months') : ''}</option>`;
        }
        html += '</optgroup>';
    }
    return html;
}

// ── State ────────────────────────────────────────────────────────

let currentProfile = null;
let currentWarrantsList = [];
let currentBolosList = [];
let currentVehiclesList = [];

// ── Login Screen ─────────────────────────────────────────────────

let _loginPillClickable = false;

function setLoginPersonInfo(officerName, deptLabel) {
    const offEl = $('#mdtLoginOfficer');
    const deptEl = $('#mdtLoginDept');
    if (offEl)  offEl.textContent  = officerName || L('mdt_login_unknown_officer');
    if (deptEl) deptEl.textContent = deptLabel || '';
}

function updateLoginClock() {
    const el = $('#mdtLoginClock');
    if (el) el.textContent = formatTime(new Date());
}

function setLoginAvatarState(state) {
    // state: 'idle' | 'scanning' | 'success'
    const el = $('#mdtLoginAvatar');
    if (!el) return;
    el.classList.remove('mdt-login-avatar-scanning', 'mdt-login-avatar-success');
    if (state === 'scanning') el.classList.add('mdt-login-avatar-scanning');
    if (state === 'success') el.classList.add('mdt-login-avatar-success');
}

function setLoginAvatarImage(imageUrl) {
    const el = $('#mdtLoginAvatar');
    if (!el) return;
    el.innerHTML = imageUrl
        ? `<img src="${escHtml(imageUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
        : '<i class="fa-solid fa-user-shield"></i>';
}

function setLoginPill(text, mode) {
    // mode: 'status' | 'clickable' | 'success' | 'disabled'
    const pill = $('#mdtLoginPill');
    const textEl = $('#mdtLoginPillText');
    if (textEl) textEl.textContent = text;
    if (!pill) return;
    pill.classList.remove('mdt-login-pill-clickable', 'mdt-login-pill-success', 'mdt-login-pill-disabled');
    _loginPillClickable = mode === 'clickable';
    if (mode === 'clickable') pill.classList.add('mdt-login-pill-clickable');
    if (mode === 'success')   pill.classList.add('mdt-login-pill-success');
    if (mode === 'disabled')  pill.classList.add('mdt-login-pill-disabled');
}

// Beamter ist noch nicht im MDT-Dienst: Pille wird zum Sign-In-Button
function showSignInScreen(officerName, deptLabel, officerImage) {
    const screen = $('#mdt-login-screen');
    if (!screen) return;

    screen.classList.remove('mdt-login-fadeout');
    updateLoginClock();
    setLoginAvatarState('idle');
    setLoginAvatarImage(officerImage);
    setLoginPersonInfo(officerName, deptLabel);
    setLoginPill(L('mdt_login_signin_btn'), 'clickable');
}

// Beamter ist im MDT-Dienst (oder hat sich gerade eingedienst): Login-Sequenz
function runLoginSequence(officerName, deptLabel, officerImage) {
    const screen = $('#mdt-login-screen');
    if (!screen) return;

    screen.classList.remove('mdt-login-fadeout');
    updateLoginClock();
    setLoginAvatarState('scanning');
    setLoginAvatarImage(officerImage);
    setLoginPersonInfo(officerName, deptLabel);
    setLoginPill(L('mdt_login_connecting'), 'disabled');

    setTimeout(() => setLoginPill(L('mdt_login_verifying'), 'disabled'), 600);
    setTimeout(() => {
        setLoginAvatarState('success');
        setLoginPill(L('mdt_login_granted'), 'success');
    }, 1250);
    setTimeout(() => screen.classList.add('mdt-login-fadeout'), 1900);
}

window.signInMDT = function() {
    if (!_loginPillClickable) return; // Pille zeigt nur Status an, kein Klick-Ziel gerade
    setLoginAvatarState('scanning');
    setLoginPill(L('mdt_login_connecting'), 'disabled');
    nuiPost('mdtNuiSignIn').then(result => {
        if (!result || !result.success) {
            setLoginAvatarState('idle');
            setLoginPill(L('not_officer_job'), 'clickable');
        }
        // Bei Erfolg schickt Lua ein 'openMDT' NUI-Message mit Dashboard-Daten.
    });
};

window.signOutMDT = function() {
    nuiPost('mdtNuiSignOut');
};

// ── Open / Close ─────────────────────────────────────────────────

function openMDT(data) {
    const frame = $('#mdt-ipad-frame');
    frame.classList.remove('mdt-hidden');

    // Load locale
    if (data && data.locale) {
        _locale = data.locale;
        applyLocale();
    }

    if (data && data.needsSignIn) {
        showSignInScreen(data.officerName, data.deptLabel, data.officerImage);
        return;
    }

    runLoginSequence(data && data.officerName, data && data.deptLabel, data && data.officerImage);

    // Load penal code
    if (data && data.penalCode) {
        _penalCode = data.penalCode;
    }
    if (data) {
        _canEditPenal = data.canEditPenalCode || false;
    }

    // Load access level
    if (data && data.access) {
        _access = data.access;
        _canManageSettings = data.canManageSettings || false;
        applyAccessControl();
    }

    // Load date locale + format
    if (data && data.dateLocale)     _dateLocale     = data.dateLocale;
    if (data && data.dateFormat)     _dateFormat     = data.dateFormat;
    if (data && data.timeFormat)     _timeFormat     = data.timeFormat;
    if (data && data.dateTimeFormat) _dateTimeFormat = data.dateTimeFormat;
    if (data && data.fivemanageKey)        _fivemanageKey        = data.fivemanageKey;
    if (data && data.officerGrade != null) _officerGrade         = data.officerGrade;
    if (data && data.reportApproveMinGrade != null) _reportApproveMinGrade = data.reportApproveMinGrade;

    // Clock
    const now = new Date();
    const el = $('#mdtClock');
    if (el) el.textContent = formatTime(now) + ' | ' + formatDate(now);

    if (data) {
        const offName = $('#mdtOfficerName');
        if (offName && data.officerName) offName.textContent = data.officerName;

        const rankBadge = $('#mdtRankBadge');
        if (rankBadge && data.deptLabel) rankBadge.textContent = data.deptLabel;

        if (data.citizenid) _ownCitizenId = data.citizenid;
        const tbAvatar = $('#mdtTbAvatar');
        if (tbAvatar) {
            tbAvatar.innerHTML = data.officerImage
                ? `<img src="${escHtml(data.officerImage)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
                : '<i class="fa-solid fa-user"></i>';
        }
        
        const statRep = $('#statReports');
        if (statRep && data.stats) statRep.textContent = data.stats.records || 0;

        // Dashboard: Stats bar
        if (data.stats) {
            const s = data.stats;
            const setT = (id, v) => { const e = $('#' + id); if (e) e.textContent = v || 0; };
            setT('statProfiles', s.profiles);
            setT('statWarrants', s.openWarrants);
            setT('statArrestsWeek', s.arrestsWeek);
            setT('statStolenVeh', s.stolen);
            setT('statReportsCount', s.reportsWeek);
            setT('statOnlineOfficers', (data.activeOfficers || []).length);
        }

        // Dashboard: Active Officers
        const officers = data.activeOfficers || [];
        const offCount = $('#dashOfficerCount');
        if (offCount) offCount.textContent = officers.length;
        const offList = $('#dashOfficersList');
        if (offList) {
            if (officers.length) {
                offList.innerHTML = officers.map(o => `
                    <div class="mdt-officer-chip" ${o.cid ? `style="cursor:pointer" onclick="switchToPersonAndLoad('${escHtml(o.cid)}')"` : ''}>
                        <span class="mdt-officer-dot"></span>
                        ${escHtml(o.name)}${o.grade ? ` <span style="opacity:0.6;font-size:11px">· ${escHtml(o.grade)}</span>` : ''}
                    </div>
                `).join('');
            } else {
                offList.innerHTML = `<div style="color:var(--mdt-text-muted);font-size:13px">${L('mdt_no_officers_online')}</div>`;
            }
        }

        // Dashboard: Warrants column
        const warrants = data.warrants || [];
        warrants.forEach(w => { if (!currentWarrantsList.find(x => x.id === w.id)) currentWarrantsList.push(w); });
        const wce = $('#dashWarrantCount'); if (wce) wce.textContent = warrants.length;
        const wc = $('#dashWarrants');
        if (warrants.length) {
            wc.innerHTML = warrants.slice(0, 6).map(w => {
                const expired = isWarrantExpired(w);
                return `
                <div class="mdt-dash-item" style="cursor:pointer;${expired ? 'border-left:3px solid #FF3B30;' : ''}" onclick="viewWarrant(${w.id})">
                    <div class="mdt-dash-item-body">
                        <div class="mdt-dash-item-title" style="display:flex;align-items:center;gap:6px">
                            ${escHtml(w.subject || w.name || '')}
                            ${expired ? `<span style="background:#FF3B30;color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;white-space:nowrap"><i class="fa-solid fa-triangle-exclamation" style="margin-right:3px"></i>${L('mdt_warrant_expired') || 'Abgelaufen'}</span>` : ''}
                        </div>
                        <div class="mdt-dash-item-sub" style="${expired ? 'color:#FF3B30' : ''}">#${w.id || ''} · ${L('mdt_bolo_expires')}: ${formatDate(w.expiry)}</div>
                    </div>
                    <div class="mdt-dash-item-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                </div>`;
            }).join('');
        } else {
            wc.innerHTML = `<div class="mdt-empty"><p>${L("mdt_empty_warrants")}</p></div>`;
        }

        // Dashboard: Recent Reports column
        const reports = data.recentReports || [];
        const rce = $('#dashReportCount'); if (rce) rce.textContent = reports.length;
        const rc = $('#dashRecentRecords');
        if (reports.length) {
            rc.innerHTML = reports.slice(0, 6).map(r => {
                const date = formatDate(r.updated_at || r.created_at);
                const statusBadge = reportStatusBadge(r.status);
                return `
                <div class="mdt-dash-item" style="cursor:pointer" onclick="openReportDetail(${r.id})">
                    <div class="mdt-dash-item-body">
                        <div class="mdt-dash-item-title">${escHtml(r.title || '')} ${statusBadge}</div>
                        <div class="mdt-dash-item-sub">${reportTypeLabel(r.type)} · ${escHtml(r.officer || '')} · ${date}</div>
                    </div>
                    <div class="mdt-dash-item-arrow"><i class="fa-solid fa-chevron-right"></i></div>
                </div>`;
            }).join('');
        } else {
            rc.innerHTML = `<div class="mdt-empty"><p>${L("mdt_empty_reports")}</p></div>`;
        }

        // Dashboard: Dispatches pager
        const dispatches = data.dispatches || [];
        window._mdtDispatches = dispatches;
        window._mdtDispatchIdx = 0;
        $('#dashDispatchCount').textContent = dispatches.length;
        renderDispatchCard();

        // Dashboard: BOLOs section
        const bolos = data.bolos || [];
        bolos.forEach(b => { if (!currentBolosList.find(x => x.id === b.id)) currentBolosList.push(b); });
        $('#dashBoloCount').textContent = bolos.length;
        const bc = $('#dashBolos');
        if (bolos.length) {
            bc.innerHTML = bolos.slice(0, 5).map(b => {
                const typeClass = b.plate ? 'vehicle' : (b.type === 'citizen' ? 'citizen' : 'other');
                return `
                <div class="mdt-bolo-item" style="cursor:pointer" onclick="viewBolo(${b.id})">
                    <div class="mdt-bolo-title">${escHtml(b.title || b.plate || '')}</div>
                    <div class="mdt-bolo-meta">
                        #${b.id || ''} · <span class="mdt-type-badge ${typeClass}">${typeClass}</span>
                    </div>
                    ${b.description ? `<div class="mdt-bolo-desc">${stripHtml(b.description).substring(0, 120)}</div>` : ''}
                </div>`;
            }).join('');
        } else {
            bc.innerHTML = `<div class="mdt-empty"><p>${L("mdt_empty_results")}</p></div>`;
        }

        if (data.warrants) renderWarrants(data.warrants);
        if (data.bolos) renderBolos(data.bolos);
    }
}

// ── Dispatch Pager ───────────────────────────────────────────────

window._mdtDispatches = [];
window._mdtDispatchIdx = 0;

function renderDispatchCard() {
    const card = $('#dashDispatchCard');
    const counter = $('#dispatchCounter');
    const list = window._mdtDispatches || [];
    const idx = window._mdtDispatchIdx || 0;

    if (!list.length) {
        card.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-tower-broadcast"></i><p>${L("mdt_empty_dispatches")}</p></div>`;
        if (counter) counter.textContent = '0 / 0';
        return;
    }

    const d = list[idx];
    const color = d.priority === 'high' ? 'red' : d.priority === 'low' ? 'blue' : d.priority === 'critical' ? 'red' : 'orange';
    const priorityLabel = d.priority === 'high' ? 'DRINGEND' : d.priority === 'critical' ? 'KRITISCH' : d.priority === 'low' ? 'NIEDRIG' : 'MITTEL';

    card.innerHTML = `
        <div class="mdt-dc-priority ${color}">
            <div class="mdt-dc-priority-dot ${color}"></div>
            ${priorityLabel}
        </div>
        <div class="mdt-dc-title">${escHtml(d.title || d.code || L('mdt_sidebar_dashboard'))}</div>
        <div class="mdt-dc-location">
            <i class="fa-solid fa-location-dot"></i>
            ${escHtml(d.location || L('mdt_unknown'))}
        </div>
        <div class="mdt-dc-time"><i class="fa-regular fa-clock"></i> ${escHtml(d.time || '')}</div>
        ${d.code ? `<span class="mdt-dc-code">${escHtml(d.code)}</span>` : ''}
        ${d.description ? `<div class="mdt-dc-desc">${escHtml(d.description)}</div>` : ''}
    `;
    card.style.animation = 'none';
    card.offsetHeight; // reflow
    card.style.animation = '';

    if (counter) counter.textContent = `${idx + 1} / ${list.length}`;
}

function dispatchPrev() {
    const list = window._mdtDispatches || [];
    if (!list.length) return;
    window._mdtDispatchIdx = (window._mdtDispatchIdx - 1 + list.length) % list.length;
    renderDispatchCard();
}

function dispatchNext() {
    const list = window._mdtDispatches || [];
    if (!list.length) return;
    window._mdtDispatchIdx = (window._mdtDispatchIdx + 1) % list.length;
    renderDispatchCard();
}

// Button handlers
document.addEventListener('click', e => {
    if (e.target.closest('#dispatchPrev')) dispatchPrev();
    if (e.target.closest('#dispatchNext')) dispatchNext();
});

// Keyboard: Arrow keys when MDT is open and on dashboard
document.addEventListener('keydown', e => {
    const frame = $('#mdt-ipad-frame');
    if (!frame || frame.classList.contains('mdt-hidden')) return;
    const dashTab = $('#tab-dashboard');
    if (!dashTab || !dashTab.classList.contains('active')) return;

    if (e.key === 'ArrowRight') { e.preventDefault(); dispatchNext(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); dispatchPrev(); }
});

// ── Close / Open ────────────────────────────────────────────────

function closeMDT() {
    $('#mdt-ipad-frame').classList.add('mdt-hidden');
    $('#profileOverlay').classList.add('mdt-hidden');
    nuiPost('mdtClose');
}

// Close via iPad home button
$('#mdt-ipad-frame').querySelector('.mdt-ipad-home').addEventListener('click', closeMDT);

// ── Tab Switching ────────────────────────────────────────────────

$$('.mdt-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.mdt-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.mdt-tab').forEach(t => t.classList.remove('active'));
        const tab = $(`#tab-${btn.dataset.tab}`);
        if (tab) tab.classList.add('active');
        $('#profileOverlay').classList.add('mdt-hidden');

        // Auto-load penal code when tab is opened
        if (btn.dataset.tab === 'penalcode') loadPenalCodeTab();
        // Auto-load access roles when settings tab is opened
        if (btn.dataset.tab === 'mdtsettings') loadAccessRoles();
    });
});

// ── Profile Tabs ─────────────────────────────────────────────────

// Scroll arrows for citizen profile tabs
(function() {
    const bar = $('#citizenTabsBar');
    const leftBtn = $('#citizenTabsLeft');
    const rightBtn = $('#citizenTabsRight');
    if (!bar || !leftBtn || !rightBtn) return;

    const SCROLL_STEP = 150;

    function updateArrows() {
        const atStart = bar.scrollLeft <= 5;
        const atEnd = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 5;
        leftBtn.classList.toggle('mdt-hidden', atStart);
        rightBtn.classList.toggle('mdt-hidden', atEnd);
    }

    leftBtn.addEventListener('click', () => { bar.scrollLeft -= SCROLL_STEP; });
    rightBtn.addEventListener('click', () => { bar.scrollLeft += SCROLL_STEP; });
    bar.addEventListener('scroll', updateArrows);

    // Initial check after profile loads
    const observer = new MutationObserver(() => { setTimeout(updateArrows, 50); });
    observer.observe(bar, { childList: true, subtree: true });
    setTimeout(updateArrows, 200);
})();

$$('.mdt-ptab').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.mdt-ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.mdt-ptab-content').forEach(c => c.classList.remove('active'));
        const tab = $(`#ptab-${btn.dataset.ptab}`);
        if (tab) tab.classList.add('active');
    });
});

// ── Close ────────────────────────────────────────────────────────

const closeBtn = $('#mdtCloseBtn');
if (closeBtn) closeBtn.addEventListener('click', closeMDT);
$('#profileBackBtn').addEventListener('click', () => {
    $('#profileOverlay').classList.add('mdt-hidden');
});

// Citizen profile sub-tab switching
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-ptab]');
    if (!btn) return;
    $$('[data-ptab]').forEach(b => b.classList.remove('active'));
    $$('.mdt-ptab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('ptab-' + btn.dataset.ptab);
    if (target) target.classList.add('active');

    // Verlauf/Audit-Log wird nicht mit dem restlichen Profil mitgeladen (eigener
    // Server-Call) — erst beim tatsächlichen Öffnen des Tabs nachladen.
    if (btn.dataset.ptab === 'phistory' && currentProfile && currentProfile.profile) {
        nuiPost('mdtNuiGetAuditLog', { entity_type: 'profile', entity_id: currentProfile.profile.citizenid })
            .then(logs => renderProfileHistory(logs || []));
    }
});

function renderProfileHistory(logs) {
    const container = $('#ptab-phistory');
    if (!container) return;
    if (!logs.length) {
        container.innerHTML = `<div class="mdt-empty" style="padding:20px"><i class="fa-solid fa-clock-rotate-left"></i><p>${L('mdt_audit_empty')}</p></div>`;
        return;
    }
    container.innerHTML = `<div style="padding:12px">${logs.map(t => `
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--mdt-veil-3);font-size:13px">
            <div style="color:var(--mdt-text-muted);min-width:130px">${formatDateTime(t.created_at)}</div>
            <div style="flex:1">
                <strong>${escHtml(t.officer || '')}</strong>
                <span style="color:var(--mdt-text-muted);margin-left:4px">${escHtml(t.action || '')}</span>
                ${t.details ? `<span style="color:var(--mdt-text-secondary)"> — ${escHtml(t.details)}</span>` : ''}
            </div>
        </div>
    `).join('')}</div>`;
}

// ── Person Search ────────────────────────────────────────────────

$('#personSearchBtn').addEventListener('click', searchPerson);
$('#personSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchPerson(); });
$('#personSearchInput').addEventListener('input', debounce(() => {
    const v = $('#personSearchInput').value.trim();
    if (v.length < 2) { $('#personResults').innerHTML = ''; return; }
    searchPerson();
}, 250));

async function searchPerson() {
    const query = $('#personSearchInput').value.trim();
    if (query.length < 2) return;
    const data = await nuiPost('mdtNuiSearchPerson', { query });
    renderPersonResults(data && data.results ? data.results : []);
}

function renderPersonResults(results) {
    const container = $('#personResults');
    results = results.filter(p => p.name && p.name.trim() !== '' && p.name.trim() !== p.citizenid);
    if (!results.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-user-slash"></i><p>${L('mdt_empty_results')}</p></div>`;
        return;
    }
    container.innerHTML = results.map(p => {
        const wanted = p.wanted_level > 0
            ? `<span class="mdt-badge-pill mdt-badge-red">W${p.wanted_level}</span>` : '';
        const license = p.license_status !== 'valid'
            ? `<span class="mdt-badge-pill mdt-badge-orange">${p.license_status}</span>` : '';
        return `
        <div class="mdt-card" onclick="loadProfile('${p.citizenid}')">
            ${cardPhoto(p.image_url, 'fa-user')}
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(p.name || p.citizenid)}</div>
                <div class="mdt-card-sub">${escHtml(p.citizenid)}${p.dob ? ' · ' + escHtml(p.dob) : ''}</div>
            </div>
            <div class="mdt-card-badges">${wanted}${license}</div>
        </div>`;
    }).join('');
}

// ── Load Profile ─────────────────────────────────────────────────

window.loadProfile = async function(citizenid) {
    const data = await nuiPost('mdtNuiGetProfile', { citizenid });
    if (!data || !data.profile) return;

    currentProfile = data;
    const p = data.profile;

    // Parse name parts
    const firstName = p.firstname || (p.name ? p.name.split(' ')[0] : '');
    const lastName = p.lastname || (p.name ? p.name.split(' ').slice(1).join(' ') : '');

    // Header fields
    $('#profileFirstName').textContent = firstName || '—';
    $('#profileLastName').textContent = lastName || '—';
    $('#profileDob').textContent = p.dob || '—';
    $('#profileGender').textContent = p.gender === 'female' ? L('mdt_gender_female') : p.gender === 'diverse' ? L('mdt_gender_diverse') : L('mdt_gender_male');
    $('#profileNationality').textContent = p.nationality || '—';
    $('#profileJob').textContent = p.job || '—';
    $('#profileCid').textContent = p.citizenid;

    // Status badge
    const statusEl = $('#profileStatusBadge');
    const status = p.status || 'neutral';
    const statusMap = {
        neutral:  { color: 'green',  label: L('mdt_status_neutral') },
        suspect:  { color: 'orange', label: L('mdt_status_suspect') },
        criminal: { color: 'red',    label: L('mdt_status_criminal') },
        wanted:   { color: 'red',    label: L('mdt_status_wanted') },
        deceased: { color: 'blue',   label: L('mdt_status_deceased') },
    };
    const s = statusMap[status] || statusMap.neutral;
    statusEl.innerHTML = `<span class="mdt-badge-pill mdt-badge-${s.color}">${s.label}</span>`;

    // Avatar
    const avatar = $('#profileAvatar');
    if (p.image_url && p.image_url !== '') {
        avatar.innerHTML = `<img src="${escHtml(p.image_url)}" alt="mugshot" data-lightbox style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">`;
    } else {
        avatar.innerHTML = '<i class="fa-solid fa-user"></i>';
    }

    // Sub-Tab: Vehicles
    const vehicles = data.vehicles || [];
    $('#vehicleCount').textContent = vehicles.length;
    renderProfileVehicles(vehicles);

    // Sub-Tab: Properties
    const properties = data.properties || [];
    $('#pPropertyCount').textContent = properties.length;
    renderProfileProperties(properties);

    // Sub-Tab: Licenses
    const licenses = data.licenses || [];
    $('#pLicenseCount').textContent = licenses.length;
    renderProfileLicenses(licenses);

    // Sub-Tab: Records (Judgments)
    const records = data.records || [];
    $('#recordCount').textContent = records.length;
    renderRecords(records);

    // Sub-Tab: Warrants
    const warrants = data.warrants || [];
    $('#pWarrantCount').textContent = warrants.length;
    renderProfileWarrants(warrants);

    // Sub-Tab: Reports (notes from old system)
    const reports = data.reports || [];
    $('#pReportCount').textContent = reports.length;
    renderProfileReports(reports);

    // Sub-Tab: Judgments
    const judgmentsData = data.judgments || [];
    renderProfileJudgments(judgmentsData);

    // Notes
    renderProfileNotes(data.notes || []);

    // Show overlay & reset to first tab
    $('#profileOverlay').classList.remove('mdt-hidden');
    $$('.mdt-ptab').forEach(b => b.classList.remove('active'));
    $$('.mdt-ptab-content').forEach(c => c.classList.remove('active'));
    $('.mdt-ptab[data-ptab="pvehicles"]').classList.add('active');
    $('#ptab-pvehicles').classList.add('active');
};

// ── Render Sub-Tab: Records (Judgments) ──────────────────────────

function renderRecords(records) {
    const container = $('#ptab-precords');
    const addBtn = `<div style="margin-bottom:12px"><button class="mdt-btn mdt-btn-primary" onclick="openAddRecordModal()"><i class="fa-solid fa-plus"></i> ${L('mdt_btn_create_record')}</button></div>`;
    if (!records.length) {
        container.innerHTML = addBtn + `<div class="mdt-empty"><i class="fa-solid fa-check-circle"></i><p>${L('mdt_empty_records')}</p></div>`;
        return;
    }
    container.innerHTML = addBtn + records.map(r => {
        const typeClass = r.type === 'arrest' ? 'arrest' : r.type === 'citation' ? 'citation' : 'warning';
        const typeIcon = r.type === 'arrest' ? 'handcuffs' : r.type === 'citation' ? 'file-invoice-dollar' : 'triangle-exclamation';
        const date = r.timestamp ? formatDate(r.timestamp) : '';
        const fines = [];
        if (r.fine > 0) fines.push(`<span class="mdt-fine-tag money">$${r.fine.toLocaleString()}</span>`);
        if (r.jail_time > 0) fines.push(`<span class="mdt-fine-tag jail">${r.jail_time} ${L('mdt_months')}</span>`);
        return `
        <div class="mdt-record">
            <div class="mdt-record-type ${typeClass}"><i class="fa-solid fa-${typeIcon}"></i></div>
            <div class="mdt-record-body">
                <div class="mdt-record-title">${escHtml(r.title)}</div>
                <div class="mdt-record-meta">
                    <span>${date}</span>
                    ${r.officer ? `<span>${escHtml(r.officer)}</span>` : ''}
                    <span class="mdt-badge-pill mdt-badge-${typeClass === 'arrest' ? 'red' : typeClass === 'citation' ? 'orange' : 'blue'}">${r.type}</span>
                </div>
                ${r.description ? `<div class="mdt-record-desc">${escHtml(r.description)}</div>` : ''}
                ${r.edit_log ? `<div class="mdt-record-desc" style="font-size:0.85em;opacity:0.6;margin-top:4px"><i>${escHtml(r.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-record-fines">
                ${fines.join('')}
                <button class="mdt-action-btn" style="margin-left:12px" onclick="editRecord(${r.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Vehicles ─────────────────────────────────────

function renderProfileVehicles(vehicles) {
    const container = $('#ptab-pvehicles');
    if (!vehicles.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-car"></i><p>${L('mdt_empty_vehicles')}</p></div>`;
        return;
    }
    container.innerHTML = vehicles.map(v => {
        const stolen = v.stolen ? `<span class="mdt-badge-pill mdt-badge-red">STOLEN</span>` : '';
        const statusBadge = `<span class="mdt-badge-pill mdt-badge-${v.stolen ? 'red' : 'green'}">${v.stolen ? L('mdt_vehicle_stolen_yes') : L('mdt_vehicle_stolen_no')}</span>`;
        return `
        <div class="mdt-card" onclick="openVehicleFromProfile('${escHtml(v.plate)}')" style="cursor:pointer">
            <div class="mdt-card-icon"><i class="fa-solid fa-car"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(v.model || L('mdt_unknown'))} <span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">${escHtml(v.plate)}</span></div>
                <div class="mdt-card-sub">${v.color ? escHtml(v.color) + ' · ' : ''}Klasse: ${escHtml(v.vehicle_class || '—')}</div>
            </div>
            <div class="mdt-card-badges">
                ${statusBadge}
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Properties ───────────────────────────────────

function renderProfileProperties(properties) {
    const container = $('#ptab-pproperties');
    if (!properties.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-house-chimney"></i><p>${L('mdt_empty_properties')}</p></div>`;
        return;
    }
    container.innerHTML = properties.map(p => {
        const statusColor = p.status === 'clear' ? 'green' : p.status === 'flagged' ? 'orange' : p.status === 'raid' ? 'red' : 'blue';
        return `
        <div class="mdt-card" onclick="openPropertyFromProfile(${p.id})" style="cursor:pointer">
            <div class="mdt-card-icon" style="background:rgba(90,200,250,0.1);color:#5AC8FA"><i class="fa-solid fa-house-chimney"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(p.address)}</div>
                <div class="mdt-card-sub">${escHtml(p.type || 'house')}</div>
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-${statusColor}">${escHtml(p.status || 'clear')}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Licenses ─────────────────────────────────────

function renderProfileLicenses(licenses) {
    const container = $('#ptab-plicenses');
    if (!licenses.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-id-card"></i><p>${L('mdt_empty_licenses')}</p></div>`;
        return;
    }
    container.innerHTML = licenses.map(l => {
        const statusColor = l.status === 'valid' ? 'green' : l.status === 'suspended' ? 'orange' : 'red';
        const typeLabel = l.type === 'driving' ? L('mdt_license_driving') : l.type === 'weapon' ? L('mdt_license_weapon') : l.type === 'pilot' ? L('mdt_license_pilot') : l.type === 'boat' ? L('mdt_license_boat') : l.type === 'hunting' ? L('mdt_license_hunting') : l.type === 'business' ? L('mdt_license_business') : escHtml(l.type);
        return `
        <div class="mdt-card">
            <div class="mdt-card-icon" style="background:rgba(52,199,89,0.1);color:#34C759"><i class="fa-solid fa-id-card"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${typeLabel}</div>
                <div class="mdt-card-sub">${l.issued_date ? 'Ausgestellt: ' + formatDate(l.issued_date) : ''} ${l.expire_date ? '· Ablauf: ' + formatDate(l.expire_date) : ''}</div>
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-${statusColor}">${escHtml(l.status)}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Warrants ─────────────────────────────────────

function renderProfileWarrants(warrants) {
    warrants.forEach(w => { if (!currentWarrantsList.find(x => x.id === w.id)) currentWarrantsList.push(w); });
    const container = $('#ptab-pwarrants');
    if (!warrants.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-gavel"></i><p>${L('mdt_empty_warrants')}</p></div>`;
        return;
    }
    container.innerHTML = warrants.map(w => {
        const prio = w.priority === 'high' ? 'red' : w.priority === 'medium' ? 'orange' : 'blue';
        const expired = isWarrantExpired(w);
        return `
        <div class="mdt-card" style="cursor:pointer${expired ? ';border-left:3px solid #FF3B30' : ''}" onclick="viewWarrant(${w.id})">
            <div class="mdt-card-icon" style="background:rgba(255,69,58,0.1);color:#FF3B30"><i class="fa-solid fa-gavel"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${stripHtml(w.charges || w.subject || '')}</div>
                <div class="mdt-card-sub">${escHtml(w.issued_by || '')} · ${formatDate(w.issued_date)}</div>
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-${prio}">${escHtml(w.priority || 'medium')}</span>
                <span class="mdt-badge-pill mdt-badge-${w.status === 'active' ? 'red' : 'green'}">${escHtml(w.status)}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Reports (in citizen profile) ────────────────

function renderProfileReports(reports) {
    const container = $('#ptab-preports');
    if (!reports.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-file-lines"></i><p>${L('mdt_empty_reports')}</p></div>`;
        return;
    }
    container.innerHTML = reports.map(r => {
        const date = formatDate(r.updated_at || r.created_at);
        const typeLabel = reportTypeLabel(r.type);
        const statusBadge = reportStatusBadge(r.status);
        return `
        <div class="mdt-card" style="cursor:pointer" onclick="openReportDetail(${r.id})">
            <div class="mdt-card-icon"><i class="fa-solid fa-file-lines"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(r.title)} ${statusBadge}</div>
                <div class="mdt-card-sub">${typeLabel} · ${escHtml(r.officer || '')} · ${date}</div>
                ${r.content ? `<div class="mdt-card-sub" style="margin-top:4px;opacity:0.7">${stripHtml(r.content).substring(0, 120)}...</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Render Sub-Tab: Judgments (in citizen profile) ───────────────

let _profileJudgments = [];

function renderProfileJudgments(judgments) {
    _profileJudgments = judgments || [];
    const container = $('#ptab-pjudgments');
    if (!container) return;
    if (!_profileJudgments.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-gavel"></i><p>${L('mdt_empty_judgments')}</p></div>`;
        return;
    }
    container.innerHTML = _profileJudgments.map((j, idx) => {
        const plea = j.plea_deal ? `<span class="mdt-badge-pill mdt-badge-green" style="font-size:9px">PLEA</span>` : '';
        const mult = j.multiplier && j.multiplier != 1.0 ? `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:9px">x${j.multiplier}</span>` : '';
        let chargeList = '';
        try { const ch = JSON.parse(j.charges); chargeList = ch.map(c => (c.count > 1 ? c.count + 'x ' : '') + (c.title || c.offense_id)).join(', '); } catch(e) { chargeList = ''; }
        return `
        <div class="mdt-card" style="cursor:pointer" onclick="viewJudgment(${idx})">
            <div class="mdt-card-icon"><i class="fa-solid fa-gavel"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">$${j.total_fine || 0} / ${j.total_jail || 0} ${L('mdt_months')} ${plea}${mult}</div>
                <div class="mdt-card-sub">${escHtml(j.officer || '')} · ${formatDate(j.created_at)}</div>
                <div class="mdt-card-sub" style="margin-top:4px;opacity:0.7;font-size:11px">${escHtml(chargeList).substring(0, 150)}</div>
                ${j.note ? `<div class="mdt-card-sub" style="margin-top:2px;font-style:italic">${escHtml(j.note).substring(0, 100)}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.viewJudgment = function(idx) {
    const j = _profileJudgments[idx];
    if (!j) return;
    const plea = j.plea_deal ? `<span class="mdt-badge-pill mdt-badge-green">PLEA DEAL</span>` : '';
    const mult = j.multiplier && j.multiplier != 1.0 ? `<span class="mdt-badge-pill mdt-badge-orange">Multiplikator x${j.multiplier}</span>` : '';
    let chargeRows = '';
    try {
        const ch = JSON.parse(j.charges);
        chargeRows = ch.map(c => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);font-size:13px">
            <span>${escHtml((c.count > 1 ? c.count + 'x ' : '') + (c.title || c.offense_id))}</span>
            <span style="color:var(--mdt-text-tertiary)">$${(c.fine||0).toLocaleString()} / ${c.jail||0} ${L('mdt_months')}</span>
        </div>`).join('');
    } catch(e) { chargeRows = `<div style="font-size:13px;color:var(--mdt-text-tertiary)">${escHtml(j.charges || '')}</div>`; }

    showModal(L('mdt_judgment_detail') || 'Urteil', `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${plea}${mult}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div style="background:var(--mdt-surface-alt);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#FF3B30">$${(j.total_fine||0).toLocaleString()}</div>
                <div style="font-size:11px;color:var(--mdt-text-tertiary);margin-top:2px">${L('mdt_judgment_fine') || 'Geldstrafe'}</div>
            </div>
            <div style="background:var(--mdt-surface-alt);border-radius:10px;padding:12px;text-align:center">
                <div style="font-size:22px;font-weight:700;color:#FF9500">${j.total_jail||0} ${L('mdt_months')}</div>
                <div style="font-size:11px;color:var(--mdt-text-tertiary);margin-top:2px">${L('mdt_judgment_jail') || 'Haftzeit'}</div>
            </div>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.3px;margin-bottom:8px">${L('mdt_judgment_charges') || 'Anklagepunkte'}</div>
        <div style="margin-bottom:16px">${chargeRows}</div>
        ${j.note ? `<div style="background:var(--mdt-surface-alt);border-radius:8px;padding:10px;font-size:13px;color:var(--mdt-text-secondary);font-style:italic">${escHtml(j.note)}</div>` : ''}
        <div style="margin-top:12px;font-size:12px;color:var(--mdt-text-muted)">${escHtml(j.officer||'')} · ${formatDate(j.created_at)}</div>
    `, null);
};

// ── Reports Tab (main RECORDS section) ──────────────────────────

function reportTypeLabel(type) {
    const map = {
        incident:      L('mdt_report_type_incident'),
        accident:      L('mdt_report_type_accident'),
        investigation: L('mdt_report_type_investigation'),
        search:        L('mdt_report_type_search'),
        other:         L('mdt_report_type_other')
    };
    return map[type] || type || '';
}

function reportStatusBadge(status) {
    const map = {
        draft:     { color: 'orange', label: L('mdt_report_status_draft') },
        submitted: { color: 'blue',   label: L('mdt_report_status_submitted') },
        approved:  { color: 'green',  label: L('mdt_report_status_approved') },
        rejected:  { color: 'red',    label: L('mdt_report_status_rejected') },
        archived:  { color: 'gray',   label: L('mdt_report_status_archived') }
    };
    const s = map[status] || map['draft'];
    return `<span class="mdt-badge-pill mdt-badge-${s.color}">${s.label}</span>`;
}

async function searchReport() {
    const query = $('#reportSearchInput').value.trim();
    if (query.length < 2) { $('#reportResults').innerHTML = ''; return; }
    const res = await nuiPost('mdtNuiSearchReport', { query });
    renderReportResults(res.results || []);
}

function renderReportResults(reports) {
    const container = $('#reportResults');
    if (!reports.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-file-lines"></i><p>${L('mdt_empty_reports')}</p></div>`;
        return;
    }
    container.innerHTML = reports.map(r => {
        const typeLabel = reportTypeLabel(r.type);
        const statusBadge = reportStatusBadge(r.status);
        const date = formatDate(r.updated_at || r.created_at);
        return `
        <div class="mdt-card" style="cursor:pointer" onclick="openReportDetail(${r.id})">
            <div class="mdt-card-icon"><i class="fa-solid fa-file-lines"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(r.title)} ${statusBadge}</div>
                <div class="mdt-card-sub">${typeLabel} · ${escHtml(r.officer || '')} · ${date}</div>
                ${(r.citizen_names || r.citizenids) ? `<div class="mdt-card-sub" style="margin-top:2px"><i class="fa-solid fa-user"></i> ${escHtml(r.citizen_names || r.citizenids)}</div>` : ''}
                ${r.vehicles ? `<div class="mdt-card-sub"><i class="fa-solid fa-car"></i> ${escHtml(r.vehicles)}</div>` : ''}
                ${r.content ? `<div class="mdt-card-sub" style="margin-top:4px;opacity:0.7">${stripHtml(r.content).substring(0, 150)}...</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Report Detail View ──────────────────────────────────────────

window.openReportDetail = async function(id) {
    const data = await nuiPost('mdtNuiGetReport', { id });
    const r = (data && data.report) ? data.report : data;
    if (!r || !r.id) return;

    const typeLabel = reportTypeLabel(r.type);
    const statusBadge = reportStatusBadge(r.status);
    const date = formatDate(r.updated_at || r.created_at);
    const links = data.links || [];
    const canEdit = hasActionAccess('edit');
    const canCreate = hasActionAccess('create');

    // Group links by type
    const linkTypes = ['officer', 'suspect', 'civilian', 'vehicle', 'weapon', 'evidence'];
    const linkLabels = {
        officer:  L('mdt_report_link_officers'),
        suspect:  L('mdt_report_link_suspects'),
        civilian: L('mdt_report_link_civilians'),
        vehicle:  L('mdt_report_link_vehicles'),
        weapon:   L('mdt_report_link_weapons'),
        evidence: L('mdt_report_link_evidence')
    };
    const linkIcons = { officer: 'fa-shield-halved', suspect: 'fa-user-secret', civilian: 'fa-user', vehicle: 'fa-car', weapon: 'fa-gun', evidence: 'fa-fingerprint' };
    const linkColors = { officer: '#007AFF', suspect: '#FF3B30', civilian: '#8E8E93', vehicle: '#34C759', weapon: '#FF9500', evidence: '#AF52DE' };

    let linksHtml = '';
    for (const lt of linkTypes) {
        const items = links.filter(l => l.link_type === lt);
        const chips = items.map(l => `
            <span class="mdt-report-link-chip">
                ${escHtml(l.label || l.link_id)}
                ${canEdit ? `<button class="mdt-report-link-chip-remove" onclick="removeReportLink(${l.id}, ${r.id})">×</button>` : ''}
            </span>`).join('');
        linksHtml += `
        <div class="mdt-report-link-section">
            <div class="mdt-report-link-header" style="color:${linkColors[lt] || '#8E8E93'}">
                <i class="fa-solid ${linkIcons[lt] || 'fa-link'}"></i>
                ${linkLabels[lt] || lt}
                ${items.length ? `<span class="mdt-count-badge">${items.length}</span>` : ''}
                ${canCreate ? `<button class="mdt-report-link-add" onclick="addReportLink(${r.id}, '${lt}')"><i class="fa-solid fa-plus"></i></button>` : ''}
            </div>
            ${chips ? `<div class="mdt-report-link-chips">${chips}</div>` : ''}
        </div>`;
    }

    showModal(escHtml(r.title), `
        <div class="mdt-report-detail-layout">
            <div class="mdt-report-detail-left">
                <div class="mdt-report-detail-meta">
                    ${statusBadge}
                    <span style="color:var(--mdt-text-muted);font-size:13px">${typeLabel} · ${escHtml(r.officer || '')} · ${date}</span>
                </div>
                ${r.location || r.occurred_at ? `
                <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--mdt-text-tertiary)">
                    ${r.location ? `<span><i class="fa-solid fa-location-dot" style="color:#007AFF;margin-right:4px"></i>${escHtml(r.location)}</span>` : ''}
                    ${r.occurred_at ? `<span><i class="fa-solid fa-clock" style="color:#FF9500;margin-right:4px"></i>${formatDateTime(r.occurred_at)}</span>` : ''}
                </div>` : ''}
                <div class="mdt-report-link-header" style="color:var(--mdt-text-muted)">${L('mdt_report_content')}</div>
                <div class="mdt-report-detail-content">${safeHtml(r.content || '')}</div>
            </div>
            <div class="mdt-report-detail-right">
                ${linksHtml}
            </div>
        </div>
    `, () => { hideModal(); openReportModal(r); }, { hideConfirm: !canEdit, confirmLabel: L('mdt_report_edit') });

    // Widen modal for two-column report detail layout
    const modalEl = $('.mdt-modal');
    if (modalEl) modalEl.classList.add('mdt-modal-wide');

    if (canEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            if (!confirm(L('mdt_report_confirm_delete'))) return;
            await nuiPost('mdtNuiDeleteReport', { id: r.id });
            hideModal();
            searchReport();
        });
    }
};

// ── Report Link Management ───────────────────────────────────────

window.addReportLink = function(reportId, linkType) {
    const isPerson  = ['officer', 'suspect', 'civilian'].includes(linkType);
    const isVehicle = linkType === 'vehicle';
    const usesSearch = isPerson || isVehicle;

    const placeholder = isPerson   ? 'Name eingeben...'
                      : isVehicle  ? 'Kennzeichen eingeben...'
                      : linkType === 'weapon' ? L('mdt_search_weapon') : L('mdt_search_evidence');

    showModal(L('mdt_report_link_add'), `
        <div class="mdt-form-group" style="position:relative">
            <label class="mdt-form-label">${
                isPerson ? L('mdt_search_person') : isVehicle ? L('mdt_search_vehicle')
                : linkType === 'weapon' ? L('mdt_search_weapon') : L('mdt_search_evidence')
            }</label>
            <input class="mdt-form-input" id="modalRepLinkSearch" placeholder="${placeholder}" autocomplete="off">
            ${usesSearch ? `<div id="modalRepLinkDrop" class="mdt-ac-drop"></div>` : ''}
        </div>
        <input type="hidden" id="modalRepLinkId">
        <input type="hidden" id="modalRepLinkLabel">
    `, async () => {
        const linkId = usesSearch ? $('#modalRepLinkId').value.trim() : $('#modalRepLinkSearch').value.trim();
        if (!linkId) return;
        const label  = usesSearch ? $('#modalRepLinkLabel').value.trim() : linkId;
        await nuiPost('mdtNuiAddReportLink', { report_id: reportId, link_type: linkType, link_id: linkId, label });
        hideModal();
        openReportDetail(reportId);
    });

    if (!usesSearch) return;

    setTimeout(() => {
        const searchEl = $('#modalRepLinkSearch');
        const dropEl   = $('#modalRepLinkDrop');
        const idEl     = $('#modalRepLinkId');
        const labelEl  = $('#modalRepLinkLabel');
        if (!searchEl || !dropEl) return;

        let debounce;
        searchEl.addEventListener('input', () => {
            clearTimeout(debounce);
            idEl.value = ''; labelEl.value = '';
            const q = searchEl.value.trim();
            if (q.length < 2) { dropEl.style.display = 'none'; return; }
            debounce = setTimeout(async () => {
                let items = [];
                if (isPerson) {
                    const data = await nuiPost('mdtNuiSearchPerson', { query: q });
                    items = (data && data.results ? data.results : [])
                        .filter(p => p.name && p.name.trim() && p.name !== p.citizenid)
                        .map(p => ({ id: p.citizenid, label: p.name, sub: p.citizenid }));
                } else {
                    const data = await nuiPost('mdtNuiSearchVehicle', { plate: q });
                    items = (data && data.results ? data.results : [])
                        .map(v => ({ id: v.plate, label: v.plate, sub: v.owner_name || v.model || '' }));
                }
                if (!items.length) { dropEl.style.display = 'none'; return; }
                dropEl.innerHTML = items.slice(0, 8).map(it =>
                    `<div class="mdt-ac-item" data-id="${escHtml(it.id)}" data-label="${escHtml(it.label)}">
                        <strong>${highlightMatch(it.label, q)}</strong>
                        <span class="mdt-ac-item-sub">${escHtml(it.sub)}</span>
                    </div>`
                ).join('');
                dropEl.style.display = 'block';
            }, 250);
        });
        dropEl.addEventListener('mousedown', e => {
            const item = e.target.closest('.mdt-ac-item');
            if (!item) return;
            e.preventDefault();
            idEl.value    = item.dataset.id;
            labelEl.value = item.dataset.label;
            searchEl.value = item.dataset.label;
            dropEl.style.display = 'none';
        });
        searchEl.addEventListener('blur', () => setTimeout(() => dropEl.style.display = 'none', 150));
    }, 50);
};

window.removeReportLink = async function(linkId, reportId) {
    await nuiPost('mdtNuiRemoveReportLink', { id: linkId });
    openReportDetail(reportId);
};

// ── Report Create/Edit Modal ────────────────────────────────────

function openReportModal(existing) {
    const isEdit = !!existing;
    const r = existing || {};

    showModal(isEdit ? L('mdt_report_edit') : L('mdt_report_add'), `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group" style="grid-column:span 2">
                <label class="mdt-form-label">${L('mdt_report_title')}</label>
                <input class="mdt-form-input" id="modalReportTitle" value="${escHtml(r.title || '')}" placeholder="...">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_report_type')}</label>
                <select class="mdt-form-select" id="modalReportType">
                    <option value="incident" ${!r.type || r.type==='incident' ? 'selected':''}>${L('mdt_report_type_incident')}</option>
                    <option value="accident" ${r.type==='accident' ? 'selected':''}>${L('mdt_report_type_accident')}</option>
                    <option value="investigation" ${r.type==='investigation' ? 'selected':''}>${L('mdt_report_type_investigation')}</option>
                    <option value="search" ${r.type==='search' ? 'selected':''}>${L('mdt_report_type_search')}</option>
                    <option value="other" ${r.type==='other' ? 'selected':''}>${L('mdt_report_type_other')}</option>
                </select>
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_report_status')}</label>
                <select class="mdt-form-select" id="modalReportStatus">
                    <option value="draft" ${!r.status || r.status==='draft' ? 'selected':''}>${L('mdt_report_status_draft')}</option>
                    <option value="submitted" ${r.status==='submitted' ? 'selected':''}>${L('mdt_report_status_submitted')}</option>
                    ${_officerGrade < _reportApproveMinGrade ? `
                    <option value="approved" ${r.status==='approved' ? 'selected':''}>${L('mdt_report_status_approved')}</option>
                    <option value="rejected" ${r.status==='rejected' ? 'selected':''}>${L('mdt_report_status_rejected')}</option>
                    <option value="archived" ${r.status==='archived' ? 'selected':''}>${L('mdt_report_status_archived')}</option>
                    ` : ''}
                </select>
            </div>
            <div class="mdt-form-group" style="grid-column:span 2">
                <label class="mdt-form-label">${L('mdt_report_location')} <span style="font-weight:400;text-transform:none;opacity:0.6">(optional)</span></label>
                <input class="mdt-form-input" id="modalReportLocation" value="${escHtml(r.location || '')}" placeholder="z.B. Legion Square, Sandy Shores...">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_report_occurred_at')} <span style="font-weight:400;text-transform:none;opacity:0.6">(optional)</span></label>
                <input class="mdt-form-input" id="modalReportOccurredAt" type="text" placeholder="${datePlaceholder(_dateTimeFormat)}" value="${escHtml(r.occurred_at ? isoToDeDateTime(r.occurred_at) : '')}">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_report_citizens')}</label>
                <div id="citizenTagsWrap" style="display:flex;flex-wrap:wrap;gap:5px;min-height:0"></div>
                <div style="position:relative">
                    <input class="mdt-form-input" id="modalReportCitizenSearch" placeholder="Name eingeben...">
                    <div id="citizenDropdown" class="mdt-ac-drop"></div>
                </div>
                <input type="hidden" id="modalReportCitizens" value="${escHtml(r.citizenids || '')}">
                <input type="hidden" id="modalReportCitizenNames" value="${escHtml(r.citizen_names || '')}">
            </div>
            <div class="mdt-form-group" style="grid-column:span 2">
                <label class="mdt-form-label">${L('mdt_report_vehicles')} <span style="font-weight:400;text-transform:none;opacity:0.6">(optional)</span></label>
                <div id="vehicleTagsWrap" style="display:flex;flex-wrap:wrap;gap:5px;min-height:0"></div>
                <div style="position:relative">
                    <input class="mdt-form-input" id="modalReportVehicleSearch" placeholder="Kennzeichen eingeben...">
                    <div id="vehicleDropdown" class="mdt-ac-drop"></div>
                </div>
                <input type="hidden" id="modalReportVehicles" value="${escHtml(r.vehicles || '')}">
            </div>
            <div class="mdt-form-group" style="grid-column:span 2">
                <label class="mdt-form-label">${L('mdt_report_content')}</label>
                <div id="rteReportContent"></div>
            </div>
        </div>
    `, async () => {
        const title = $('#modalReportTitle').value.trim();
        if (!title) return;
        const rteBody = $('#rteReportContent_body');
        const payload = {
            title,
            type: $('#modalReportType').value,
            status: $('#modalReportStatus').value,
            location: ($('#modalReportLocation').value || '').trim(),
            occurred_at: deToISODateTime(($('#modalReportOccurredAt').value || '').trim()) || null,
            citizenids: $('#modalReportCitizens').value.trim(),
            citizen_names: ($('#modalReportCitizenNames') ? $('#modalReportCitizenNames').value.trim() : ''),
            vehicles: $('#modalReportVehicles').value.trim(),
            content: rteBody ? rteBody.innerHTML.trim() : ''
        };
        if (isEdit) {
            payload.id = r.id;
            await nuiPost('mdtNuiUpdateReport', payload);
        } else {
            await nuiPost('mdtNuiCreateReport', payload);
        }
        hideModal();
        const searchInput = $('#reportSearchInput');
        if (!searchInput.value.trim() && title) searchInput.value = title;
        searchReport();
    });

    // Widen modal — zweispaltiges Formular passt sonst nicht in die Standardbreite
    const modalEl = $('.mdt-modal');
    if (modalEl) modalEl.classList.add('mdt-modal-wide');

    // Initialize RTE + autocomplete after modal is shown
    setTimeout(() => {
        createRTE('rteReportContent', L('mdt_report_content_hint'), r.content || '');

        // ── Personen Autocomplete ────────────────────────────────
        const citizenSearch = $('#modalReportCitizenSearch');
        const citizenDrop   = $('#citizenDropdown');
        const citizenTags   = $('#citizenTagsWrap');
        const citizenHidden = $('#modalReportCitizens');

        const selCitizens = {}; // cid → name
        (citizenHidden.value || '').split(',').map(s => s.trim()).filter(Boolean).forEach(cid => { selCitizens[cid] = cid; });

        function renderCitizenTags() {
            citizenTags.innerHTML = Object.entries(selCitizens).map(([cid, name]) =>
                `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,122,255,0.1);color:#007AFF;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">
                    ${escHtml(name)}
                    <button data-cid="${escHtml(cid)}" class="rm-citizen" style="background:none;border:none;color:#007AFF;cursor:pointer;font-size:13px;line-height:1;padding:0">×</button>
                </span>`
            ).join('');
            citizenHidden.value = Object.keys(selCitizens).join(', ');
            const namesEl = $('#modalReportCitizenNames');
            if (namesEl) namesEl.value = Object.values(selCitizens).join(', ');
        }
        citizenTags.addEventListener('click', e => {
            const btn = e.target.closest('.rm-citizen');
            if (btn) { delete selCitizens[btn.dataset.cid]; renderCitizenTags(); }
        });

        let cDebounce;
        citizenSearch.addEventListener('input', () => {
            clearTimeout(cDebounce);
            const q = citizenSearch.value.trim();
            if (q.length < 2) { citizenDrop.style.display = 'none'; return; }
            cDebounce = setTimeout(async () => {
                const data = await nuiPost('mdtNuiSearchPerson', { query: q });
                const res = (data && data.results ? data.results : []).filter(p => p.name && p.name.trim() && p.name !== p.citizenid);
                if (!res.length) { citizenDrop.style.display = 'none'; return; }
                citizenDrop.innerHTML = res.slice(0, 8).map(p =>
                    `<div class="mdt-ac-item" data-id="${escHtml(p.citizenid)}" data-label="${escHtml(p.name)}">
                        <strong>${highlightMatch(p.name, q)}</strong><span class="mdt-ac-item-sub">${escHtml(p.citizenid)}</span>
                    </div>`
                ).join('');
                citizenDrop.style.display = 'block';
            }, 250);
        });
        citizenDrop.addEventListener('mousedown', e => {
            const item = e.target.closest('.mdt-ac-item');
            if (!item) return;
            e.preventDefault();
            selCitizens[item.dataset.id] = item.dataset.label;
            renderCitizenTags();
            citizenSearch.value = '';
            citizenDrop.style.display = 'none';
        });
        citizenSearch.addEventListener('blur', () => setTimeout(() => citizenDrop.style.display = 'none', 150));
        renderCitizenTags();

        // ── Fahrzeuge Autocomplete ───────────────────────────────
        const vehicleSearch = $('#modalReportVehicleSearch');
        const vehicleDrop   = $('#vehicleDropdown');
        const vehicleTags   = $('#vehicleTagsWrap');
        const vehicleHidden = $('#modalReportVehicles');

        const selVehicles = {}; // plate → label
        (vehicleHidden.value || '').split(',').map(s => s.trim()).filter(Boolean).forEach(p => { selVehicles[p] = p; });

        function renderVehicleTags() {
            vehicleTags.innerHTML = Object.entries(selVehicles).map(([plate, label]) =>
                `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(52,199,89,0.1);color:#34C759;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">
                    ${escHtml(label)}
                    <button data-plate="${escHtml(plate)}" class="rm-vehicle" style="background:none;border:none;color:#34C759;cursor:pointer;font-size:13px;line-height:1;padding:0">×</button>
                </span>`
            ).join('');
            vehicleHidden.value = Object.keys(selVehicles).join(', ');
        }
        vehicleTags.addEventListener('click', e => {
            const btn = e.target.closest('.rm-vehicle');
            if (btn) { delete selVehicles[btn.dataset.plate]; renderVehicleTags(); }
        });

        let vDebounce;
        vehicleSearch.addEventListener('input', () => {
            clearTimeout(vDebounce);
            const q = vehicleSearch.value.trim();
            if (q.length < 2) { vehicleDrop.style.display = 'none'; return; }
            vDebounce = setTimeout(async () => {
                const data = await nuiPost('mdtNuiSearchVehicle', { plate: q });
                const res = data && data.results ? data.results : [];
                if (!res.length) { vehicleDrop.style.display = 'none'; return; }
                vehicleDrop.innerHTML = res.slice(0, 8).map(v =>
                    `<div class="mdt-ac-item" data-id="${escHtml(v.plate)}" data-label="${escHtml(v.plate)}">
                        <strong>${highlightMatch(v.plate, q)}</strong>
                        <span class="mdt-ac-item-sub">${[v.model, v.owner_name].filter(Boolean).map(escHtml).join(' · ')}</span>
                    </div>`
                ).join('');
                vehicleDrop.style.display = 'block';
            }, 250);
        });
        vehicleDrop.addEventListener('mousedown', e => {
            const item = e.target.closest('.mdt-ac-item');
            if (!item) return;
            e.preventDefault();
            selVehicles[item.dataset.id] = item.dataset.label;
            renderVehicleTags();
            vehicleSearch.value = '';
            vehicleDrop.style.display = 'none';
        });
        vehicleSearch.addEventListener('blur', () => setTimeout(() => vehicleDrop.style.display = 'none', 150));
        renderVehicleTags();
    }, 50);

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            if (!confirm(L('mdt_report_confirm_delete'))) return;
            await nuiPost('mdtNuiDeleteReport', { id: r.id });
            hideModal();
            searchReport();
        });
    }
}

// ── Notes Panel (right side) ─────────────────────────────────────

function renderProfileNotes(notes) {
    const container = $('#profileNotesList');
    if (!notes.length) {
        container.innerHTML = `<div class="mdt-empty" style="color:rgba(255,255,255,0.3)"><i class="fa-solid fa-sticky-note"></i><p>${L('mdt_notes_none')}</p></div>`;
        return;
    }
    container.innerHTML = notes.map(n => {
        const date = n.created_at ? formatDateTime(n.created_at) : '';
        const tags = [];
        if (n.tag) tags.push(`<span class="mdt-note-tag ${n.tag}">${n.tag.toUpperCase()}</span>`);
        if (n.expire_at) tags.push(`<span class="mdt-note-tag expire">${L('mdt_notes_expire')}: ${formatDate(n.expire_at)}</span>`);
        return `
        <div class="mdt-note-card">
            <div class="mdt-note-card-title">${escHtml(n.title)}</div>
            <div class="mdt-note-card-meta">${L('mdt_notes_created_by')}: ${escHtml(n.officer || '—')}, ${date}</div>
            ${n.content ? `<div class="mdt-note-card-body">${safeHtml(n.content)}</div>` : ''}
            ${tags.length ? `<div class="mdt-note-card-tags">${tags.join('')}</div>` : ''}
            <button class="mdt-note-delete" onclick="deleteNote(${n.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
}

$('#profileAddNoteBtn').addEventListener('click', () => {
    if (!currentProfile) return;
    showModal(L('mdt_btn_create_note'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_title")}</label>
            <input class="mdt-form-input" id="modalNoteTitle" type="text" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_content")}</label>
            <div id="rteNoteContent"></div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_tag")}</label>
                <select class="mdt-form-select" id="modalNoteTag">
                    <option value="">${L("mdt_note_tag_none")}</option>
                    <option value="important">IMPORTANT</option>
                    <option value="info">INFO</option>
                    <option value="warning">WARNING</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_expire_date")}</label>
                <input class="mdt-form-input" id="modalNoteExpire" type="text" placeholder="${datePlaceholder(_dateTimeFormat)}">
            </div>
        </div>
    `, async () => {
        const title = $('#modalNoteTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiAddNote', {
            citizenid: currentProfile.profile.citizenid,
            title,
            content:   ($('#rteNoteContent_body') ? $('#rteNoteContent_body').innerHTML.trim() : ''),
            tag:       $('#modalNoteTag').value,
            expire_at: $('#modalNoteExpire').value.trim(),
        });
        hideModal();
        loadProfile(currentProfile.profile.citizenid);
    });

    // Initialize RTE
    setTimeout(() => { createRTE('rteNoteContent', '...', ''); }, 50);
});

window.deleteNote = async function(id) {
    await nuiPost('mdtNuiDeleteNote', { id });
    if (currentProfile) loadProfile(currentProfile.profile.citizenid);
};

// ── Recent Records (Dashboard) ───────────────────────────────────

// ── Vehicle Search ───────────────────────────────────────────────

$('#vehicleSearchBtn').addEventListener('click', searchVehicle);
$('#vehicleSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchVehicle(); });
$('#vehicleSearchInput').addEventListener('input', debounce(() => {
    const v = $('#vehicleSearchInput').value.trim();
    if (v.length < 2) { $('#vehicleResults').innerHTML = ''; return; }
    searchVehicle();
}, 250));

async function searchVehicle() {
    const query = $('#vehicleSearchInput').value.trim();
    if (query.length < 2) return;
    const data = await nuiPost('mdtNuiSearchVehicle', { plate: query });
    renderVehicleResults(data && data.results ? data.results : []);

    // BOLO Alert
    if (data && data.boloAlerts && data.boloAlerts.length) {
        const alertHtml = data.boloAlerts.map(b => `
            <div style="background:#FFF3E0;border-left:4px solid #FF9500;border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start">
                ${b.image_url ? `<img src="${escHtml(b.image_url)}" style="width:60px;height:60px;border-radius:8px;object-fit:cover" onerror="this.style.display='none'">` : ''}
                <div>
                    <div style="font-weight:600;color:#E65100"><i class="fa-solid fa-triangle-exclamation"></i> BOLO: ${escHtml(b.title)}</div>
                    <div style="font-size:13px;color:#BF360C;margin-top:4px">${L('mdt_vehicle_plate')}: <strong>${escHtml(b.plate || '')}</strong></div>
                    ${b.description ? `<div style="font-size:12px;color:#6D4C41;margin-top:4px">${stripHtml(b.description).substring(0, 200)}</div>` : ''}
                </div>
            </div>
        `).join('');
        $('#vehicleResults').insertAdjacentHTML('afterbegin', alertHtml);
    }
}

function renderVehicleResults(results) {
    const container = $('#vehicleResults');
    if (!results.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-car"></i><p>${L('mdt_empty_vehicles')}</p></div>`;
        return;
    }
    currentVehiclesList = results;
    container.innerHTML = results.map(v => {
        const stolen = v.stolen ? `<span class="mdt-badge-pill mdt-badge-red">${L('mdt_vehicle_stolen_yes')}</span>` : '';
        const gameBadge = v._from_game ? `<span class="mdt-badge-pill mdt-badge-blue" style="font-size:10px">${L("mdt_game_badge")}</span>` : '';
        const owner = v.owner_name ? `${L('mdt_vehicle_owner')}: ${escHtml(v.owner_name)}` : '';
        return `
        <div class="mdt-card" onclick="loadVehicleProfile('${escHtml(v.plate)}')">
            ${cardPhoto(v.image_url, 'fa-car')}
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(v.plate)} <span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">${escHtml(v.model || '')}</span></div>
                <div class="mdt-card-sub">${owner || L('mdt_no_halter')}${v.color ? ' · ' + escHtml(v.color) : ''}</div>
                ${v.edit_log ? `<div class="mdt-card-sub" style="font-size:0.85em;opacity:0.6;margin-top:4px"><i>${escHtml(v.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-card-badges">${gameBadge}${stolen}</div>
        </div>`;
    }).join('');
}

window.switchToPersonAndLoad = function(citizenid) {
    $$('.mdt-nav-item').forEach(b => b.classList.remove('active'));
    $('.mdt-nav-item[data-tab="persons"]').classList.add('active');
    $$('.mdt-tab').forEach(t => t.classList.remove('active'));
    $('#tab-persons').classList.add('active');
    loadProfile(citizenid);
};

// ── Vehicle Profile ─────────────────────────────────────────────

let currentVehicleProfile = null;

window.loadVehicleProfile = async function(plate) {
    const data = await nuiPost('mdtNuiGetVehicleProfile', { plate });
    if (!data || !data.vehicle) return;

    currentVehicleProfile = data;
    const v = data.vehicle;

    // Header fields
    $('#vehProfilePlate').textContent = v.plate || '—';
    $('#vehProfileModel').textContent = v.model || '—';
    $('#vehProfileColor').textContent = v.color || '—';
    $('#vehProfileClass').textContent = v.vehicle_class || '—';
    $('#vehProfileOwner').textContent = v.owner_name || '—';
    $('#vehProfileCid').textContent = v.citizenid || '—';

    // Status badge
    const status = v.status || 'clean';
    const statusMap = {
        clean:      { color: 'green',  label: L('mdt_vehicle_status_clean') },
        flagged:    { color: 'orange', label: L('mdt_vehicle_status_flagged') },
        impounded:  { color: 'blue',   label: L('mdt_vehicle_status_impounded') },
        wanted:     { color: 'red',    label: L('mdt_vehicle_status_wanted') },
        destroyed:  { color: 'red',    label: L('mdt_vehicle_status_destroyed') },
    };
    const s = statusMap[status] || statusMap.clean;
    $('#vehProfileStatusBadge').innerHTML = `<span class="mdt-badge-pill mdt-badge-${s.color}">${s.label}</span>`;

    // Stolen badge
    $('#vehProfileStolen').innerHTML = v.stolen
        ? `<span class="mdt-badge-pill mdt-badge-red">JA</span>`
        : `<span class="mdt-badge-pill mdt-badge-green">NEIN</span>`;

    // Avatar image
    const avatar = $('#vehProfileAvatar');
    if (v.image_url && v.image_url !== '') {
        avatar.innerHTML = `<img src="${escHtml(v.image_url)}" alt="vehicle" data-lightbox style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">`;
    } else {
        avatar.innerHTML = '<i class="fa-solid fa-car" style="font-size:28px;color:#007AFF"></i>';
    }

    // Sub-Tab: Owner
    renderVehOwner(v);

    // Sub-Tab: Flags
    const flags = v.flags ? v.flags.split(',').map(f => f.trim()).filter(f => f) : [];
    $('#vehFlagCount').textContent = flags.length;
    renderVehFlags(flags, v.notes || '');

    // Sub-Tab: History (owner records)
    const ownerRecords = data.ownerRecords || [];
    $('#vehHistoryCount').textContent = ownerRecords.length;
    renderVehHistory(ownerRecords);

    // Sub-Tab: Evidence
    const evidences = data.evidences || [];
    $('#vehEvidenceCount').textContent = evidences.length;
    renderVehEvidence(evidences);

    // Notes
    renderVehNotes(data.notes || []);

    // Show overlay & reset to first tab
    $('#vehicleProfileOverlay').classList.remove('mdt-hidden');
    $$('[data-vptab]').forEach(b => b.classList.remove('active'));
    $$('.mdt-vptab-content').forEach(c => c.classList.remove('active'));
    $('[data-vptab="vowner"]').classList.add('active');
    $('#vptab-vowner').classList.add('active');
};

// Vehicle sub-tab switching
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-vptab]');
    if (!btn) return;
    $$('[data-vptab]').forEach(b => b.classList.remove('active'));
    $$('.mdt-vptab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('vptab-' + btn.dataset.vptab);
    if (target) target.classList.add('active');
});

// Back button
$('#vehicleProfileBackBtn').addEventListener('click', () => {
    $('#vehicleProfileOverlay').classList.add('mdt-hidden');
    currentVehicleProfile = null;
});

function renderVehOwner(v) {
    const container = $('#vptab-vowner');
    if (!v.citizenid || v.citizenid === '') {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-user-slash"></i><p>${L('mdt_empty_halter')}</p></div>`;
        return;
    }
    container.innerHTML = `
    <div class="mdt-card" onclick="switchToPersonAndLoad('${escHtml(v.citizenid)}')" style="cursor:pointer">
        ${cardPhoto(v.owner_image_url, 'fa-user')}
        <div class="mdt-card-body">
            <div class="mdt-card-title">${escHtml(v.owner_name || v.citizenid)}</div>
            <div class="mdt-card-sub">CitizenID: ${escHtml(v.citizenid)}</div>
        </div>
        <div class="mdt-card-badges">
            <span class="mdt-badge-pill mdt-badge-blue">${L('mdt_btn_open_profile')}</span>
        </div>
    </div>`;
}

function renderVehFlags(flags, notes) {
    const container = $('#vptab-vflags');
    let html = '';
    if (flags.length) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${flags.map(f =>
            `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:12px;padding:4px 12px">${escHtml(f)}</span>`
        ).join('')}</div>`;
    }
    if (notes) {
        html += `<div class="mdt-card" style="cursor:default"><div class="mdt-card-body"><div class="mdt-card-title">${L('mdt_notes_label')}</div><div class="mdt-card-sub" style="margin-top:6px;white-space:pre-wrap">${escHtml(notes)}</div></div></div>`;
    }
    if (!html) {
        html = `<div class="mdt-empty"><i class="fa-solid fa-flag"></i><p>${L('mdt_empty_flags')}</p></div>`;
    }
    container.innerHTML = html;
}

function renderVehHistory(records) {
    const container = $('#vptab-vhistory');
    if (!records.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>${L('mdt_empty_history')}</p></div>`;
        return;
    }
    container.innerHTML = records.map(r => {
        const typeClass = r.type === 'arrest' ? 'arrest' : r.type === 'citation' ? 'citation' : 'warning';
        const typeIcon = r.type === 'arrest' ? 'handcuffs' : r.type === 'citation' ? 'file-invoice-dollar' : 'triangle-exclamation';
        const date = r.timestamp ? formatDate(r.timestamp) : '';
        return `
        <div class="mdt-record">
            <div class="mdt-record-type ${typeClass}"><i class="fa-solid fa-${typeIcon}"></i></div>
            <div class="mdt-record-body">
                <div class="mdt-record-title">${escHtml(r.title)}</div>
                <div class="mdt-record-meta"><span>${date}</span>${r.officer ? `<span>${escHtml(r.officer)}</span>` : ''}</div>
                ${r.description ? `<div class="mdt-record-desc">${escHtml(r.description).substring(0, 120)}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderVehEvidence(evidences) {
    const container = $('#vptab-vevidence');
    if (!evidences.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-fingerprint"></i><p>${L('mdt_empty_evidence')}</p></div>`;
        return;
    }
    container.innerHTML = evidences.map(e => {
        const date = e.created_at ? formatDate(e.created_at) : '';
        return `
        <div class="mdt-card" style="cursor:default">
            <div class="mdt-card-icon" style="background:rgba(175,82,222,0.1);color:#AF52DE"><i class="fa-solid fa-fingerprint"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(e.title)} ${e.case_id ? `<span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">Fall #${escHtml(e.case_id)}</span>` : ''}</div>
                <div class="mdt-card-sub">${escHtml(e.officer || '')} · ${date}</div>
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-blue">${escHtml(e.type || 'physical')}</span>
            </div>
        </div>`;
    }).join('');
}

// Vehicle Notes
function renderVehNotes(notes) {
    const container = $('#vehNotesList');
    if (!notes.length) {
        container.innerHTML = `<div class="mdt-empty" style="color:rgba(255,255,255,0.3)"><i class="fa-solid fa-sticky-note"></i><p>${L('mdt_notes_none')}</p></div>`;
        return;
    }
    container.innerHTML = notes.map(n => {
        const date = n.created_at ? formatDateTime(n.created_at) : '';
        const tags = [];
        if (n.tag) tags.push(`<span class="mdt-note-tag ${n.tag}">${n.tag.toUpperCase()}</span>`);
        if (n.expire_at) tags.push(`<span class="mdt-note-tag expire">${L('mdt_notes_expire')}: ${formatDate(n.expire_at)}</span>`);
        return `
        <div class="mdt-note-card">
            <div class="mdt-note-card-title">${escHtml(n.title)}</div>
            <div class="mdt-note-card-meta">${L('mdt_notes_created_by')}: ${escHtml(n.officer || '—')}, ${date}</div>
            ${n.content ? `<div class="mdt-note-card-body">${safeHtml(n.content)}</div>` : ''}
            ${tags.length ? `<div class="mdt-note-card-tags">${tags.join('')}</div>` : ''}
            <button class="mdt-note-delete" onclick="deleteVehNote(${n.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
}

$('#vehAddNoteBtn').addEventListener('click', () => {
    if (!currentVehicleProfile) return;
    showModal(L('mdt_btn_create_note'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_title")}</label>
            <input class="mdt-form-input" id="modalVehNoteTitle" type="text" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_content")}</label>
            <textarea class="mdt-form-textarea" id="modalVehNoteContent" placeholder="..."></textarea>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_tag")}</label>
                <select class="mdt-form-select" id="modalVehNoteTag">
                    <option value="">${L("mdt_note_tag_none")}</option>
                    <option value="important">IMPORTANT</option>
                    <option value="info">INFO</option>
                    <option value="warning">WARNING</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_expire_date")}</label>
                <input class="mdt-form-input" id="modalVehNoteExpire" type="text" placeholder="${datePlaceholder(_dateTimeFormat)}">
            </div>
        </div>
    `, async () => {
        const title = $('#modalVehNoteTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiAddVehicleNote', {
            plate: currentVehicleProfile.vehicle.plate,
            title,
            content:   $('#modalVehNoteContent').value.trim(),
            tag:       $('#modalVehNoteTag').value,
            expire_at: $('#modalVehNoteExpire').value.trim(),
        });
        hideModal();
        loadVehicleProfile(currentVehicleProfile.vehicle.plate);
    });
});

window.deleteVehNote = async function(id) {
    await nuiPost('mdtNuiDeleteVehicleNote', { id });
    if (currentVehicleProfile) loadVehicleProfile(currentVehicleProfile.vehicle.plate);
};

// ── Vehicle Edit Profile ─────────────────────────────────────────

$('#vehProfileEditBtn').addEventListener('click', () => {
    if (!currentVehicleProfile) return;
    const v = currentVehicleProfile.vehicle;
    showModal(L('mdt_vehicle_edit') + ': ' + escHtml(v.plate), `
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_vehicle_model")}</label>
                <input class="mdt-form-input" id="modalVehModel" type="text" value="${escHtml(v.model || '')}">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_vehicle_color")}</label>
                <input class="mdt-form-input" id="modalVehColor" type="text" value="${escHtml(v.color || '')}">
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_vehicle_class")}</label>
                <input class="mdt-form-input" id="modalVehClass" type="text" value="${escHtml(v.vehicle_class || '')}" placeholder="...">
            </div>
            <div class="mdt-form-group" style="flex:1;position:relative">
                <label class="mdt-form-label">${L("mdt_modal_prop_owner")}</label>
                <input class="mdt-form-input" id="modalVehOwnerName" type="text" value="${escHtml(v.owner_name || '')}" placeholder="..." autocomplete="off">
                <input type="hidden" id="modalVehCid" value="${escHtml(v.citizenid || '')}">
                <div id="modalVehOwnerSuggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--mdt-surface);border:1px solid var(--mdt-veil-6);border-radius:8px;max-height:160px;overflow-y:auto;z-index:99;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.1)"></div>
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_status")}</label>
                <select class="mdt-form-select" id="modalVehStatus">
                    <option value="clean" ${!v.status || v.status === 'clean' ? 'selected' : ''}>${L('mdt_vehicle_status_clean')}</option>
                    <option value="flagged" ${v.status === 'flagged' ? 'selected' : ''}>${L('mdt_vehicle_status_flagged')}</option>
                    <option value="impounded" ${v.status === 'impounded' ? 'selected' : ''}>${L('mdt_property_status_seized')}</option>
                    <option value="wanted" ${v.status === 'wanted' ? 'selected' : ''}>${L('mdt_status_wanted')}</option>
                    <option value="destroyed" ${v.status === 'destroyed' ? 'selected' : ''}>${L('mdt_vehicle_status_destroyed')}</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_vehicle_stolen")}</label>
                <select class="mdt-form-select" id="modalVehStolen">
                    <option value="0" ${!v.stolen ? 'selected' : ''}>${L('mdt_vehicle_stolen_no')}</option>
                    <option value="1" ${v.stolen ? 'selected' : ''}>${L('mdt_vehicle_stolen_yes')}</option>
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_modal_prop_flags")}</label>
            <input class="mdt-form-input" id="modalVehFlags" type="text" value="${escHtml(v.flags || '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_notes_label")}</label>
            <textarea class="mdt-form-textarea" id="modalVehNotes">${escHtml(v.notes || '')}</textarea>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_profile_image_url")}</label>
            <input class="mdt-form-input" id="modalVehImage" type="text" value="${escHtml(v.image_url || '')}" placeholder="https://...">
        </div>
    `, async () => {
        await nuiPost('mdtNuiUpdateVehicle', {
            plate:         v.plate,
            model:         $('#modalVehModel').value.trim(),
            color:         $('#modalVehColor').value.trim(),
            vehicle_class: $('#modalVehClass').value.trim(),
            citizenid:     $('#modalVehCid').value.trim(),
            status:        $('#modalVehStatus').value,
            stolen:        $('#modalVehStolen').value === '1',
            flags:         $('#modalVehFlags').value.trim(),
            notes:         $('#modalVehNotes').value.trim(),
            image_url:     $('#modalVehImage').value.trim(),
        });
        hideModal();
        loadVehicleProfile(v.plate);
    });

    // Owner autocomplete
    setupOwnerAutocomplete('modalVehOwnerName', 'modalVehCid', 'modalVehOwnerSuggestions');
});

// Legacy editVehicle (from citizen profile sub-tab)
window.editVehicle = function(plate) {
    loadVehicleProfile(plate);
    // switch to vehicles tab
    $$('.mdt-nav-item').forEach(b => b.classList.remove('active'));
    $('.mdt-nav-item[data-tab="vehicles"]').classList.add('active');
    $$('.mdt-tab').forEach(t => t.classList.remove('active'));
    $('#tab-vehicles').classList.add('active');
};

// ── Warrants ─────────────────────────────────────────────────────

function isWarrantExpired(w) {
    if (!w.expiry) return false;
    const exp = typeof w.expiry === 'number'
        ? new Date(w.expiry > 9999999999 ? w.expiry : w.expiry * 1000)
        : new Date(w.expiry);
    return !isNaN(exp.getTime()) && exp < new Date();
}

function chargeTagsHtml(chargesHtml, maxShow = 4) {
    if (!chargesHtml) return '';
    const div = document.createElement('div');
    div.innerHTML = chargesHtml;
    const lines = [];
    div.querySelectorAll('p, li').forEach(el => {
        const t = el.textContent.trim();
        if (t) lines.push(t);
    });
    if (!lines.length) {
        div.textContent.trim().split('\n').forEach(l => { const t = l.trim(); if (t) lines.push(t); });
    }
    if (!lines.length) return '';
    const visible = lines.slice(0, maxShow);
    const more = lines.length - maxShow;
    let html = visible.map(line => {
        const match = line.match(/^\[([^\]]+)\]/);
        const label = match ? match[1] : (line.length > 22 ? line.substring(0, 22) + '…' : line);
        return `<span style="display:inline-block;background:rgba(88,86,214,0.12);color:#5856D6;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700">${escHtml(label)}</span>`;
    }).join('');
    if (more > 0) {
        html += `<span style="display:inline-block;background:rgba(142,142,147,0.1);color:var(--mdt-text-muted);padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700">+${more}</span>`;
    }
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">${html}</div>`;
}

function renderWarrants(warrants) {
    currentWarrantsList = warrants;
    const container = $('#warrantResults');
    if (!warrants || !warrants.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-gavel"></i><p>${L('mdt_empty_warrants')}</p></div>`;
        return;
    }
    container.innerHTML = warrants.map(w => {
        const prio = w.priority === 'high' ? 'red' : w.priority === 'medium' ? 'orange' : 'blue';
        const expired = isWarrantExpired(w);
        return `
        <div class="mdt-card" onclick="viewWarrant(${w.id})" style="cursor:pointer${expired ? ';border-left:3px solid #FF3B30' : ''}">
            <div class="mdt-card-icon" style="background:rgba(255,69,58,0.12);color:var(--mdt-danger)"><i class="fa-solid fa-gavel"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(w.subject)}</div>
                <div class="mdt-card-sub">${escHtml(w.issued_by || '')}${expired ? ` · <span style="color:#FF3B30;font-weight:600"><i class="fa-solid fa-triangle-exclamation"></i> ${L('mdt_warrant_expired') || 'Abgelaufen'}: ${formatDate(w.expiry)}</span>` : ''}</div>
                ${chargeTagsHtml(w.charges)}
                ${w.edit_log ? `<div class="mdt-card-sub" style="font-size:0.85em; opacity:0.6; margin-top:4px;"><i>${escHtml(w.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-card-badges">
                ${expired ? `<span class="mdt-badge-pill" style="background:#FF3B30;color:#fff"><i class="fa-solid fa-triangle-exclamation"></i></span>` : ''}
                <span class="mdt-badge-pill mdt-badge-${prio}">${w.priority || 'medium'}</span>
                <span class="mdt-badge-pill mdt-badge-${w.status === 'active' ? 'red' : 'green'}">${w.status}</span>
            </div>
            <div class="mdt-card-actions" style="margin-left:auto;padding-right:16px;" onclick="event.stopPropagation()">
                <button class="mdt-action-btn" onclick="editWarrant(${w.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        </div>`;
    }).join('');
}

window.viewWarrant = function(id) {
    const w = currentWarrantsList.find(x => x.id === id);
    if (!w) return;
    const prio = w.priority === 'high' ? 'red' : w.priority === 'medium' ? 'orange' : 'blue';
    showModal(escHtml(w.subject), `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <span class="mdt-badge-pill mdt-badge-${prio}">${w.priority || 'medium'}</span>
            <span class="mdt-badge-pill mdt-badge-${w.status === 'active' ? 'red' : 'green'}">${w.status}</span>
            <span style="font-size:12px;color:var(--mdt-text-primary);font-weight:600;margin-left:auto">${escHtml(w.issued_by || '')} · <span style="font-weight:400;color:var(--mdt-text-tertiary)">${formatDate(w.issued_date)}</span></span>
        </div>
        <div style="border:1px solid var(--mdt-input-border);border-radius:10px;padding:14px;min-height:80px;font-size:14px;line-height:1.6;color:var(--mdt-text-primary)">
            ${w.charges ? safeHtml(w.charges) : '<span style="color:var(--mdt-text-muted)">–</span>'}
        </div>
        ${w.edit_log ? `<div style="margin-top:10px;font-size:12px;color:var(--mdt-text-muted)"><i>${escHtml(w.edit_log)}</i></div>` : ''}
    `, null, { hideConfirm: true });
};

// ── BOLOs ────────────────────────────────────────────────────────

function renderBolos(bolos) {
    currentBolosList = bolos;
    const container = $('#boloResults');
    if (!bolos || !bolos.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-bullhorn"></i><p>${L('mdt_empty_results')}</p></div>`;
        return;
    }
    container.innerHTML = bolos.map(b => `
        <div class="mdt-card" onclick="viewBolo(${b.id})" style="cursor:pointer">
            ${b.image_url ? `<div style="width:50px;height:50px;border-radius:8px;overflow:hidden;margin-right:8px;flex-shrink:0"><img src="${escHtml(b.image_url)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"></div>` : `<div class="mdt-card-icon"><i class="fa-solid fa-bullhorn"></i></div>`}
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(b.title)}</div>
                <div class="mdt-card-sub">${b.plate ? L('mdt_vehicle_plate') + ': ' + escHtml(b.plate) + ' · ' : ''}${stripHtml(b.description || '').substring(0, 80)}</div>
                ${b.expire_at ? `<div class="mdt-card-sub" style="font-size:11px;color:#FF9500;margin-top:2px"><i class="fa-solid fa-clock"></i> ${L('mdt_bolo_expires')}: ${formatDate(b.expire_at)}</div>` : ''}
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-blue">${escHtml(b.type || 'vehicle')}</span>
            </div>
            <div class="mdt-card-actions" style="margin-left:auto;padding-right:16px;" onclick="event.stopPropagation()">
                <button class="mdt-action-btn" onclick="editBolo(${b.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        </div>`).join('');
}

window.viewBolo = function(id) {
    const b = currentBolosList.find(x => x.id === id);
    if (!b) return;
    const typeClass = b.type === 'vehicle' ? 'vehicle' : b.type === 'citizen' ? 'citizen' : 'other';
    const typeIcon  = b.type === 'vehicle' ? 'fa-car' : b.type === 'citizen' ? 'fa-user' : 'fa-bullhorn';
    const typeColor = b.type === 'vehicle' ? '#00C7BE' : b.type === 'citizen' ? '#007AFF' : '#FF9500';
    const typeBg    = b.type === 'vehicle' ? 'rgba(0,199,190,0.1)' : b.type === 'citizen' ? 'rgba(0,122,255,0.1)' : 'rgba(255,159,10,0.1)';
    showModal(escHtml(b.title), `
        <div style="background:${typeBg};border-radius:12px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">
            <div style="width:44px;height:44px;border-radius:10px;background:${typeColor};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fa-solid ${typeIcon}" style="color:#fff;font-size:18px"></i>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-size:11px;font-weight:700;color:${typeColor};text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">${escHtml(b.type || '')}</div>
                <div style="font-size:15px;font-weight:700;color:var(--mdt-text-primary)">${escHtml(b.title)}</div>
                ${b.plate ? `<div style="font-size:12px;font-family:monospace;font-weight:700;color:var(--mdt-text-secondary);margin-top:2px"><i class="fa-solid fa-hashtag" style="font-size:10px;margin-right:3px"></i>${escHtml(b.plate)}</div>` : ''}
            </div>
            ${b.expire_at ? `<div style="text-align:right;flex-shrink:0">
                <div style="font-size:10px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">${L('mdt_bolo_expires')}</div>
                <div style="font-size:13px;font-weight:600;color:#FF9500"><i class="fa-solid fa-clock" style="margin-right:4px"></i>${formatDate(b.expire_at)}</div>
            </div>` : ''}
        </div>
        ${b.image_url ? `<div style="margin-bottom:14px;border-radius:10px;overflow:hidden;max-height:200px;border:1px solid var(--mdt-input-border)"><img src="${escHtml(b.image_url)}" style="width:100%;object-fit:cover;display:block" onerror="this.parentElement.style.display='none'"></div>` : ''}
        <div style="margin-bottom:6px;font-size:11px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.4px">${L('mdt_bolo_desc') || 'Beschreibung'}</div>
        <div style="background:var(--mdt-surface-alt);border-radius:10px;padding:14px 16px;min-height:60px;font-size:14px;line-height:1.6;color:var(--mdt-text-primary)">
            ${b.description ? safeHtml(b.description) : '<span style="color:var(--mdt-text-muted)">–</span>'}
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #F2F2F7;display:flex;align-items:center;gap:6px">
            <i class="fa-solid fa-shield-halved" style="font-size:11px;color:var(--mdt-text-muted)"></i>
            <span style="font-size:12px;font-weight:600;color:var(--mdt-text-primary)">${escHtml(b.issued_by || '—')}</span>
            ${b.issued_date ? `<span style="font-size:12px;color:var(--mdt-text-tertiary)">· ${formatDate(b.issued_date)}</span>` : ''}
        </div>
    `, null, { hideConfirm: true });
};

// ── Add Record Modal ─────────────────────────────────────────────

// ── CRUD UI logic ────────────────────────────────────────────────

// Warrants
$('#warrantAddBtn').addEventListener('click', () => {
    openWarrantModal();
});

window.editWarrant = function(id) {
    const w = currentWarrantsList.find(x => x.id === id);
    if (w) openWarrantModal(w);
};

function openWarrantModal(w = null) {
    const isEdit = !!w;
    const penalOpts = buildPenalCodeOptions();
    showModal(isEdit ? L('mdt_warrant_edit') : L('mdt_warrant_add'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_warrant_subject")}</label>
            <div style="position:relative">
                <input class="mdt-form-input" id="modalWarrantSubject" type="text" value="${escHtml(w ? w.subject : '')}" placeholder="Name eingeben..." autocomplete="off">
                <div id="warrantSubjectDrop" class="mdt-ac-drop"></div>
            </div>
        </div>
        ${penalOpts ? `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_penal_code')} <span style="font-weight:400;text-transform:none;opacity:0.6">(Auswahl fügt Eintrag hinzu)</span></label>
            <select class="mdt-form-select" id="modalWarrantPenalSelect" style="font-size:13px">${penalOpts}</select>
        </div>` : ''}
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_warrant_charges")}</label>
            <div id="rteWarrantCharges"></div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_warrant_priority")}</label>
                <select class="mdt-form-select" id="modalWarrantPrio">
                    <option value="low" ${w && w.priority==='low' ? 'selected':''}>${L('mdt_case_prio_low')}</option>
                    <option value="medium" ${!w || w.priority==='medium' ? 'selected':''}>${L('mdt_case_prio_medium')}</option>
                    <option value="high" ${w && w.priority==='high' ? 'selected':''}>${L('mdt_case_prio_high')}</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_status")}</label>
                <select class="mdt-form-select" id="modalWarrantStatus">
                    <option value="active" ${!w || w.status==='active' ? 'selected':''}>${L('mdt_evidence_status_active')}</option>
                    <option value="closed" ${w && w.status==='closed' ? 'selected':''}>${L('mdt_case_status_closed')}</option>
                </select>
            </div>
        </div>
    `, async () => {
        const subject = $('#modalWarrantSubject').value.trim();
        if (!subject) return;
        const payload = {
            subject: subject,
            charges: ($('#rteWarrantCharges_body')?.innerHTML || '').trim(),
            priority: $('#modalWarrantPrio').value,
            status: $('#modalWarrantStatus').value
        };
        if (isEdit) {
            payload.id = w.id;
            await nuiPost('mdtNuiUpdateWarrant', payload);
        } else {
            await nuiPost('mdtNuiAddWarrant', payload);
        }
        hideModal();
        nuiPost('mdtReqDashboardUpdate');
    });

    setTimeout(() => {
        createRTE('rteWarrantCharges', '...', w ? w.charges : '');

        const penalSel = $('#modalWarrantPenalSelect');
        if (penalSel) {
            penalSel.addEventListener('change', () => {
                const opt = penalSel.selectedOptions[0];
                if (!opt || !opt.value) return;
                const body = $('#rteWarrantCharges_body');
                if (!body) return;
                const fine = opt.dataset.fine > 0 ? ` — $${opt.dataset.fine}` : '';
                const jail = opt.dataset.jail > 0 ? ` / ${opt.dataset.jail} ${L('mdt_months')}` : '';
                const p = document.createElement('p');
                p.textContent = `[${opt.value}] ${opt.dataset.title}${fine}${jail}`;
                body.appendChild(p);
                penalSel.value = '';
                body.scrollTop = body.scrollHeight;
            });
        }

        const subjectInput = $('#modalWarrantSubject');
        const subjectDrop  = $('#warrantSubjectDrop');
        let sDebounce;

        subjectInput.addEventListener('input', () => {
            clearTimeout(sDebounce);
            const q = subjectInput.value.trim();
            if (q.length < 2) { subjectDrop.style.display = 'none'; return; }
            sDebounce = setTimeout(async () => {
                const data = await nuiPost('mdtNuiSearchPerson', { query: q });
                const res = (data && data.results ? data.results : []).filter(p => p.name && p.name.trim() && p.name !== p.citizenid);
                if (!res.length) { subjectDrop.style.display = 'none'; return; }
                subjectDrop.innerHTML = res.slice(0, 8).map(p =>
                    `<div class="mdt-ac-item" data-name="${escHtml(p.name)}">
                        <strong>${highlightMatch(p.name, q)}</strong><span class="mdt-ac-item-sub">${escHtml(p.citizenid)}</span>
                    </div>`
                ).join('');
                subjectDrop.style.display = 'block';
            }, 250);
        });

        subjectDrop.addEventListener('mousedown', e => {
            const item = e.target.closest('.mdt-ac-item');
            if (!item) return;
            e.preventDefault();
            subjectInput.value = item.dataset.name;
            subjectDrop.style.display = 'none';
        });

        subjectInput.addEventListener('blur', () => setTimeout(() => subjectDrop.style.display = 'none', 150));
    }, 0);

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            await nuiPost('mdtNuiDeleteWarrant', { id: w.id });
            hideModal();
            nuiPost('mdtReqDashboardUpdate');
        });
    }
}

// BOLOs
$('#boloAddBtn').addEventListener('click', () => {
    openBoloModal();
});

window.editBolo = function(id) {
    const b = currentBolosList.find(x => x.id === id);
    if (b) openBoloModal(b);
};

function openBoloModal(b = null) {
    const isEdit = !!b;
    showModal(isEdit ? L('mdt_bolo_edit') : L('mdt_bolo_add'), `
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_record_type")}</label>
                <select class="mdt-form-select" id="modalBoloType">
                    <option value="vehicle" ${!b || b.type==='vehicle' ? 'selected':''}>${L('mdt_tab_vehicles')}</option>
                    <option value="citizen" ${b && b.type==='citizen' ? 'selected':''}>${L('mdt_sidebar_persons')}</option>
                    <option value="other" ${b && b.type==='other' ? 'selected':''}>${L('mdt_report_type_other')}</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_bolo_plate")}</label>
                <input class="mdt-form-input" id="modalBoloPlate" type="text" value="${escHtml(b ? b.plate : '')}">
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_bolo_title")}</label>
            <input class="mdt-form-input" id="modalBoloTitle" type="text" value="${escHtml(b ? b.title : '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_bolo_description")}</label>
            <div id="rteBoloDesc"></div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_bolo_image")}</label>
                <input class="mdt-form-input" id="modalBoloImage" type="text" value="${escHtml(b ? b.image_url || '' : '')}" placeholder="https://...">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_bolo_expire")}</label>
                <input class="mdt-form-input" id="modalBoloExpire" type="text" placeholder="${datePlaceholder(_dateFormat)}" value="${b && b.expire_at ? isoToDE(String(b.expire_at).substring(0,10)) : ''}">
            </div>
        </div>
    `, async () => {
        const title = $('#modalBoloTitle').value.trim();
        if (!title) return;
        const expireRaw = $('#modalBoloExpire').value.trim();
        const expireISO = expireRaw ? deToISO(expireRaw) : null;
        if (expireRaw && !expireISO) {
            alert(L('mdt_invalid_date') || ('Ungültiges Datum — bitte im Format ' + datePlaceholder(_dateFormat) + ' eingeben.'));
            return;
        }
        const payload = {
            type: $('#modalBoloType').value,
            plate: $('#modalBoloPlate').value.trim(),
            title: title,
            description: ($('#rteBoloDesc_body')?.innerHTML || '').trim(),
            image_url: $('#modalBoloImage').value.trim(),
            expire_at: expireISO
        };
        if (isEdit) {
            payload.id = b.id;
            await nuiPost('mdtNuiUpdateBolo', payload);
        } else {
            await nuiPost('mdtNuiAddBolo', payload);
        }
        hideModal();
        nuiPost('mdtReqDashboardUpdate');
    });

    setTimeout(() => {
        createRTE('rteBoloDesc', '...', b ? b.description : '');
    }, 0);

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            await nuiPost('mdtNuiDeleteBolo', { id: b.id });
            hideModal();
            nuiPost('mdtReqDashboardUpdate');
        });
    }
}

// ── Add Record (triggered from Records sub-tab) ─────────────────

window.openAddRecordModal = function() {
    if (!currentProfile) return;
    const penalOpts = buildPenalCodeOptions();
    showModal(L('mdt_record_add'), `
        ${penalOpts ? `<div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_penal_code')}</label>
            <select class="mdt-form-select" id="modalPenalSelect" style="font-size:13px">${penalOpts}</select>
        </div>
        <hr style="border:none;border-top:1px solid var(--mdt-input-border);margin:12px 0">` : ''}
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_type")}</label>
            <select class="mdt-form-select" id="modalRecordType">
                <option value="warning">${L("mdt_record_type_warning")}</option>
                <option value="citation">${L("mdt_record_type_citation")}</option>
                <option value="arrest">${L("mdt_record_type_arrest")}</option>
            </select>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_title")}</label>
            <input class="mdt-form-input" id="modalRecordTitle" type="text" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_description")}</label>
            <textarea class="mdt-form-textarea" id="modalRecordDesc" placeholder="..."></textarea>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_record_fine')}</label>
                <input class="mdt-form-input" id="modalRecordFine" type="number" min="0" value="0">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_record_jail')}</label>
                <input class="mdt-form-input" id="modalRecordJail" type="number" min="0" value="0">
            </div>
        </div>
    `, async () => {
        const title = $('#modalRecordTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiAddRecord', {
            citizenid:   currentProfile.profile.citizenid,
            type:        $('#modalRecordType').value,
            title:       title,
            description: $('#modalRecordDesc').value.trim(),
            fine:        parseInt($('#modalRecordFine').value) || 0,
            jail_time:   parseInt($('#modalRecordJail').value) || 0,
        });
        hideModal();
        if (currentProfile) loadProfile(currentProfile.profile.citizenid);
        nuiPost('mdtReqDashboardUpdate');
    });

    // Auto-fill from penal code selection
    const penalSelect = $('#modalPenalSelect');
    if (penalSelect) {
        penalSelect.addEventListener('change', () => {
            const opt = penalSelect.selectedOptions[0];
            if (!opt || !opt.value) return;
            $('#modalRecordTitle').value = opt.dataset.title || '';
            $('#modalRecordDesc').value = opt.dataset.desc || '';
            $('#modalRecordType').value = opt.dataset.type || 'citation';
            $('#modalRecordFine').value = opt.dataset.fine || 0;
            $('#modalRecordJail').value = opt.dataset.jail || 0;
        });
    }
};

window.editRecord = function(id) {
    if (!currentProfile || !currentProfile.records) return;
    const r = currentProfile.records.find(x => x.id === id);
    if (!r) return;

    const penalOpts = buildPenalCodeOptions();
    showModal(L('mdt_record_edit'), `
        ${penalOpts ? `<div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_penal_code')}</label>
            <select class="mdt-form-select" id="modalEditPenalSelect" style="font-size:13px">${penalOpts}</select>
        </div>
        <hr style="border:none;border-top:1px solid var(--mdt-input-border);margin:12px 0">` : ''}
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_type")}</label>
            <select class="mdt-form-select" id="modalEditRecordType">
                <option value="warning" ${r.type === 'warning' ? 'selected' : ''}>${L("mdt_record_type_warning")}</option>
                <option value="citation" ${r.type === 'citation' ? 'selected' : ''}>${L("mdt_record_type_citation")}</option>
                <option value="arrest" ${r.type === 'arrest' ? 'selected' : ''}>${L("mdt_record_type_arrest")}</option>
            </select>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_title")}</label>
            <input class="mdt-form-input" id="modalEditRecordTitle" type="text" value="${escHtml(r.title)}">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_description")}</label>
            <textarea class="mdt-form-textarea" id="modalEditRecordDesc">${escHtml(r.description || '')}</textarea>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_record_fine")}</label>
                <input class="mdt-form-input" id="modalEditRecordFine" type="number" min="0" value="${r.fine || 0}">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_record_jail')}</label>
                <input class="mdt-form-input" id="modalEditRecordJail" type="number" min="0" value="${r.jail_time || 0}">
            </div>
        </div>
    `, async () => {
        const title = $('#modalEditRecordTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiUpdateRecord', {
            id: r.id,
            citizenid: r.citizenid,
            type: $('#modalEditRecordType').value,
            title: title,
            description: $('#modalEditRecordDesc').value.trim(),
            fine: parseInt($('#modalEditRecordFine').value) || 0,
            jail_time: parseInt($('#modalEditRecordJail').value) || 0
        });
        hideModal();
        loadProfile(r.citizenid);
        nuiPost('mdtReqDashboardUpdate');
    });

    // Auto-fill from penal code selection
    const penalSelect = $('#modalEditPenalSelect');
    if (penalSelect) {
        penalSelect.addEventListener('change', () => {
            const opt = penalSelect.selectedOptions[0];
            if (!opt || !opt.value) return;
            $('#modalEditRecordTitle').value = opt.dataset.title || '';
            $('#modalEditRecordDesc').value = opt.dataset.desc || '';
            $('#modalEditRecordType').value = opt.dataset.type || 'citation';
            $('#modalEditRecordFine').value = opt.dataset.fine || 0;
            $('#modalEditRecordJail').value = opt.dataset.jail || 0;
        });
    }

    setModalDangerAction(L('mdt_btn_delete'), async () => {
        if (!confirm(L('mdt_record_confirm_delete') || L('mdt_case_confirm_delete'))) return;
        await nuiPost('mdtNuiDeleteRecord', { id: r.id });
        hideModal();
        loadProfile(r.citizenid);
        nuiPost('mdtReqDashboardUpdate');
    });
};

// ── Screenshot Upload (FiveManage) ───────────────────────────────

let _mugshotAvatarEl  = null;
let _mugshotOverlayEl = null;
let _mugshotTimeoutId = null;

// Nachrichten vom Lua-Client (Mugshot-Flow)
window.addEventListener('message', evt => {
    const d = evt.data;
    if (d.action === 'mugshotHideMDT') {
        const frame = $('#mdt-ipad-frame');
        if (frame) frame.classList.add('mdt-hidden');
    } else if (d.action === 'mugshotShowMDT') {
        const frame = $('#mdt-ipad-frame');
        if (frame) frame.classList.remove('mdt-hidden');
    } else if (d.action === 'mugshotHideOverlay') {
        if (_mugshotOverlayEl) _mugshotOverlayEl.style.visibility = 'hidden';
    } else if (d.action === 'screenshotResult') {
        if (_mugshotTimeoutId) { clearTimeout(_mugshotTimeoutId); _mugshotTimeoutId = null; }
        if (_mugshotOverlayEl) { _mugshotOverlayEl.remove(); _mugshotOverlayEl = null; }
        if (d.result && d.result.success && d.result.url && _mugshotAvatarEl) {
            _mugshotAvatarEl.innerHTML = `<img src="${escHtml(d.result.url)}" alt="photo" data-lightbox style="width:100%;height:100%;object-fit:cover;border-radius:inherit;cursor:zoom-in">`;
        }
        _mugshotAvatarEl = null;
    }
});

function showMugshotOverlay(html) {
    const overlay = document.createElement('div');
    overlay.className = 'mdt-mugshot-overlay';
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    _mugshotOverlayEl = overlay;
}

async function takeScreenshot(targetType, targetId, btn, avatarEl) {
    if (!targetId) return;
    _mugshotAvatarEl = avatarEl;

    let apiKey = _fivemanageKey;

    // Nur bei Personen-Profilen kann das Ziel ein Online-Spieler sein (echter Mugshot).
    if (targetType === 'profile') {
        const req = await nuiPost('mdtNuiRequestMugshot', { target: targetType, targetId });
        if (!req || !req.success) { _mugshotAvatarEl = null; return; }
        if (req.mode === 'remote') {
            showMugshotOverlay(`
                <div class="mdt-mugshot-box">
                    <div class="mdt-mugshot-title"><i class="fa-solid fa-camera-retro" style="color:#007AFF;margin-right:6px"></i>${L('mdt_photo_waiting_title') || 'Warte auf Zielperson...'}</div>
                    <p class="mdt-mugshot-hint">${L('mdt_photo_waiting_hint') || 'Das Foto wird automatisch aufgenommen.'}</p>
                </div>`);
            // Falls das Ziel nie antwortet: Overlay nach 15s auflösen statt für immer hängen zu bleiben.
            _mugshotTimeoutId = setTimeout(() => {
                if (_mugshotOverlayEl) { _mugshotOverlayEl.remove(); _mugshotOverlayEl = null; }
                _mugshotAvatarEl = null;
                _mugshotTimeoutId = null;
            }, 15000);
            return;
        }
        apiKey = req.apiKey || apiKey;
    }

    // Overlay anzeigen (pointer-events: none → Spieler kann sich bewegen)
    showMugshotOverlay(`
        <div class="mdt-mugshot-box">
            <div class="mdt-mugshot-title"><i class="fa-solid fa-camera" style="color:#007AFF;margin-right:6px"></i>Mugshot-Modus</div>
            <p class="mdt-mugshot-hint">${L('mdt_photo_capture_hint') || 'Positioniere dich vor der Person, dann drücke F5'}</p>
            <div class="mdt-mugshot-key-badge"><i class="fa-solid fa-camera"></i> Aufnehmen &nbsp;<kbd>F5</kbd></div>
            <span class="mdt-mugshot-esc"><kbd style="background:rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.1);border-radius:4px;padding:1px 5px;font-family:inherit;font-size:11px;color:var(--mdt-text-muted)">ESC</kbd> Abbrechen</span>
        </div>`);

    // Lua übernimmt: NUI-Fokus freigeben, auf F5 warten, Screenshot machen
    nuiPost('mdtNuiStartCapture', { target: targetType, targetId, apiKey });
}

// Foto-Auswahl Modal: Screenshot oder URL manuell eingeben
function openPhotoModal(targetType, targetId, avatarEl) {
    showModal(L('mdt_photo_title') || 'Foto hochladen', `
        <div style="display:flex;flex-direction:column;gap:12px">
            <button class="mdt-btn mdt-btn-primary" id="photoOptScreenshot" style="width:100%;padding:12px;font-size:14px">
                <i class="fa-solid fa-camera"></i> Screenshot aufnehmen
            </button>
            <div style="text-align:center;color:var(--mdt-text-muted);font-size:12px">— oder —</div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">Bild-URL manuell eingeben</label>
                <input class="mdt-form-input" id="photoUrlInput" type="text" placeholder="https://...">
            </div>
        </div>
    `, async () => {
        const url = ($('#photoUrlInput').value || '').trim();
        if (!url) return;
        if (!url.match(/^https?:\/\//)) return;
        const result = await nuiPost('mdtNuiTakeScreenshot', {
            target: targetType, targetId, url
        });
        if (result && result.success && result.url && avatarEl) {
            avatarEl.innerHTML = `<img src="${escHtml(result.url)}" alt="photo" data-lightbox style="width:100%;height:100%;object-fit:cover;border-radius:inherit;cursor:zoom-in">`;
        }
        hideModal();
    });

    setTimeout(() => {
        const ssBtn = $('#photoOptScreenshot');
        if (!ssBtn) return;
        ssBtn.addEventListener('click', async () => {
            // Frame sofort verstecken — BEVOR Lua-Roundtrip (verhindert schwarzes Shell)
            const frame = $('#mdt-ipad-frame');
            if (frame) frame.classList.add('mdt-hidden');
            hideModal();
            await new Promise(r => setTimeout(r, 80));
            takeScreenshot(targetType, targetId, null, avatarEl);
        });
    }, 50);
}

// Eigenes Avatar (Topbar) — stoppt Bubbling, damit ein evtl. gesetztes Bild
// nicht zusätzlich die Lightbox-Delegation (document click) auslöst.
$('#mdtTbAvatar').addEventListener('click', e => {
    e.stopPropagation();
    if (!_ownCitizenId) return;
    openPhotoModal('profile', _ownCitizenId, $('#mdtTbAvatar'));
});

// Citizen Mugshot
$('#profileScreenshotBtn').addEventListener('click', () => {
    if (!currentProfile || !currentProfile.profile) return;
    openPhotoModal('profile', currentProfile.profile.citizenid, $('#profileAvatar'));
});

// Vehicle Photo
$('#vehScreenshotBtn').addEventListener('click', () => {
    if (!currentVehicleProfile || !currentVehicleProfile.vehicle) return;
    openPhotoModal('vehicle', currentVehicleProfile.vehicle.plate, $('#vehProfileAvatar'));
});

// ── Edit Profile Modal ───────────────────────────────────────────

$('#profileEditBtn').addEventListener('click', () => {
    if (!currentProfile) return;
    const p = currentProfile.profile;
    const firstName = p.firstname || (p.name ? p.name.split(' ')[0] : '');
    const lastName = p.lastname || (p.name ? p.name.split(' ').slice(1).join(' ') : '');

    showModal(L('mdt_profile_edit'), `
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_firstname")}</label>
                <input class="mdt-form-input" id="modalFirstName" type="text" value="${escHtml(firstName)}">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_lastname")}</label>
                <input class="mdt-form-input" id="modalLastName" type="text" value="${escHtml(lastName)}">
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_dob")}</label>
                <input class="mdt-form-input" id="modalDob" type="text" value="${escHtml(p.dob || '')}" placeholder="MM/DD/YYYY">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_gender")}</label>
                <select class="mdt-form-select" id="modalGender">
                    <option value="male" ${p.gender !== 'female' && p.gender !== 'diverse' ? 'selected' : ''}>${L('mdt_gender_male')}</option>
                    <option value="female" ${p.gender === 'female' ? 'selected' : ''}>${L('mdt_gender_female')}</option>
                    <option value="diverse" ${p.gender === 'diverse' ? 'selected' : ''}>${L('mdt_gender_diverse')}</option>
                </select>
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_nationality")}</label>
                <input class="mdt-form-input" id="modalNationality" type="text" value="${escHtml(p.nationality || '')}" placeholder="...">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_status")}</label>
                <select class="mdt-form-select" id="modalStatus">
                    <option value="neutral" ${!p.status || p.status === 'neutral' ? 'selected' : ''}>${L('mdt_status_neutral')}</option>
                    <option value="suspect" ${p.status === 'suspect' ? 'selected' : ''}>${L('mdt_status_suspect')}</option>
                    <option value="criminal" ${p.status === 'criminal' ? 'selected' : ''}>${L('mdt_status_criminal')}</option>
                    <option value="wanted" ${p.status === 'wanted' ? 'selected' : ''}>${L('mdt_status_wanted')}</option>
                    <option value="deceased" ${p.status === 'deceased' ? 'selected' : ''}>${L('mdt_status_deceased')}</option>
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_profile_image_url")}</label>
            <input class="mdt-form-input" id="modalImage" type="text" value="${escHtml(p.image_url || '')}" placeholder="https://...">
        </div>
    `, async () => {
        const fn = $('#modalFirstName').value.trim();
        const ln = $('#modalLastName').value.trim();
        await nuiPost('mdtNuiUpdateProfile', {
            citizenid:   p.citizenid,
            firstname:   fn,
            lastname:    ln,
            dob:         $('#modalDob').value.trim(),
            gender:      $('#modalGender').value,
            nationality: $('#modalNationality').value.trim(),
            status:      $('#modalStatus').value,
            image_url:   $('#modalImage').value.trim(),
            // keep old values
            license_status: p.license_status || 'valid',
            wanted_level:   p.wanted_level || 0,
            notes:          p.notes || '',
        });
        hideModal();
        loadProfile(p.citizenid);
    });
});

// ── Modal System ─────────────────────────────────────────────────

let modalConfirmHandler = null;

// Löschen-Aktion links im Footer (statt einem vollbreiten roten Button im Formular) —
// von den einzelnen Modal-Buildern per setModalDangerAction() nach showModal() gesetzt.
function clearModalDangerAction() {
    const existing = $('#modalDangerBtn');
    if (existing) existing.remove();
}

function setModalDangerAction(label, onClick) {
    clearModalDangerAction();
    const footer = $('.mdt-modal-footer');
    if (!footer) return;
    const btn = document.createElement('button');
    btn.id = 'modalDangerBtn';
    btn.className = 'mdt-btn mdt-btn-danger-ghost';
    btn.innerHTML = `<i class="fa-solid fa-trash"></i> ${label}`;
    btn.addEventListener('click', onClick);
    footer.insertBefore(btn, footer.firstChild);
}

function showModal(title, bodyHtml, onConfirm, options) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    modalConfirmHandler = onConfirm;
    clearModalDangerAction();
    const confirmBtn = $('#modalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.style.display = (options && options.hideConfirm) ? 'none' : '';
        confirmBtn.textContent = (options && options.confirmLabel) || L('mdt_btn_confirm');
    }

    // FIX: Force transparent overlay background (game should stay visible)
    // backdrop-filter must stay off — in CEF it renders the transparent NUI body as solid black.
    const overlay = $('.mdt-modal-overlay');
    if (overlay) {
        overlay.style.background = 'rgba(0,0,0,0.25)';
        overlay.style.backdropFilter = 'none';
        overlay.style.webkitBackdropFilter = 'none';
    }

    $('#mdtModal').classList.remove('mdt-hidden');
}

function hideModal() {
    $('#mdtModal').classList.add('mdt-hidden');
    const modalEl = $('.mdt-modal');
    if (modalEl) modalEl.classList.remove('mdt-modal-wide');
    modalConfirmHandler = null;
    clearModalDangerAction();
    const confirmBtn = $('#modalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.style.display = '';
        confirmBtn.textContent = L('mdt_btn_confirm');
    }
}

$('#modalCloseBtn').addEventListener('click', hideModal);
$('#modalCancelBtn').addEventListener('click', hideModal);
$('#modalConfirmBtn').addEventListener('click', async () => {
    if (modalConfirmHandler) {
        try { await modalConfirmHandler(); }
        catch(err) { console.error('[MDT] Modal confirm error:', err); }
    }
});

// ── NUI Message Listener ─────────────────────────────────────────

window.addEventListener('message', e => {
    const d = e.data;
    if (d.action === 'openMDT') openMDT(d);
    if (d.action === 'closeMDT') closeMDT();
    if (d.action === 'refreshAccess' && d.access) {
        _access = d.access;
        _canManageSettings = d.canManageSettings || false;
        applyAccessControl();
    }
    if (d.action === 'switchTab') {
        const btn = $(`.mdt-nav-item[data-tab="${d.tab}"]`);
        if (btn) btn.click();
    }
    if (d.action === 'openProfile') {
        const btn = $(`.mdt-nav-item[data-tab="persons"]`);
        if (btn) btn.click();
        if (d.citizenid) loadProfile(d.citizenid);
    }
    if (d.action === 'newDispatch' && d.dispatch) {
        window._mdtDispatches = window._mdtDispatches || [];
        window._mdtDispatches.unshift(d.dispatch);
        window._mdtDispatchIdx = 0;
        $('#dashDispatchCount').textContent = window._mdtDispatches.length;
        renderDispatchCard();
    }
});

// ── ESC to close ─────────────────────────────────────────────────

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const modal = $('#mdtModal');
        if (!modal.classList.contains('mdt-hidden')) {
            hideModal();
        } else if (!$('#mdt-ipad-frame').classList.contains('mdt-hidden')) {
            closeMDT();
        }
    }
});

// ══════════════════════════════════════════════════════════════════
//  Properties (Immobilien)
// ══════════════════════════════════════════════════════════════════

let currentPropertiesList = [];
let currentPropertyProfile = null;

$('#propertySearchBtn').addEventListener('click', searchProperty);
$('#propertySearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchProperty(); });
$('#propertySearchInput').addEventListener('input', debounce(() => {
    const v = $('#propertySearchInput').value.trim();
    if (v.length < 2) { $('#propertyResults').innerHTML = ''; return; }
    searchProperty();
}, 250));

async function searchProperty() {
    const query = $('#propertySearchInput').value.trim();
    if (query.length < 2) return;
    const data = await nuiPost('mdtNuiSearchProperty', { query });
    renderPropertyResults(data && data.results ? data.results : []);
}

function renderPropertyResults(results) {
    const container = $('#propertyResults');
    currentPropertiesList = results;
    if (!results.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-house-chimney"></i><p>${L('mdt_empty_properties')}</p></div>`;
        return;
    }
    container.innerHTML = results.map(p => {
        const typeLabel = p.type === 'house' ? L('mdt_property_type_house') : p.type === 'apartment' ? L('mdt_property_type_apartment') : p.type === 'business' ? L('mdt_property_type_business') : p.type === 'garage' ? L('mdt_property_type_garage') : p.type;
        const statusColor = p.status === 'clear' ? 'green' : p.status === 'flagged' ? 'orange' : p.status === 'raid' ? 'red' : 'blue';
        return `
        <div class="mdt-card" onclick="loadPropertyProfile(${p.id})" style="cursor:pointer">
            <div class="mdt-card-icon" style="background:rgba(90,200,250,0.1);color:#5AC8FA"><i class="fa-solid fa-house-chimney"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(p.address)}</div>
                <div class="mdt-card-sub">${escHtml(p.owner_name || L('mdt_no_owner'))} ${p.owner_cid ? '· ' + escHtml(p.owner_cid) : ''}</div>
                ${p.edit_log ? `<div class="mdt-card-sub" style="font-size:0.85em;opacity:0.6;margin-top:4px"><i>${escHtml(p.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-blue">${typeLabel}</span>
                <span class="mdt-badge-pill mdt-badge-${statusColor}">${escHtml(p.status || 'clear')}</span>
            </div>
        </div>`;
    }).join('');
}

$('#propertyAddBtn').addEventListener('click', () => openPropertyModal());

window.editProperty = function(id) {
    const p = currentPropertiesList.find(x => x.id === id) || (currentPropertyProfile ? currentPropertyProfile.property : null);
    if (p) openPropertyModal(p);
};

// ── Property Profile ─────────────────────────────────────────────

window.loadPropertyProfile = async function(id) {
    const data = await nuiPost('mdtNuiGetPropertyProfile', { id });
    if (!data || !data.property) return;

    currentPropertyProfile = data;
    const p = data.property;

    const typeMap = { house: L('mdt_property_type_house'), apartment: L('mdt_property_type_apartment'), business: L('mdt_property_type_business'), garage: L('mdt_property_type_garage') };
    const statusMap = {
        clear:   { color: 'green',  label: L('mdt_property_status_clear') },
        flagged: { color: 'orange', label: L('mdt_property_status_flagged') },
        raid:    { color: 'red',    label: L('mdt_property_status_raid') },
        seized:  { color: 'blue',   label: L('mdt_property_status_seized') },
    };

    $('#propProfileAddress').textContent = p.address || '—';
    $('#propProfileType').textContent = typeMap[p.type] || p.type || '—';
    $('#propProfileOwner').textContent = p.owner_name || '—';
    $('#propProfileCid').textContent = p.owner_cid || '—';
    const s = statusMap[p.status] || statusMap.clear;
    $('#propProfileStatusBadge').innerHTML = `<span class="mdt-badge-pill mdt-badge-${s.color}">${s.label}</span>`;
    $('#propProfileOfficer').textContent = p.officer || '—';
    $('#propProfileDate').textContent = p.created_at ? formatDate(p.created_at) : '—';

    // Avatar
    const avatar = $('#propProfileAvatar');
    if (p.image_url && p.image_url !== '') {
        avatar.innerHTML = `<img src="${escHtml(p.image_url)}" alt="property" style="width:100%;height:100%;object-fit:cover">`;
    } else {
        avatar.innerHTML = '<i class="fa-solid fa-house-chimney" style="font-size:28px;color:#5AC8FA"></i>';
    }

    // Sub-Tab: Owner
    renderPropOwner(p);

    // Sub-Tab: Flags
    const flags = p.flags ? p.flags.split(',').map(f => f.trim()).filter(f => f) : [];
    $('#propFlagCount').textContent = flags.length;
    renderPropFlags(flags, p.notes || '');

    // Sub-Tab: History
    const ownerRecords = data.ownerRecords || [];
    $('#propHistoryCount').textContent = ownerRecords.length;
    renderPropHistory(ownerRecords);

    // Sub-Tab: Evidence
    const evidences = data.evidences || [];
    $('#propEvidenceCount').textContent = evidences.length;
    renderPropEvidence(evidences);

    // Notes
    renderPropNotes(data.notes || []);

    // Show overlay & reset tabs
    $('#propertyProfileOverlay').classList.remove('mdt-hidden');
    $$('[data-proptab]').forEach(b => b.classList.remove('active'));
    $$('.mdt-proptab-content').forEach(c => c.classList.remove('active'));
    $('[data-proptab="powner"]').classList.add('active');
    $('#proptab-powner').classList.add('active');
};

// Property sub-tab switching
document.addEventListener('click', e => {
    const btn = e.target.closest('[data-proptab]');
    if (!btn) return;
    $$('[data-proptab]').forEach(b => b.classList.remove('active'));
    $$('.mdt-proptab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('proptab-' + btn.dataset.proptab);
    if (target) target.classList.add('active');
});

$('#propProfileBackBtn').addEventListener('click', () => {
    $('#propertyProfileOverlay').classList.add('mdt-hidden');
    currentPropertyProfile = null;
});

function renderPropOwner(p) {
    const container = $('#proptab-powner');
    if (!p.owner_cid || p.owner_cid === '') {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-user-slash"></i><p>${L('mdt_empty_owner')}</p></div>`;
        return;
    }
    container.innerHTML = `
    <div class="mdt-card" onclick="switchToPersonAndLoad('${escHtml(p.owner_cid)}')" style="cursor:pointer">
        <div class="mdt-card-icon"><i class="fa-solid fa-user"></i></div>
        <div class="mdt-card-body">
            <div class="mdt-card-title">${escHtml(p.owner_name || p.owner_cid)}</div>
            <div class="mdt-card-sub">CitizenID: ${escHtml(p.owner_cid)}</div>
        </div>
        <div class="mdt-card-badges">
            <span class="mdt-badge-pill mdt-badge-blue">${L('mdt_btn_open_profile')}</span>
        </div>
    </div>`;
}

function renderPropFlags(flags, notes) {
    const container = $('#proptab-pflags');
    let html = '';
    if (flags.length) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${flags.map(f =>
            `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:12px;padding:4px 12px">${escHtml(f)}</span>`
        ).join('')}</div>`;
    }
    if (notes) {
        html += `<div class="mdt-card" style="cursor:default"><div class="mdt-card-body"><div class="mdt-card-title">${L('mdt_notes_label')}</div><div class="mdt-card-sub" style="margin-top:6px;white-space:pre-wrap">${escHtml(notes)}</div></div></div>`;
    }
    if (!html) html = `<div class="mdt-empty"><i class="fa-solid fa-flag"></i><p>${L('mdt_empty_flags')}</p></div>`;
    container.innerHTML = html;
}

function renderPropHistory(records) {
    const container = $('#proptab-phistory');
    if (!records.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>${L('mdt_empty_history')}</p></div>`;
        return;
    }
    container.innerHTML = records.map(r => {
        const typeClass = r.type === 'arrest' ? 'arrest' : r.type === 'citation' ? 'citation' : 'warning';
        const typeIcon = r.type === 'arrest' ? 'handcuffs' : r.type === 'citation' ? 'file-invoice-dollar' : 'triangle-exclamation';
        const date = r.timestamp ? formatDate(r.timestamp) : '';
        return `
        <div class="mdt-record">
            <div class="mdt-record-type ${typeClass}"><i class="fa-solid fa-${typeIcon}"></i></div>
            <div class="mdt-record-body">
                <div class="mdt-record-title">${escHtml(r.title)}</div>
                <div class="mdt-record-meta"><span>${date}</span>${r.officer ? `<span>${escHtml(r.officer)}</span>` : ''}</div>
                ${r.description ? `<div class="mdt-record-desc">${escHtml(r.description).substring(0, 120)}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderPropEvidence(evidences) {
    const container = $('#proptab-pevidence');
    if (!evidences.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-fingerprint"></i><p>${L('mdt_empty_evidence')}</p></div>`;
        return;
    }
    container.innerHTML = evidences.map(e => {
        const date = e.created_at ? formatDate(e.created_at) : '';
        return `
        <div class="mdt-card" style="cursor:default">
            <div class="mdt-card-icon" style="background:rgba(175,82,222,0.1);color:#AF52DE"><i class="fa-solid fa-fingerprint"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(e.title)} ${e.case_id ? `<span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">Fall #${escHtml(e.case_id)}</span>` : ''}</div>
                <div class="mdt-card-sub">${escHtml(e.officer || '')} · ${date}</div>
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-blue">${escHtml(e.type || 'physical')}</span>
            </div>
        </div>`;
    }).join('');
}

// Property Notes
function renderPropNotes(notes) {
    const container = $('#propNotesList');
    if (!notes.length) {
        container.innerHTML = `<div class="mdt-empty" style="color:rgba(255,255,255,0.3)"><i class="fa-solid fa-sticky-note"></i><p>${L('mdt_notes_none')}</p></div>`;
        return;
    }
    container.innerHTML = notes.map(n => {
        const date = n.created_at ? formatDateTime(n.created_at) : '';
        const tags = [];
        if (n.tag) tags.push(`<span class="mdt-note-tag ${n.tag}">${n.tag.toUpperCase()}</span>`);
        if (n.expire_at) tags.push(`<span class="mdt-note-tag expire">${L('mdt_notes_expire')}: ${formatDate(n.expire_at)}</span>`);
        return `
        <div class="mdt-note-card">
            <div class="mdt-note-card-title">${escHtml(n.title)}</div>
            <div class="mdt-note-card-meta">${L('mdt_notes_created_by')}: ${escHtml(n.officer || '—')}, ${date}</div>
            ${n.content ? `<div class="mdt-note-card-body">${safeHtml(n.content)}</div>` : ''}
            ${tags.length ? `<div class="mdt-note-card-tags">${tags.join('')}</div>` : ''}
            <button class="mdt-note-delete" onclick="deletePropNote(${n.id})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join('');
}

$('#propAddNoteBtn').addEventListener('click', () => {
    if (!currentPropertyProfile) return;
    showModal(L('mdt_btn_create_note'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_title")}</label>
            <input class="mdt-form-input" id="modalPropNoteTitle" type="text" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_note_content")}</label>
            <textarea class="mdt-form-textarea" id="modalPropNoteContent" placeholder="..."></textarea>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_tag")}</label>
                <select class="mdt-form-select" id="modalPropNoteTag">
                    <option value="">${L("mdt_note_tag_none")}</option>
                    <option value="important">IMPORTANT</option>
                    <option value="info">INFO</option>
                    <option value="warning">WARNING</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_note_expire_date")}</label>
                <input class="mdt-form-input" id="modalPropNoteExpire" type="text" placeholder="${datePlaceholder(_dateTimeFormat)}">
            </div>
        </div>
    `, async () => {
        const title = $('#modalPropNoteTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiAddPropertyNote', {
            property_id: currentPropertyProfile.property.id,
            title,
            content:   $('#modalPropNoteContent').value.trim(),
            tag:       $('#modalPropNoteTag').value,
            expire_at: $('#modalPropNoteExpire').value.trim(),
        });
        hideModal();
        loadPropertyProfile(currentPropertyProfile.property.id);
    });
});

window.deletePropNote = async function(id) {
    await nuiPost('mdtNuiDeletePropertyNote', { id });
    if (currentPropertyProfile) loadPropertyProfile(currentPropertyProfile.property.id);
};

// ── Property Edit Profile ────────────────────────────────────────

$('#propProfileEditBtn').addEventListener('click', () => {
    if (!currentPropertyProfile) return;
    const p = currentPropertyProfile.property;
    openPropertyModal(p);
});

function openPropertyModal(p = null) {
    const isEdit = !!p;
    showModal(isEdit ? L('mdt_modal_prop_edit') : L('mdt_modal_prop_add'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label" data-l="mdt_modal_prop_address">Adresse</label>
            <input class="mdt-form-input" id="modalPropAddress" type="text" value="${escHtml(p ? p.address : '')}" placeholder="...">
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1;position:relative">
                <label class="mdt-form-label">${L("mdt_modal_prop_owner")}</label>
                <input class="mdt-form-input" id="modalPropOwnerName" type="text" value="${escHtml(p ? p.owner_name : '')}" placeholder="..." autocomplete="off">
                <div id="modalPropOwnerSuggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--mdt-surface);border:1px solid var(--mdt-veil-6);border-radius:8px;max-height:160px;overflow-y:auto;z-index:99;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.1)"></div>
            </div>
            <div class="mdt-form-group" style="flex:0.6">
                <label class="mdt-form-label">CitizenID</label>
                <input class="mdt-form-input" id="modalPropOwnerCid" type="text" value="${escHtml(p ? p.owner_cid : '')}" readonly style="opacity:0.6;cursor:not-allowed">
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_record_type")}</label>
                <select class="mdt-form-select" id="modalPropType">
                    <option value="house" ${!p || p.type==='house' ? 'selected':''}>${L('mdt_property_type_house')}</option>
                    <option value="apartment" ${p && p.type==='apartment' ? 'selected':''}>${L('mdt_property_type_apartment')}</option>
                    <option value="business" ${p && p.type==='business' ? 'selected':''}>${L('mdt_property_type_business')}</option>
                    <option value="garage" ${p && p.type==='garage' ? 'selected':''}>${L('mdt_property_type_garage')}</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_profile_status")}</label>
                <select class="mdt-form-select" id="modalPropStatus">
                    <option value="clear" ${!p || p.status==='clear' ? 'selected':''}>${L('mdt_property_status_clear')}</option>
                    <option value="flagged" ${p && p.status==='flagged' ? 'selected':''}>${L('mdt_status_suspect')}</option>
                    <option value="raid" ${p && p.status==='raid' ? 'selected':''}>${L('mdt_property_status_raid')}</option>
                    <option value="seized" ${p && p.status==='seized' ? 'selected':''}>${L('mdt_property_status_seized')}</option>
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_modal_prop_flags")}</label>
            <input class="mdt-form-input" id="modalPropFlags" type="text" value="${escHtml(p ? p.flags : '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_notes_label")}</label>
            <textarea class="mdt-form-textarea" id="modalPropNotes">${escHtml(p ? p.notes : '')}</textarea>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_profile_image_url")}</label>
            <input class="mdt-form-input" id="modalPropImage" type="text" value="${escHtml(p ? p.image_url || '' : '')}" placeholder="https://...">
        </div>
    `, async () => {
        const address = $('#modalPropAddress').value.trim();
        if (!address) return;
        const payload = {
            address,
            owner_name: $('#modalPropOwnerName').value.trim(),
            owner_cid:  $('#modalPropOwnerCid').value.trim(),
            type:       $('#modalPropType').value,
            status:     $('#modalPropStatus').value,
            flags:      $('#modalPropFlags').value.trim(),
            notes:      $('#modalPropNotes').value.trim(),
            image_url:  $('#modalPropImage').value.trim(),
        };
        if (isEdit) {
            payload.id = p.id;
            await nuiPost('mdtNuiUpdateProperty', payload);
            hideModal();
            loadPropertyProfile(p.id);
        } else {
            await nuiPost('mdtNuiAddProperty', payload);
            hideModal();
            $('#propertySearchInput').value = address;
            searchProperty();
        }
    });

    if (isEdit) {
        setModalDangerAction(L('mdt_modal_prop_delete'), async () => {
            await nuiPost('mdtNuiDeleteProperty', { id: p.id });
            hideModal();
            $('#propertyProfileOverlay').classList.add('mdt-hidden');
            currentPropertyProfile = null;
            searchProperty();
        });
    }

    // Owner autocomplete
    setupOwnerAutocomplete('modalPropOwnerName', 'modalPropOwnerCid', 'modalPropOwnerSuggestions');
}

// ══════════════════════════════════════════════════════════════════
//  Weapons (Waffen-Register)
// ══════════════════════════════════════════════════════════════════

let currentWeaponsList = [];

$('#weaponSearchBtn').addEventListener('click', searchWeapon);
$('#weaponSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchWeapon(); });
$('#weaponSearchInput').addEventListener('input', debounce(() => {
    const v = $('#weaponSearchInput').value.trim();
    if (v.length < 2) { $('#weaponResults').innerHTML = ''; return; }
    searchWeapon();
}, 250));

async function searchWeapon() {
    const query = $('#weaponSearchInput').value.trim();
    if (query.length < 2) return;
    const data = await nuiPost('mdtNuiSearchWeapon', { query });
    renderWeaponResults(data && data.results ? data.results : []);
}

function renderWeaponResults(results) {
    const container = $('#weaponResults');
    currentWeaponsList = results;
    if (!results.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-gun"></i><p>${L('mdt_empty_weapons')}</p></div>`;
        return;
    }
    container.innerHTML = results.map(w => {
        const statusColor = w.status === 'registered' ? 'green' : w.status === 'stolen' ? 'red' : w.status === 'illegal' ? 'red' : w.status === 'seized' ? 'orange' : 'blue';
        return `
        <div class="mdt-card">
            <div class="mdt-card-icon" style="background:rgba(255,69,58,0.08);color:#FF3B30"><i class="fa-solid fa-gun"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(w.weapon_type || L('mdt_unknown'))} <span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">#${escHtml(w.serial_number)}</span></div>
                <div class="mdt-card-sub">${escHtml(w.owner_name || L('mdt_no_owner'))} ${w.owner_cid ? '· ' + escHtml(w.owner_cid) : ''}</div>
                ${w.edit_log ? `<div class="mdt-card-sub" style="font-size:0.85em;opacity:0.6;margin-top:4px"><i>${escHtml(w.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-${statusColor}">${escHtml(w.status || 'registered')}</span>
            </div>
            <div class="mdt-card-actions" style="margin-left:auto;padding-right:16px">
                <button class="mdt-action-btn" onclick="editWeapon(${w.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        </div>`;
    }).join('');
}

$('#weaponAddBtn').addEventListener('click', () => openWeaponModal());

window.editWeapon = function(id) {
    const w = currentWeaponsList.find(x => x.id === id);
    if (w) openWeaponModal(w);
};

function openWeaponModal(w = null) {
    const isEdit = !!w;
    showModal(isEdit ? L('mdt_modal_weapon_edit') : L('mdt_modal_weapon_add'), `
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_modal_weapon_serial")}</label>
                <input class="mdt-form-input" id="modalWeaponSerial" type="text" value="${escHtml(w ? w.serial_number : '')}" placeholder="..." ${isEdit ? 'readonly style="opacity:0.6"' : ''}>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L("mdt_modal_weapon_type")}</label>
                <input class="mdt-form-input" id="modalWeaponType" type="text" value="${escHtml(w ? w.weapon_type : '')}" placeholder="...">
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1;position:relative">
                <label class="mdt-form-label">${L("mdt_modal_weapon_owner")}</label>
                <input class="mdt-form-input" id="modalWeaponOwnerName" type="text" value="${escHtml(w ? w.owner_name : '')}" placeholder="..." autocomplete="off">
                <div id="modalWeaponOwnerSuggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--mdt-surface);border:1px solid var(--mdt-veil-6);border-radius:8px;max-height:160px;overflow-y:auto;z-index:99;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.1)"></div>
            </div>
            <div class="mdt-form-group" style="flex:0.6">
                <label class="mdt-form-label">CitizenID</label>
                <input class="mdt-form-input" id="modalWeaponOwnerCid" type="text" value="${escHtml(w ? w.owner_cid : '')}" readonly style="opacity:0.6;cursor:not-allowed">
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_profile_status")}</label>
            <select class="mdt-form-select" id="modalWeaponStatus">
                <option value="registered" ${!w || w.status==='registered' ? 'selected':''}>${L('mdt_weapon_status_registered')}</option>
                <option value="stolen" ${w && w.status==='stolen' ? 'selected':''}>${L('mdt_weapon_status_stolen')}</option>
                <option value="illegal" ${w && w.status==='illegal' ? 'selected':''}>${L('mdt_weapon_status_illegal')}</option>
                <option value="seized" ${w && w.status==='seized' ? 'selected':''}>${L('mdt_property_status_seized')}</option>
                <option value="destroyed" ${w && w.status==='destroyed' ? 'selected':''}>${L('mdt_evidence_status_destroyed')}</option>
            </select>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_modal_prop_flags")}</label>
            <input class="mdt-form-input" id="modalWeaponFlags" type="text" value="${escHtml(w ? w.flags : '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_notes_label")}</label>
            <textarea class="mdt-form-textarea" id="modalWeaponNotes">${escHtml(w ? w.notes : '')}</textarea>
        </div>
    `, async () => {
        const serial = $('#modalWeaponSerial').value.trim();
        if (!serial) return;
        const payload = {
            serial_number: serial,
            weapon_type:   $('#modalWeaponType').value.trim(),
            owner_name:    $('#modalWeaponOwnerName').value.trim(),
            owner_cid:     $('#modalWeaponOwnerCid').value.trim(),
            status:        $('#modalWeaponStatus').value,
            flags:         $('#modalWeaponFlags').value.trim(),
            notes:         $('#modalWeaponNotes').value.trim(),
        };
        if (isEdit) {
            payload.id = w.id;
            await nuiPost('mdtNuiUpdateWeapon', payload);
        } else {
            await nuiPost('mdtNuiAddWeapon', payload);
        }
        hideModal();
        $('#weaponSearchInput').value = payload.serial_number || payload.weapon_type || '';
        searchWeapon();
    });

    if (isEdit) {
        setModalDangerAction(L('mdt_modal_weapon_delete'), async () => {
            await nuiPost('mdtNuiDeleteWeapon', { id: w.id });
            hideModal();
            searchWeapon();
        });
    }

    // Owner autocomplete
    setupOwnerAutocomplete('modalWeaponOwnerName', 'modalWeaponOwnerCid', 'modalWeaponOwnerSuggestions');
}

// ══════════════════════════════════════════════════════════════════
//  Evidences (Beweismittel)
// ══════════════════════════════════════════════════════════════════

let currentEvidencesList = [];

$('#evidenceSearchBtn').addEventListener('click', searchEvidence);
$('#evidenceSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchEvidence(); });
$('#evidenceSearchInput').addEventListener('input', debounce(() => {
    const v = $('#evidenceSearchInput').value.trim();
    if (v.length < 2) { $('#evidenceResults').innerHTML = ''; return; }
    searchEvidence();
}, 250));

async function searchEvidence() {
    const query = $('#evidenceSearchInput').value.trim();
    if (query.length < 2) return;
    const data = await nuiPost('mdtNuiSearchEvidence', { query });
    renderEvidenceResults(data && data.results ? data.results : []);
}

function renderEvidenceResults(results) {
    const container = $('#evidenceResults');
    currentEvidencesList = results;
    if (!results.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-fingerprint"></i><p>${L('mdt_empty_evidences')}</p></div>`;
        return;
    }
    container.innerHTML = results.map(e => {
        const typeIcon = e.type === 'physical' ? 'box-archive' : e.type === 'digital' ? 'hard-drive' : e.type === 'biological' ? 'dna' : e.type === 'documentary' ? 'file-lines' : e.type === 'photo' ? 'camera' : 'fingerprint';
        const statusColor = e.status === 'active' ? 'green' : e.status === 'archived' ? 'blue' : e.status === 'destroyed' ? 'red' : 'orange';
        const date = e.created_at ? formatDate(e.created_at) : '';
        return `
        <div class="mdt-card">
            <div class="mdt-card-icon" style="background:rgba(175,82,222,0.1);color:#AF52DE"><i class="fa-solid fa-${typeIcon}"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(e.title)} ${e.evidence_number ? `<span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">${escHtml(e.evidence_number)}</span>` : ''}</div>
                <div class="mdt-card-sub">${escHtml(e.officer || '')} · ${date} ${e.location ? '· ' + escHtml(e.location) : ''}${e.citizen_name ? ' · <i class="fa-solid fa-user"></i> ' + escHtml(e.citizen_name) : ''}</div>
                ${e.description ? `<div class="mdt-card-sub" style="margin-top:4px">${escHtml(e.description).substring(0, 120)}</div>` : ''}
                ${e.edit_log ? `<div class="mdt-card-sub" style="font-size:0.85em;opacity:0.6;margin-top:4px"><i>${escHtml(e.edit_log)}</i></div>` : ''}
            </div>
            <div class="mdt-card-badges">
                <span class="mdt-badge-pill mdt-badge-blue">${escHtml(e.type || 'physical')}</span>
                <span class="mdt-badge-pill mdt-badge-${statusColor}">${escHtml(e.status || 'active')}</span>
            </div>
            <div class="mdt-card-actions" style="margin-left:auto;padding-right:16px">
                <button class="mdt-action-btn" onclick="editEvidence(${e.id})"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
        </div>`;
    }).join('');
}

$('#evidenceAddBtn').addEventListener('click', () => openEvidenceModal());

window.editEvidence = function(id) {
    const e = currentEvidencesList.find(x => x.id === id);
    if (e) openEvidenceModal(e);
};

function openEvidenceModal(e = null) {
    const isEdit = !!e;
    showModal(isEdit ? L('mdt_modal_evidence_edit') : L('mdt_modal_evidence_add'), `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">BW-NR.</label>
                <input class="mdt-form-input" id="modalEvidNumber" type="text"
                    value="${escHtml(e ? (e.evidence_number || '') : '')}"
                    placeholder="Wird automatisch vergeben" readonly
                    style="background:var(--mdt-surface-alt);color:var(--mdt-text-muted);cursor:default">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L("mdt_modal_evidence_type")}</label>
                <select class="mdt-form-select" id="modalEvidType">
                    <option value="physical" ${!e || e.type==='physical' ? 'selected':''}>${L('mdt_evidence_type_physical')}</option>
                    <option value="digital" ${e && e.type==='digital' ? 'selected':''}>${L('mdt_evidence_type_digital')}</option>
                    <option value="biological" ${e && e.type==='biological' ? 'selected':''}>${L('mdt_evidence_type_biological')}</option>
                    <option value="documentary" ${e && e.type==='documentary' ? 'selected':''}>${L('mdt_evidence_type_documentary')}</option>
                    <option value="photo" ${e && e.type==='photo' ? 'selected':''}>${L('mdt_evidence_type_photo')}</option>
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_modal_evidence_title")}</label>
            <input class="mdt-form-input" id="modalEvidTitle" type="text" value="${escHtml(e ? e.title : '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L("mdt_record_description")}</label>
            <div id="rteEvidDesc"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L("mdt_modal_evidence_location")}</label>
                <input class="mdt-form-input" id="modalEvidLocation" type="text" value="${escHtml(e ? e.location : '')}" placeholder="...">
            </div>
            <div class="mdt-form-group" style="position:relative">
                <label class="mdt-form-label">${L("mdt_modal_evidence_cid")}</label>
                <input class="mdt-form-input" id="modalEvidCitizenSearch" type="text"
                    value="${escHtml(e ? (e.citizen_name || e.citizenid || '') : '')}"
                    placeholder="Name eingeben..." autocomplete="off">
                <div id="modalEvidCitizenDrop" class="mdt-ac-drop"></div>
                <input type="hidden" id="modalEvidCid" value="${escHtml(e ? (e.citizenid || '') : '')}">
                <input type="hidden" id="modalEvidCitizenName" value="${escHtml(e ? (e.citizen_name || '') : '')}">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L("mdt_profile_image_url")}</label>
                <input class="mdt-form-input" id="modalEvidImage" type="text" value="${escHtml(e ? e.image_url : '')}" placeholder="https://...">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L("mdt_profile_status")}</label>
                <select class="mdt-form-select" id="modalEvidStatus">
                    <option value="active" ${!e || e.status==='active' ? 'selected':''}>${L('mdt_evidence_status_active')}</option>
                    <option value="archived" ${e && e.status==='archived' ? 'selected':''}>${L('mdt_evidence_status_archived')}</option>
                    <option value="transferred" ${e && e.status==='transferred' ? 'selected':''}>${L('mdt_evidence_status_transferred')}</option>
                    <option value="destroyed" ${e && e.status==='destroyed' ? 'selected':''}>${L('mdt_evidence_status_destroyed')}</option>
                </select>
            </div>
        </div>
    `, async () => {
        const title = $('#modalEvidTitle').value.trim();
        if (!title) return;
        const rteBody = $('#rteEvidDesc_body');
        const payload = {
            case_id:      '',
            type:         $('#modalEvidType').value,
            title,
            description:  rteBody ? rteBody.innerHTML.trim() : '',
            location:     $('#modalEvidLocation').value.trim(),
            citizenid:    $('#modalEvidCid').value.trim(),
            citizen_name: $('#modalEvidCitizenName').value.trim(),
            image_url:    $('#modalEvidImage').value.trim(),
            status:       $('#modalEvidStatus').value,
        };
        if (isEdit) {
            payload.id = e.id;
            await nuiPost('mdtNuiUpdateEvidence', payload);
        } else {
            const result = await nuiPost('mdtNuiAddEvidence', payload);
            if (result && result.evidence_number) {
                const numEl = $('#modalEvidNumber');
                if (numEl) numEl.value = result.evidence_number;
            }
        }
        hideModal();
        $('#evidenceSearchInput').value = payload.title || '';
        searchEvidence();
    });

    if (isEdit) {
        setModalDangerAction(L('mdt_modal_evidence_delete'), async () => {
            await nuiPost('mdtNuiDeleteEvidence', { id: e.id });
            hideModal(); searchEvidence();
        });
    }

    setTimeout(() => {
        // RTE für Beschreibung
        createRTE('rteEvidDesc', L('mdt_record_description'), e ? (e.description || '') : '');

        // Personensuche für zugeordnete Person
        const searchEl = $('#modalEvidCitizenSearch');
        const dropEl   = $('#modalEvidCitizenDrop');
        const cidEl    = $('#modalEvidCid');
        const nameEl   = $('#modalEvidCitizenName');
        if (!searchEl || !dropEl) return;

        let debounce;
        searchEl.addEventListener('input', () => {
            clearTimeout(debounce);
            cidEl.value = ''; nameEl.value = '';
            const q = searchEl.value.trim();
            if (q.length < 2) { dropEl.style.display = 'none'; return; }
            debounce = setTimeout(async () => {
                const data = await nuiPost('mdtNuiSearchPerson', { query: q });
                const res = (data && data.results ? data.results : [])
                    .filter(p => p.name && p.name.trim() && p.name !== p.citizenid);
                if (!res.length) { dropEl.style.display = 'none'; return; }
                dropEl.innerHTML = res.slice(0, 8).map(p =>
                    `<div class="mdt-ac-item" data-id="${escHtml(p.citizenid)}" data-label="${escHtml(p.name)}">
                        <strong>${highlightMatch(p.name, q)}</strong>
                        <span class="mdt-ac-item-sub">${escHtml(p.citizenid)}</span>
                    </div>`
                ).join('');
                dropEl.style.display = 'block';
            }, 250);
        });
        dropEl.addEventListener('mousedown', ev => {
            const item = ev.target.closest('.mdt-ac-item');
            if (!item) return;
            ev.preventDefault();
            cidEl.value    = item.dataset.id;
            nameEl.value   = item.dataset.label;
            searchEl.value = item.dataset.label;
            dropEl.style.display = 'none';
        });
        searchEl.addEventListener('blur', () => setTimeout(() => dropEl.style.display = 'none', 150));
    }, 50);
}

// ── Helpers ──────────────────────────────────────────────────────

// ── Apply locale to HTML elements with data-l attributes ────────

function applyLocale() {
    $$('[data-l]').forEach(el => {
        const key = el.dataset.l;
        if (_locale[key]) el.textContent = _locale[key];
    });
    $$('[data-l-placeholder]').forEach(el => {
        const key = el.dataset.lPlaceholder;
        if (_locale[key]) el.placeholder = _locale[key];
    });
    $$('[data-l-title]').forEach(el => {
        const key = el.dataset.lTitle;
        if (_locale[key]) el.title = _locale[key];
    });
}

// ── Cross-navigation from profile sub-tabs ───────────────────────

window.openPropertyFromProfile = function(id) {
    // Switch to Immobilien tab and open property profile
    $$('.mdt-nav-item').forEach(b => b.classList.remove('active'));
    $('.mdt-nav-item[data-tab="properties"]').classList.add('active');
    $$('.mdt-tab').forEach(t => t.classList.remove('active'));
    $('#tab-properties').classList.add('active');
    $('#profileOverlay').classList.add('mdt-hidden');
    loadPropertyProfile(id);
};

window.openVehicleFromProfile = function(plate) {
    // Switch to Fahrzeuge tab and open vehicle profile
    $$('.mdt-nav-item').forEach(b => b.classList.remove('active'));
    $('.mdt-nav-item[data-tab="vehicles"]').classList.add('active');
    $$('.mdt-tab').forEach(t => t.classList.remove('active'));
    $('#tab-vehicles').classList.add('active');
    $('#profileOverlay').classList.add('mdt-hidden');
    loadVehicleProfile(plate);
};

function setupOwnerAutocomplete(nameId, cidId, suggestionsId) {
    let timeout = null;
    const nameEl = document.getElementById(nameId);
    const cidEl = document.getElementById(cidId);
    const box = document.getElementById(suggestionsId);
    if (!nameEl || !box) return;

    nameEl.addEventListener('input', () => {
        clearTimeout(timeout);
        const q = nameEl.value.trim();
        if (q.length < 2) { box.style.display = 'none'; return; }
        timeout = setTimeout(async () => {
            const data = await nuiPost('mdtNuiSearchPerson', { query: q });
            const results = (data && data.results ? data.results : []).filter(r => r.name && r.name.trim() !== '');
            if (!results.length) { box.style.display = 'none'; return; }
            box.style.display = 'block';
            box.innerHTML = results.slice(0, 8).map(r => `
                <div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid rgba(0,0,0,0.04);display:flex;justify-content:space-between;align-items:center"
                     onmousedown="event.preventDefault()"
                     onclick="document.getElementById('${nameId}').value='${escHtml(r.name)}';document.getElementById('${cidId}').value='${escHtml(r.citizenid)}';document.getElementById('${suggestionsId}').style.display='none'">
                    <span style="font-weight:500">${escHtml(r.name)}</span>
                    <span style="color:var(--mdt-text-muted);font-size:11px">${escHtml(r.citizenid)}</span>
                </div>
            `).join('');
        }, 250);
    });
    nameEl.addEventListener('blur', () => {
        setTimeout(() => { box.style.display = 'none'; }, 200);
    });
}

// ══════════════════════════════════════════════════════════════════
//  Cases (Fall-Akten)
// ══════════════════════════════════════════════════════════════════

let currentCase = null;

function caseStatusBadge(status) {
    const map = {
        open:       { color: 'green',  label: L('mdt_case_status_open') },
        active:     { color: 'blue',   label: L('mdt_case_status_active') },
        suspended:  { color: 'orange', label: L('mdt_case_status_suspended') },
        closed:     { color: 'gray',   label: L('mdt_case_status_closed') },
        cold:       { color: 'red',    label: L('mdt_case_status_cold') }
    };
    const s = map[status] || map['open'];
    return `<span class="mdt-badge-pill mdt-badge-${s.color}">${s.label}</span>`;
}

function casePriorityBadge(p) {
    const map = {
        low:    { color: 'green',  label: L('mdt_case_prio_low') },
        medium: { color: 'orange', label: L('mdt_case_prio_medium') },
        high:   { color: 'red',    label: L('mdt_case_prio_high') },
        critical:{ color: 'red',   label: L('mdt_case_prio_critical') }
    };
    const s = map[p] || map['medium'];
    return `<span class="mdt-badge-pill mdt-badge-${s.color}" style="font-size:10px">${s.label}</span>`;
}

function caseTypeLabel(type) {
    const map = {
        investigation: L('mdt_case_type_investigation'),
        homicide:      L('mdt_case_type_homicide'),
        narcotics:     L('mdt_case_type_narcotics'),
        robbery:       L('mdt_case_type_robbery'),
        fraud:         L('mdt_case_type_fraud'),
        other:         L('mdt_case_type_other')
    };
    return map[type] || type || '';
}

async function searchCase() {
    const query = $('#caseSearchInput').value.trim();
    if (query.length < 2) { $('#caseResults').innerHTML = ''; return; }
    const res = await nuiPost('mdtNuiSearchCase', { query });
    renderCaseResults(res.results || []);
}

function renderCaseResults(cases) {
    const container = $('#caseResults');
    if (!cases.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-folder-open"></i><p>${L('mdt_empty_cases')}</p></div>`;
        return;
    }
    container.innerHTML = cases.map(c => `
        <div class="mdt-card" style="cursor:pointer" onclick="loadCaseDetail(${c.id})">
            <div class="mdt-card-icon"><i class="fa-solid fa-folder-open"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(c.case_number)} — ${escHtml(c.title)} ${caseStatusBadge(c.status)} ${casePriorityBadge(c.priority)}</div>
                <div class="mdt-card-sub">${caseTypeLabel(c.type)} · ${escHtml(c.lead_officer || '')} · ${formatDate(c.updated_at)}</div>
                ${c.description ? `<div class="mdt-card-sub" style="margin-top:4px;opacity:0.7">${stripHtml(c.description).substring(0, 120)}...</div>` : ''}
            </div>
        </div>
    `).join('');
}

// ── Case Detail ─────────────────────────────────────────────────

window.loadCaseDetail = async function(id) {
    const data = await nuiPost('mdtNuiGetCase', { id });
    if (!data || !data.case) return;
    currentCase = data;

    const c = data.case;
    const overlay = $('#caseDetailOverlay');
    overlay.classList.remove('mdt-hidden');

    // Format timestamp safely
    const formatDate = (val) => {
        if (!val) return '—';
        // If already a formatted string (contains . or /)
        if (typeof val === 'string' && (val.includes('.') || val.includes('/') || val.includes('-'))) {
            return val;
        }
        let t = typeof val === 'number' ? val : parseInt(val);
        if (isNaN(t)) return val;
        if (t > 10000000000) t = Math.floor(t / 1000);
        return new Date(t * 1000).toLocaleDateString(_dateLocale, {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Header
    $('#caseHeader').innerHTML = `
        <div class="mdt-case-header-top">
            <div class="mdt-case-icon">
                <i class="fa-solid fa-folder-open"></i>
            </div>
            <div class="mdt-case-title-block">
                <div class="mdt-case-number">
                    ${escHtml(c.case_number)}
                    ${caseStatusBadge(c.status)}
                    ${casePriorityBadge(c.priority)}
                </div>
                <div class="mdt-case-subtitle">${escHtml(c.title)}</div>
            </div>
        </div>
        <div class="mdt-case-meta">
            <div class="mdt-case-meta-item">
                <div class="mdt-case-meta-label">${L('mdt_case_lead')}</div>
                <div class="mdt-case-meta-value">${escHtml(c.lead_officer || '—')}</div>
            </div>
            <div class="mdt-case-meta-item">
                <div class="mdt-case-meta-label">${L('mdt_report_type')}</div>
                <div class="mdt-case-meta-value">${caseTypeLabel(c.type)}</div>
            </div>
            <div class="mdt-case-meta-item">
                <div class="mdt-case-meta-label">${L('mdt_property_date')}</div>
                <div class="mdt-case-meta-value">${formatDate(c.created_at)}</div>
            </div>
        </div>
        ${c.description ? `<div class="mdt-case-description">${safeHtml(c.description)}</div>` : ''}
        
    `;

    renderCaseLinks(data.links || []);
    renderCaseNotes(data.notes || []);
    renderCaseTimeline(data.timeline || []);

    // Activate first sub-tab
    $$('.mdt-ptab[data-ctab]').forEach(t => t.classList.remove('active'));
    $$('.mdt-case-tab-content').forEach(t => t.classList.add('mdt-hidden'));
    const first = $('.mdt-ptab[data-ctab="cpersons"]');
    if (first) first.classList.add('active');
    const firstTab = $('#ctab-cpersons');
    if (firstTab) firstTab.classList.remove('mdt-hidden');
};

function renderCaseLinks(links) {
    const types = { citizen: 'cpersons', vehicle: 'cvehicles', evidence: 'cevidence', report: 'creports' };
    const icons = { citizen: 'fa-user', vehicle: 'fa-car', evidence: 'fa-fingerprint', report: 'fa-file-lines' };

    for (const [type, tabId] of Object.entries(types)) {
        const items = links.filter(l => l.link_type === type);
        const container = $(`#ctab-${tabId}`);
        if (!container) continue;

        const addBtnLabel = type === 'citizen' ? L('mdt_case_add_person') :
                           type === 'vehicle' ? L('mdt_case_add_vehicle') :
                           type === 'evidence' ? L('mdt_case_add_evidence') :
                           L('mdt_case_add_report');

        let html = `<div style="margin:12px 0"><button class="mdt-btn mdt-btn-primary" style="font-size:12px" onclick="openAddCaseLinkModal('${type}')"><i class="fa-solid fa-plus"></i> ${addBtnLabel}</button></div>`;

        if (!items.length) {
            html += `<div class="mdt-empty" style="padding:20px"><p>${L('mdt_empty_results')}</p></div>`;
        } else {
            html += items.map(l => `
                <div class="mdt-card" style="cursor:pointer">
                    <div class="mdt-card-icon"><i class="fa-solid ${icons[type] || 'fa-link'}"></i></div>
                    <div class="mdt-card-body" onclick="${type === 'citizen' ? `switchToPersonAndLoad('${escHtml(l.link_id)}')` : type === 'vehicle' ? `loadVehicleProfile('${escHtml(l.link_id)}')` : ''}">
                        <div class="mdt-card-title">${escHtml(l.label || l.link_id)}</div>
                        <div class="mdt-card-sub">${l.role ? escHtml(l.role) + ' · ' : ''}${L('mdt_notes_created_by')}: ${escHtml(l.added_by || '')} · ${formatDate(l.created_at)}</div>
                    </div>
                    <button class="mdt-action-btn" style="color:var(--mdt-danger,#FF3B30);margin-left:auto" onclick="removeCaseLink(${l.id})"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('');
        }
        container.innerHTML = html;
    }
}

function renderCaseNotes(notes) {
    const container = $('#caseNotesList');
    if (!notes.length) {
        container.innerHTML = `<div class="mdt-empty"><p>${L('mdt_notes_none')}</p></div>`;
        return;
    }
    container.innerHTML = notes.map(n => `
        <div class="mdt-note-card">
            <div class="mdt-note-card-title">${escHtml(n.title)}</div>
            <div class="mdt-note-card-meta">${L('mdt_notes_created_by')}: ${escHtml(n.officer || '')} · ${formatDateTime(n.created_at)}</div>
            ${n.content ? `<div class="mdt-note-card-body">${safeHtml(n.content)}</div>` : ''}
            ${n.tag ? `<div class="mdt-note-card-tags"><span class="mdt-note-tag ${n.tag.toLowerCase()}">${escHtml(n.tag)}</span></div>` : ''}
            <button class="mdt-note-delete" onclick="deleteCaseNote(${n.id})"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

function renderCaseTimeline(timeline) {
    const container = $('#ctab-ctimeline');
    if (!timeline.length) {
        container.innerHTML = `<div class="mdt-empty" style="padding:20px"><i class="fa-solid fa-clock-rotate-left"></i><p>${L('mdt_audit_empty')}</p></div>`;
        return;
    }
    container.innerHTML = `<div style="padding:12px">${timeline.map(t => `
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--mdt-veil-3);font-size:13px">
            <div style="color:var(--mdt-text-muted);min-width:130px">${formatDateTime(t.created_at)}</div>
            <div style="flex:1">
                <strong>${escHtml(t.officer || '')}</strong>
                <span style="color:var(--mdt-text-muted);margin-left:4px">${escHtml(t.action || '')}</span>
                ${t.details ? `<span style="color:var(--mdt-text-secondary)"> — ${escHtml(t.details)}</span>` : ''}
            </div>
        </div>
    `).join('')}</div>`;
}

// ── Add Link Modal ──────────────────────────────────────────────

window.openAddCaseLinkModal = function(linkType) {
    if (!currentCase) return;
    const labelMap = { citizen: L('mdt_profile_citizenid'), vehicle: L('mdt_vehicle_plate'), evidence: L('mdt_modal_evidence_case'), report: L('mdt_report_title') };
    const roleLabel = linkType === 'citizen' ? L('mdt_case_role') : '';

    showModal(L('mdt_case_add_link'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${labelMap[linkType] || 'ID'}</label>
            <input class="mdt-form-input" id="modalCaseLinkId" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_case_link_label')}</label>
            <input class="mdt-form-input" id="modalCaseLinkLabel" placeholder="${L('mdt_case_link_label_hint')}">
        </div>
        ${roleLabel ? `<div class="mdt-form-group">
            <label class="mdt-form-label">${roleLabel}</label>
            <select class="mdt-form-select" id="modalCaseLinkRole">
                <option value="suspect">${L('mdt_case_role_suspect')}</option>
                <option value="witness">${L('mdt_case_role_witness')}</option>
                <option value="victim">${L('mdt_case_role_victim')}</option>
                <option value="informant">${L('mdt_case_role_informant')}</option>
                <option value="other">${L('mdt_case_role_other')}</option>
            </select>
        </div>` : ''}
    `, async () => {
        const linkId = $('#modalCaseLinkId').value.trim();
        if (!linkId) return;
        await nuiPost('mdtNuiAddCaseLink', {
            case_id: currentCase.case.id,
            link_type: linkType,
            link_id: linkId,
            label: $('#modalCaseLinkLabel').value.trim(),
            role: linkType === 'citizen' && $('#modalCaseLinkRole') ? $('#modalCaseLinkRole').value : ''
        });
        hideModal();
        loadCaseDetail(currentCase.case.id);
    });

    // Autocomplete for citizens
    if (linkType === 'citizen') {
        setupOwnerAutocomplete('modalCaseLinkId', 'modalCaseLinkLabel');
    }
};

window.removeCaseLink = async function(linkId) {
    if (!confirm(L('mdt_case_confirm_remove'))) return;
    await nuiPost('mdtNuiRemoveCaseLink', { id: linkId });
    if (currentCase) loadCaseDetail(currentCase.case.id);
};

// ── Case Notes ──────────────────────────────────────────────────

window.openCaseNoteModal = function() {
    if (!currentCase) return;
    showModal(L('mdt_btn_create_note'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_note_title')}</label>
            <input class="mdt-form-input" id="modalCaseNoteTitle" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_note_content')}</label>
            <div id="rteCaseNoteContent"></div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_note_tag')}</label>
            <select class="mdt-form-select" id="modalCaseNoteTag">
                <option value="">${L('mdt_note_tag_none')}</option>
                <option value="IMPORTANT">IMPORTANT</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="LEAD">LEAD</option>
            </select>
        </div>
    `, async () => {
        const title = $('#modalCaseNoteTitle').value.trim();
        if (!title) return;
        await nuiPost('mdtNuiAddCaseNote', {
            case_id: currentCase.case.id,
            title: title,
            content: ($('#rteCaseNoteContent_body') ? $('#rteCaseNoteContent_body').innerHTML.trim() : ''),
            tag: $('#modalCaseNoteTag').value
        });
        hideModal();
        loadCaseDetail(currentCase.case.id);
    });

    // Initialize RTE
    setTimeout(() => { createRTE('rteCaseNoteContent', '...', ''); }, 50);
};

window.deleteCaseNote = async function(noteId) {
    await nuiPost('mdtNuiDeleteCaseNote', { id: noteId });
    if (currentCase) loadCaseDetail(currentCase.case.id);
};

// ── Case Create/Edit Modal ──────────────────────────────────────

function openCaseModal(existing) {
    const isEdit = !!existing;
    const c = existing || {};
    showModal(isEdit ? L('mdt_case_edit') : L('mdt_case_add'), `
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:0 0 160px">
                <label class="mdt-form-label">${L('mdt_case_number')}</label>
                <input class="mdt-form-input" id="modalCaseNumber" type="text" value="${escHtml(c.case_number || '')}"
                    placeholder="${L('mdt_case_number_auto')}" readonly
                    style="background:var(--mdt-surface-alt);color:var(--mdt-text-muted);cursor:default">
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_report_title')}</label>
                <input class="mdt-form-input" id="modalCaseTitle" value="${escHtml(c.title || '')}" placeholder="...">
            </div>
        </div>
        <div style="display:flex;gap:12px">
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_report_type')}</label>
                <select class="mdt-form-select" id="modalCaseType">
                    <option value="investigation" ${!c.type || c.type==='investigation' ? 'selected':''}>${L('mdt_case_type_investigation')}</option>
                    <option value="homicide" ${c.type==='homicide' ? 'selected':''}>${L('mdt_case_type_homicide')}</option>
                    <option value="narcotics" ${c.type==='narcotics' ? 'selected':''}>${L('mdt_case_type_narcotics')}</option>
                    <option value="robbery" ${c.type==='robbery' ? 'selected':''}>${L('mdt_case_type_robbery')}</option>
                    <option value="fraud" ${c.type==='fraud' ? 'selected':''}>${L('mdt_case_type_fraud')}</option>
                    <option value="other" ${c.type==='other' ? 'selected':''}>${L('mdt_case_type_other')}</option>
                </select>
            </div>
            <div class="mdt-form-group" style="flex:1">
                <label class="mdt-form-label">${L('mdt_report_status')}</label>
                <select class="mdt-form-select" id="modalCaseStatus">
                    <option value="open" ${!c.status || c.status==='open' ? 'selected':''}>${L('mdt_case_status_open')}</option>
                    <option value="active" ${c.status==='active' ? 'selected':''}>${L('mdt_case_status_active')}</option>
                    <option value="suspended" ${c.status==='suspended' ? 'selected':''}>${L('mdt_case_status_suspended')}</option>
                    <option value="closed" ${c.status==='closed' ? 'selected':''}>${L('mdt_case_status_closed')}</option>
                    <option value="cold" ${c.status==='cold' ? 'selected':''}>${L('mdt_case_status_cold')}</option>
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_warrant_priority')}</label>
            <select class="mdt-form-select" id="modalCasePriority">
                <option value="low" ${c.priority==='low' ? 'selected':''}>${L('mdt_case_prio_low')}</option>
                <option value="medium" ${!c.priority || c.priority==='medium' ? 'selected':''}>${L('mdt_case_prio_medium')}</option>
                <option value="high" ${c.priority==='high' ? 'selected':''}>${L('mdt_case_prio_high')}</option>
                <option value="critical" ${c.priority==='critical' ? 'selected':''}>${L('mdt_case_prio_critical')}</option>
            </select>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_report_description')}</label>
            <div id="rteCaseDesc"></div>
        </div>
    `, async () => {
        const title = $('#modalCaseTitle').value.trim();
        if (!title) return;
        const payload = {
            title,
            type: $('#modalCaseType').value,
            status: $('#modalCaseStatus').value,
            priority: $('#modalCasePriority').value,
            description: ($('#rteCaseDesc_body') ? $('#rteCaseDesc_body').innerHTML.trim() : '')
        };
        if (isEdit) {
            payload.id = c.id;
            const result = await nuiPost('mdtNuiUpdateCase', payload);
            if (!result || !result.success) {
                alert(L('mdt_case_save_failed') || 'Speichern fehlgeschlagen. Bitte kurz warten und erneut versuchen.');
                return;
            }
        } else {
            const result = await nuiPost('mdtNuiCreateCase', payload);
            if (!result || !result.id) {
                alert(L('mdt_case_save_failed') || 'Speichern fehlgeschlagen. Bitte kurz warten und erneut versuchen.');
                return;
            }
            hideModal();
            loadCaseDetail(result.id);
            return;
        }
        hideModal();
        if (isEdit && currentCase) loadCaseDetail(currentCase.case.id);
        else searchCase();
    });

    // Initialize RTE after modal is shown
    setTimeout(() => {
        createRTE('rteCaseDesc', L('mdt_report_description'), c.description || '');
    }, 50);

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            if (!confirm(L('mdt_case_confirm_delete'))) return;
            await nuiPost('mdtNuiDeleteCase', { id: c.id });
            hideModal();
            currentCase = null;
            $('#caseDetailOverlay').classList.add('mdt-hidden');
            searchCase();
        });
    }
}

// ── Reports Event Listeners ─────────────────────────────────────

$('#reportSearchBtn').addEventListener('click', searchReport);
$('#reportSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchReport(); });
$('#reportSearchInput').addEventListener('input', debounce(() => {
    const v = $('#reportSearchInput').value.trim();
    if (v.length < 2) { $('#reportResults').innerHTML = ''; return; }
    searchReport();
}, 250));
$('#reportAddBtn').addEventListener('click', () => openReportModal());

// ══════════════════════════════════════════════════════════════════
//  Judgment System (Urteile)
// ══════════════════════════════════════════════════════════════════

let judgCitizens = [];
let judgCharges  = [];

function getJudgMultiplier() {
    let m = parseFloat($('#judgMultiplier').value) || 1.0;
    if ($('#judgPleaDeal') && $('#judgPleaDeal').checked) m *= 0.5;
    return m;
}

function judgUpdateUI() {
    const cl = $('#judgCitizenList');
    $('#judgCitizenCount').textContent = judgCitizens.length;
    $('#judgSumCitizens').textContent = judgCitizens.length;
    if (!judgCitizens.length) {
        cl.innerHTML = `<div class="mdt-empty" style="padding:20px"><p>${L('mdt_judgment_no_citizens')}</p></div>`;
    } else {
        cl.innerHTML = judgCitizens.map((c, i) => {
            const prior = c._prior;
            const priorHtml = prior ? `<div class="mdt-judgment-item-sub" style="margin-top:2px">${prior.records} ${L('mdt_judgment_records')} · ${prior.judgments} ${L('mdt_judgment_prior')}${prior.recidivist ? ` <span class="mdt-badge-pill mdt-badge-red" style="font-size:9px">${L('mdt_judgment_recidivist')}</span>` : ''}</div>` : '';
            return `
            <div class="mdt-judgment-item">
                <div class="mdt-judgment-item-icon"><i class="fa-solid fa-user"></i></div>
                <div class="mdt-judgment-item-body">
                    <div class="mdt-judgment-item-title">${escHtml(c.name || c.citizenid)}</div>
                    <div class="mdt-judgment-item-sub">${escHtml(c.citizenid)}</div>
                    ${priorHtml}
                </div>
                <button class="mdt-judgment-item-remove" onclick="judgRemoveCitizen(${i})"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        }).join('');
    }

    const chl = $('#judgChargeList');
    $('#judgChargeCount').textContent = judgCharges.length;
    $('#judgSumCharges').textContent = judgCharges.length;
    if (!judgCharges.length) {
        chl.innerHTML = `<div class="mdt-empty" style="padding:20px"><p>${L('mdt_judgment_no_charges')}</p></div>`;
    } else {
        chl.innerHTML = judgCharges.map((ch, i) => {
            const typeBadge = ch.type === 'arrest'
                ? `<span class="mdt-badge-pill mdt-badge-red">${L('mdt_record_type_arrest')}</span>`
                : ch.type === 'warning'
                ? `<span class="mdt-badge-pill mdt-badge-orange">${L('mdt_record_type_warning')}</span>`
                : `<span class="mdt-badge-pill mdt-badge-blue">${L('mdt_record_type_citation')}</span>`;
            const count = ch.count || 1;
            const chFine = (ch.fine || 0) * count;
            const chJail = (ch.jail || 0) * count;
            return `
            <div class="mdt-judgment-item">
                <div class="mdt-judgment-item-icon"><i class="fa-solid fa-scale-balanced"></i></div>
                <div class="mdt-judgment-item-body">
                    <div class="mdt-judgment-item-title">${count > 1 ? `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:10px;margin-right:4px">${count}x</span>` : ''}[${escHtml(ch.offense_id)}] ${escHtml(ch.title)} ${typeBadge}</div>
                    <div class="mdt-judgment-item-sub">${escHtml(ch.desc || ch.description || '')}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                    <div class="mdt-judgment-charge-amount">$${chFine} / ${chJail} ${L('mdt_months')}</div>
                    <button class="mdt-judgment-item-remove" style="width:24px;height:24px;font-size:10px" title="-1" onclick="judgDecreaseCharge(${i})"><i class="fa-solid fa-minus"></i></button>
                    <button class="mdt-judgment-item-remove" style="width:24px;height:24px;font-size:10px;background:rgba(0,122,255,0.08);color:#007AFF" title="+1" onclick="judgIncreaseCharge(${i})"><i class="fa-solid fa-plus"></i></button>
                    <button class="mdt-judgment-item-remove" onclick="judgRemoveCharge(${i})"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>`;
        }).join('');
    }

    // Totals with multiplier
    const mult = getJudgMultiplier();
    let baseFine = 0, baseJail = 0;
    for (const ch of judgCharges) {
        const count = ch.count || 1;
        baseFine += (ch.fine || 0) * count;
        baseJail += (ch.jail || 0) * count;
    }
    const totalFine = Math.floor(baseFine * mult);
    const totalJail = Math.floor(baseJail * mult);
    $('#judgTotalFine').textContent = '$' + totalFine.toLocaleString();
    $('#judgTotalJail').textContent = totalJail + ' ' + L('mdt_months');

    // Color hint if multiplier active
    const isPlea = $('#judgPleaDeal') && $('#judgPleaDeal').checked;
    const isModified = mult !== 1.0;
    $('#judgTotalFine').style.color = isModified ? (mult < 1 ? '#34C759' : '#FF3B30') : '#34C759';
    $('#judgTotalJail').style.color = isModified ? (mult < 1 ? '#34C759' : '#FF3B30') : '#FF9500';
}

window.judgRemoveCitizen = function(idx) { judgCitizens.splice(idx, 1); judgUpdateUI(); };
window.judgRemoveCharge = function(idx) { judgCharges.splice(idx, 1); judgUpdateUI(); };
window.judgIncreaseCharge = function(idx) { judgCharges[idx].count = (judgCharges[idx].count || 1) + 1; judgUpdateUI(); };
window.judgDecreaseCharge = function(idx) {
    const c = (judgCharges[idx].count || 1) - 1;
    if (c <= 0) judgCharges.splice(idx, 1);
    else judgCharges[idx].count = c;
    judgUpdateUI();
};

// Multiplier + Plea Deal change listeners
$('#judgMultiplier').addEventListener('change', judgUpdateUI);
$('#judgPleaDeal').addEventListener('change', judgUpdateUI);

// Add Citizen with prior record check
$('#judgAddCitizenBtn').addEventListener('click', () => {
    showModal(L('mdt_judgment_add_citizen'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_search_person')}</label>
            <input class="mdt-form-input" id="judgCitizenSearch" placeholder="...">
        </div>
        <div id="judgCitizenSearchResults" style="max-height:250px;overflow-y:auto;margin-top:8px"></div>
    `, null, { hideConfirm: true });

    setTimeout(() => {
        const input = $('#judgCitizenSearch');
        if (!input) return;
        input.addEventListener('input', async () => {
            const q = input.value.trim();
            if (q.length < 2) { $('#judgCitizenSearchResults').innerHTML = ''; return; }
            const res = await nuiPost('mdtNuiSearchPerson', { query: q });
            const results = res.results || [];
            const container = $('#judgCitizenSearchResults');
            if (!results.length) { container.innerHTML = `<div class="mdt-empty"><p>${L('mdt_empty_persons')}</p></div>`; return; }
            container.innerHTML = results.map(p => `
                <div class="mdt-card" style="cursor:pointer" onclick="judgSelectCitizen('${escHtml(p.citizenid)}', '${escHtml(p.name || '')}')">
                    <div class="mdt-card-icon"><i class="fa-solid fa-user"></i></div>
                    <div class="mdt-card-body">
                        <div class="mdt-card-title">${escHtml(p.name || p.citizenid)}</div>
                        <div class="mdt-card-sub">${escHtml(p.citizenid)}</div>
                    </div>
                </div>
            `).join('');
        });
    }, 50);
});

window.judgSelectCitizen = async function(cid, name) {
    if (judgCitizens.find(c => c.citizenid === cid)) return;
    const citizen = { citizenid: cid, name: name || cid };
    // Vorstrafen-Check
    const prior = await nuiPost('mdtNuiGetPriorRecord', { citizenid: cid });
    if (prior) citizen._prior = prior;
    judgCitizens.push(citizen);
    hideModal();
    judgUpdateUI();
};

// Add Charge with count
$('#judgAddChargeBtn').addEventListener('click', () => {
    const penalOpts = buildPenalCodeOptions();
    showModal(L('mdt_judgment_add_charge'), `
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_penal_code')}</label>
            <select class="mdt-form-select" id="judgChargeSelect" style="font-size:13px">${penalOpts}</select>
        </div>
        <div class="mdt-form-group" style="margin-top:8px">
            <label class="mdt-form-label">${L('mdt_judgment_count')}</label>
            <input class="mdt-form-input" id="judgChargeCount" type="number" min="1" value="1" style="width:80px">
        </div>
        <div id="judgChargePreview" style="margin-top:12px;padding:12px;background:var(--mdt-surface-alt);border-radius:10px;font-size:13px;display:none">
            <div id="judgChargePrevTitle" style="font-weight:700"></div>
            <div id="judgChargePrevDesc" style="color:var(--mdt-text-muted);margin-top:4px"></div>
            <div id="judgChargePrevAmount" style="margin-top:8px;font-weight:600"></div>
        </div>
    `, () => {
        const sel = $('#judgChargeSelect');
        const opt = sel.selectedOptions[0];
        if (!opt || !opt.value) return;
        const count = Math.max(1, parseInt($('#judgChargeCount').value) || 1);
        judgCharges.push({
            offense_id: opt.value, title: opt.dataset.title || '', desc: opt.dataset.desc || '',
            type: opt.dataset.type || 'citation', fine: parseInt(opt.dataset.fine) || 0,
            jail: parseInt(opt.dataset.jail) || 0, count: count
        });
        hideModal();
        judgUpdateUI();
    });

    setTimeout(() => {
        const sel = $('#judgChargeSelect');
        if (!sel) return;
        sel.addEventListener('change', () => {
            const opt = sel.selectedOptions[0];
            const prev = $('#judgChargePreview');
            if (!opt || !opt.value) { prev.style.display = 'none'; return; }
            prev.style.display = 'block';
            $('#judgChargePrevTitle').textContent = '[' + opt.value + '] ' + (opt.dataset.title || '');
            $('#judgChargePrevDesc').textContent = opt.dataset.desc || '';
            $('#judgChargePrevAmount').textContent = '$' + (opt.dataset.fine || 0) + ' / ' + (opt.dataset.jail || 0) + ' ' + L('mdt_months');
        });
    }, 50);
});

// Issue Judgment
$('#judgIssueBtn').addEventListener('click', async () => {
    if (!judgCitizens.length || !judgCharges.length) return;
    const mult = getJudgMultiplier();
    let baseFine = 0, baseJail = 0;
    for (const ch of judgCharges) { baseFine += (ch.fine || 0) * (ch.count || 1); baseJail += (ch.jail || 0) * (ch.count || 1); }
    const totalFine = Math.floor(baseFine * mult);
    const totalJail = Math.floor(baseJail * mult);
    const names = judgCitizens.map(c => c.name || c.citizenid).join(', ');
    const pleaLabel = ($('#judgPleaDeal') && $('#judgPleaDeal').checked) ? ' [PLEA DEAL]' : '';
    if (!confirm(L('mdt_judgment_confirm') + '\n\n' + names + '\n$' + totalFine.toLocaleString() + ' / ' + totalJail + ' ' + L('mdt_months') + pleaLabel)) return;

    const result = await nuiPost('mdtNuiIssueJudgment', {
        citizens: judgCitizens.map(c => ({ citizenid: c.citizenid, name: c.name })),
        charges: judgCharges,
        multiplier: mult,
        plea_deal: $('#judgPleaDeal') && $('#judgPleaDeal').checked,
        note: ($('#judgNoteInput') ? $('#judgNoteInput').value.trim() : '')
    });

    if (result && result.success) {
        judgCitizens = []; judgCharges = [];
        if ($('#judgNoteInput')) $('#judgNoteInput').value = '';
        if ($('#judgMultiplier')) $('#judgMultiplier').value = '1';
        if ($('#judgPleaDeal')) $('#judgPleaDeal').checked = false;
        judgUpdateUI();
    }
});

// Judgment History Modal
$('#judgHistoryBtn').addEventListener('click', async () => {
    showModal(L('mdt_judgment_history'), `
        <div class="mdt-form-group">
            <input class="mdt-form-input" id="judgHistorySearch" placeholder="${L('mdt_search_person')}">
        </div>
        <div id="judgHistoryResults" style="max-height:400px;overflow-y:auto;margin-top:8px">
            <div class="mdt-empty"><p>...</p></div>
        </div>
    `, null, { hideConfirm: true });

    setTimeout(async () => {
        // Load recent
        const res = await nuiPost('mdtNuiGetJudgmentHistory', { query: '' });
        renderJudgHistory(res.results || []);

        const input = $('#judgHistorySearch');
        if (input) input.addEventListener('input', async () => {
            const q = input.value.trim();
            const r = await nuiPost('mdtNuiGetJudgmentHistory', { query: q });
            renderJudgHistory(r.results || []);
        });
    }, 50);
});

function renderJudgHistory(results) {
    const container = $('#judgHistoryResults');
    if (!results.length) { container.innerHTML = `<div class="mdt-empty"><p>${L('mdt_empty_results')}</p></div>`; return; }
    container.innerHTML = results.map(j => {
        const plea = j.plea_deal ? `<span class="mdt-badge-pill mdt-badge-green" style="font-size:9px">PLEA</span>` : '';
        const mult = j.multiplier && j.multiplier !== 1.0 ? `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:9px">x${j.multiplier}</span>` : '';
        let chargeList = '';
        try { const ch = JSON.parse(j.charges); chargeList = ch.map(c => (c.count > 1 ? c.count + 'x ' : '') + (c.title || c.offense_id)).join(', '); } catch(e) { chargeList = j.charges || ''; }
        return `
        <div class="mdt-card" style="cursor:default">
            <div class="mdt-card-icon"><i class="fa-solid fa-gavel"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(j.citizen_name || j.citizenid)} ${plea}${mult}</div>
                <div class="mdt-card-sub">$${j.total_fine} / ${j.total_jail} ${L('mdt_months')} · ${escHtml(j.officer || '')} · ${formatDate(j.created_at)}</div>
                <div class="mdt-card-sub" style="margin-top:4px;opacity:0.7;font-size:11px">${escHtml(chargeList).substring(0, 150)}</div>
            </div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════
//  Access Management (Settings)
// ══════════════════════════════════════════════════════════════════

const ALL_TABS = ['dashboard','warrants','bolos','cases','judgments','persons','vehicles','properties','weapons','evidences','reports','penalcode'];
const TAB_GROUPS = [
    { key: 'ops',  label: 'OPERATIONS', tabs: ['dashboard','warrants','bolos','cases','judgments'] },
    { key: 'rec',  label: 'RECORDS',    tabs: ['persons','vehicles','properties','weapons','evidences','reports','penalcode'] },
];
const ALL_ACTIONS = ['create','edit','delete','judgment_issue','penal_edit'];

async function loadAccessRoles() {
    const res = await nuiPost('mdtNuiGetAccessRoles', {});
    const roles = res.roles || [];
    renderAccessRoles(roles);
}

function renderAccessRoles(roles) {
    const container = $('#accessRoleList');
    if (!roles.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-shield-halved"></i><p>${L('mdt_access_no_roles')}</p></div>`;
        return;
    }
    container.innerHTML = roles.map(r => {
        let tabs, actions;
        try { tabs = JSON.parse(r.tabs); } catch(e) { tabs = r.tabs; }
        try { actions = JSON.parse(r.actions); } catch(e) { actions = r.actions; }
        const tabsLabel = tabs === 'all' ? `<span class="mdt-badge-pill mdt-badge-green">${L('mdt_access_all')}</span>` :
            (Array.isArray(tabs) ? tabs.map(t => `<span class="mdt-badge-pill mdt-badge-blue" style="font-size:10px">${t}</span>`).join(' ') : '');
        const actionsLabel = actions === 'all' ? `<span class="mdt-badge-pill mdt-badge-green">${L('mdt_access_all')}</span>` :
            (Array.isArray(actions) ? (actions.length ? actions.map(a => `<span class="mdt-badge-pill mdt-badge-orange" style="font-size:10px">${a}</span>`).join(' ') : `<span style="color:var(--mdt-text-muted);font-size:11px">${L('mdt_access_readonly')}</span>`) : '');
        return `
        <div class="mdt-card" style="cursor:pointer" onclick="openAccessRoleModal(${r.id})">
            <div class="mdt-card-icon"><i class="fa-solid fa-shield-halved"></i></div>
            <div class="mdt-card-body">
                <div class="mdt-card-title">${escHtml(r.label || r.role)} <span style="font-weight:400;color:var(--mdt-text-muted);font-size:12px">(${escHtml(r.role)})</span></div>
                <div class="mdt-card-sub" style="margin-top:4px">${L('mdt_access_tabs')}: ${tabsLabel}</div>
                <div class="mdt-card-sub" style="margin-top:4px">${L('mdt_access_actions')}: ${actionsLabel}</div>
            </div>
        </div>`;
    }).join('');
}

window._accessRolesCache = [];

window.openAccessRoleModal = async function(id) {
    // Load fresh data
    const res = await nuiPost('mdtNuiGetAccessRoles', {});
    window._accessRolesCache = res.roles || [];
    const existing = id ? window._accessRolesCache.find(r => r.id === id) : null;
    const isEdit = !!existing;

    let tabs = 'all', actions = 'all';
    if (existing) {
        try { tabs = JSON.parse(existing.tabs); } catch(e) { tabs = existing.tabs; }
        try { actions = JSON.parse(existing.actions); } catch(e) { actions = existing.actions; }
    }
    const isAllTabs = tabs === 'all';
    const isAllActions = actions === 'all';
    const selectedTabs = isAllTabs ? ALL_TABS : (Array.isArray(tabs) ? tabs : []);
    const selectedActions = isAllActions ? ALL_ACTIONS : (Array.isArray(actions) ? actions : []);

    const tabChecks = TAB_GROUPS.map(g => {
        const allInGroup = g.tabs.every(t => isAllTabs || selectedTabs.includes(t));
        const items = g.tabs.map(t => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 0 2px 4px;color:var(--mdt-text-primary)"><input type="checkbox" class="accTabCb" value="${t}" ${isAllTabs || selectedTabs.includes(t) ? 'checked' : ''} style="accent-color:#007AFF"> ${t}</label>`).join('');
        return `<div style="margin-bottom:8px">
            <label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.3px;padding:2px 0;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.06);margin-bottom:4px">
                <input type="checkbox" class="accGroupCb" data-group="${g.key}" ${allInGroup ? 'checked' : ''} style="accent-color:#007AFF"> ${g.label}
            </label>
            <div id="accGroup_${g.key}">${items}</div>
        </div>`;
    }).join('');
    const actionChecks = ALL_ACTIONS.map(a => `<label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;color:var(--mdt-text-primary)"><input type="checkbox" class="accActionCb" value="${a}" ${selectedActions.includes(a) ? 'checked' : ''} style="accent-color:#FF9500"> ${a}</label>`).join('');

    showModal(isEdit ? L('mdt_access_edit_role') : L('mdt_access_add_role'), `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_access_role_id')}</label>
                <div style="position:relative">
                    <input class="mdt-form-input" id="accRoleId" value="${escHtml(existing ? existing.role : '')}" placeholder="z.B. lawyer" autocomplete="off" ${isEdit ? 'readonly style="opacity:0.6"' : ''}>
                    <div id="accRoleIdDrop" class="mdt-ac-drop"></div>
                </div>
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_access_role_label')}</label>
                <input class="mdt-form-input" id="accRoleLabel" value="${escHtml(existing ? existing.label : '')}" placeholder="z.B. Anwalt">
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">
            <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="font-size:11px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.3px">${L('mdt_access_tabs')}</span>
                    <label style="font-size:11px;display:flex;align-items:center;gap:4px;color:var(--mdt-heading-label);font-weight:600"><input type="checkbox" id="accAllTabs" ${isAllTabs ? 'checked' : ''} style="accent-color:#34C759"> ${L('mdt_access_all')}</label>
                </div>
                <div id="accTabList" style="${isAllTabs ? 'opacity:0.4;pointer-events:none' : ''}">${tabChecks}</div>
            </div>
            <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    <span style="font-size:11px;font-weight:700;color:var(--mdt-heading-label);text-transform:uppercase;letter-spacing:.3px">${L('mdt_access_actions')}</span>
                    <label style="font-size:11px;display:flex;align-items:center;gap:4px;color:var(--mdt-heading-label);font-weight:600"><input type="checkbox" id="accAllActions" ${isAllActions ? 'checked' : ''} style="accent-color:#34C759"> ${L('mdt_access_all')}</label>
                </div>
                <div id="accActionList" style="${isAllActions ? 'opacity:0.4;pointer-events:none' : ''}">${actionChecks}</div>
            </div>
        </div>
    `, async () => {
        const role = $('#accRoleId').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const label = $('#accRoleLabel').value.trim();
        if (!role) return;

        const allTabs = $('#accAllTabs').checked;
        const allActions = $('#accAllActions').checked;
        const tabsVal = allTabs ? 'all' : [...$$('.accTabCb:checked')].map(cb => cb.value);
        const actionsVal = allActions ? 'all' : [...$$('.accActionCb:checked')].map(cb => cb.value);

        await nuiPost('mdtNuiSaveAccessRole', {
            id: existing ? existing.id : null,
            role: role, label: label || role,
            tabs: tabsVal, actions: actionsVal
        });
        hideModal();
        loadAccessRoles();
    });

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            if (!confirm(L('mdt_access_confirm_delete'))) return;
            await nuiPost('mdtNuiDeleteAccessRole', { id: existing.id });
            hideModal();
            loadAccessRoles();
        });
    }

    setTimeout(() => {
        // Job autocomplete for ROLLEN-ID (only when adding, not editing)
        const roleIdInput = $('#accRoleId');
        const roleIdDrop  = $('#accRoleIdDrop');
        if (roleIdInput && roleIdDrop && !isEdit) {
            let jDebounce;
            roleIdInput.addEventListener('input', () => {
                clearTimeout(jDebounce);
                const q = roleIdInput.value.trim();
                jDebounce = setTimeout(async () => {
                    const data = await nuiPost('mdtNuiSearchJob', { query: q });
                    const res = data && data.results ? data.results : [];
                    if (!res.length) { roleIdDrop.style.display = 'none'; return; }
                    roleIdDrop.innerHTML = res.map(j =>
                        `<div class="mdt-ac-item" data-name="${escHtml(j.name)}">
                            <strong>${highlightMatch(j.name, q)}</strong><span class="mdt-ac-item-sub">${escHtml(j.label)}</span>
                        </div>`
                    ).join('');
                    roleIdDrop.style.display = 'block';
                }, 250);
            });
            roleIdDrop.addEventListener('mousedown', e => {
                const item = e.target.closest('.mdt-ac-item');
                if (!item) return;
                e.preventDefault();
                roleIdInput.value = item.dataset.name;
                roleIdDrop.style.display = 'none';
            });
            roleIdInput.addEventListener('blur', () => setTimeout(() => roleIdDrop.style.display = 'none', 150));
            // Pre-load full list on focus
            roleIdInput.addEventListener('focus', () => {
                if (roleIdDrop.style.display === 'none' && roleIdInput.value.trim() === '') {
                    roleIdInput.dispatchEvent(new Event('input'));
                }
            });
        }

        // Kategorie-Checkboxen: Gruppe ein-/ausblenden
        $$('.accGroupCb').forEach(groupCb => {
            const groupKey = groupCb.dataset.group;
            const group = TAB_GROUPS.find(g => g.key === groupKey);
            if (!group) return;
            groupCb.addEventListener('change', () => {
                $$(`#accGroup_${groupKey} .accTabCb`).forEach(cb => cb.checked = groupCb.checked);
            });
            // Einzel-Checkboxen → Gruppe-Checkbox aktualisieren
            $$(`#accGroup_${groupKey} .accTabCb`).forEach(cb => {
                cb.addEventListener('change', () => {
                    const all = [...$$(`#accGroup_${groupKey} .accTabCb`)];
                    groupCb.checked = all.every(c => c.checked);
                    groupCb.indeterminate = !groupCb.checked && all.some(c => c.checked);
                });
            });
        });

        // Toggle all checkboxes
        const allTabsCb = $('#accAllTabs');
        if (allTabsCb) allTabsCb.addEventListener('change', () => {
            $('#accTabList').style.opacity = allTabsCb.checked ? '0.4' : '1';
            $('#accTabList').style.pointerEvents = allTabsCb.checked ? 'none' : '';
            // Gruppen-Checkboxen synchronisieren
            $$('.accGroupCb').forEach(cb => { cb.checked = allTabsCb.checked; cb.indeterminate = false; });
        });
        const allActionsCb = $('#accAllActions');
        if (allActionsCb) allActionsCb.addEventListener('change', () => {
            $('#accActionList').style.opacity = allActionsCb.checked ? '0.4' : '1';
            $('#accActionList').style.pointerEvents = allActionsCb.checked ? 'none' : '';
        });
    }, 100);
};

$('#accessAddBtn').addEventListener('click', () => openAccessRoleModal(null));

// Auto-load when settings tab opens
// (handled in tab switch listener already via hasTabAccess check)

// ══════════════════════════════════════════════════════════════════
//  Penal Code Management (MDT)
// ══════════════════════════════════════════════════════════════════

let _canEditPenal = false;
let _penalEntries = [];

async function loadPenalCodeTab() {
    const res = await nuiPost('mdtNuiGetPenalCode', {});
    _penalEntries = res.entries || [];
    _canEditPenal = res.canEdit || false;

    // Show/hide add button
    const addBtn = $('#penalAddBtn');
    if (addBtn) addBtn.classList.toggle('mdt-hidden', !_canEditPenal);

    renderPenalResults(_penalEntries);
}

function filterPenalCode(query) {
    if (!query || query.length < 2) return renderPenalResults(_penalEntries);
    const q = query.toLowerCase();
    const filtered = _penalEntries.filter(e =>
        (e.offense_id || '').toLowerCase().includes(q) ||
        (e.title || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
    );
    renderPenalResults(filtered);
}

function renderPenalResults(entries) {
    const container = $('#penalResults');
    if (!entries.length) {
        container.innerHTML = `<div class="mdt-empty"><i class="fa-solid fa-scale-balanced"></i><p>${L('mdt_empty_penal')}</p></div>`;
        return;
    }

    // Group by category
    const groups = {};
    const order = [];
    for (const e of entries) {
        const cat = e.category || 'Sonstiges';
        if (!groups[cat]) { groups[cat] = []; order.push(cat); }
        groups[cat].push(e);
    }

    let html = '';
    for (const cat of order) {
        html += `<div style="margin-top:16px;margin-bottom:8px;font-size:12px;font-weight:700;color:var(--mdt-text-muted);text-transform:uppercase;letter-spacing:0.5px">${escHtml(cat)}</div>`;
        html += groups[cat].map(e => {
            const typeBadge = e.type === 'arrest'
                ? `<span class="mdt-badge-pill mdt-badge-red">${L('mdt_record_type_arrest')}</span>`
                : e.type === 'warning'
                ? `<span class="mdt-badge-pill mdt-badge-orange">${L('mdt_record_type_warning')}</span>`
                : `<span class="mdt-badge-pill mdt-badge-blue">${L('mdt_record_type_citation')}</span>`;
            return `
            <div class="mdt-card" ${_canEditPenal ? `style="cursor:pointer" onclick="openPenalEditModal(${e.id})"` : ''}>
                <div class="mdt-card-icon"><i class="fa-solid fa-scale-balanced"></i></div>
                <div class="mdt-card-body">
                    <div class="mdt-card-title">[${escHtml(e.offense_id)}] ${escHtml(e.title)} ${typeBadge}</div>
                    <div class="mdt-card-sub">$${e.fine || 0}${e.jail ? ' · ' + e.jail + ' ' + L('mdt_months') : ''}${e.description ? ' · ' + escHtml(e.description).substring(0, 80) : ''}</div>
                </div>
            </div>`;
        }).join('');
    }
    container.innerHTML = html;
}

// ── Penal Code Modal ────────────────────────────────────────────

window.openPenalEditModal = function(id) {
    if (!_canEditPenal) return;
    const e = _penalEntries.find(x => x.id === id);
    if (!e) return;
    openPenalModal(e);
};

function openPenalModal(existing) {
    const isEdit = !!existing;
    const e = existing || {};

    // Edit: plain inputs with existing values; Create: cascade selects from penal_code
    const catOpts = _penalCode.map(cat =>
        `<option value="${escHtml(cat.category)}">${escHtml(cat.category)}</option>`
    ).join('');

    const bodyHtml = isEdit ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_penal_offense_id')}</label>
                <input class="mdt-form-input" id="modalPenalId" value="${escHtml(e.offense_id || '')}" placeholder="z.B. V-011">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_penal_category')}</label>
                <input class="mdt-form-input" id="modalPenalCategory" value="${escHtml(e.category || '')}" readonly>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_title')}</label>
            <input class="mdt-form-input" id="modalPenalTitle" value="${escHtml(e.title || '')}" readonly>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_description')}</label>
            <input class="mdt-form-input" id="modalPenalDesc" value="${escHtml(e.description || '')}" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_type')}</label>
            <select class="mdt-form-select" id="modalPenalType">
                <option value="warning" ${e.type === 'warning' ? 'selected' : ''}>${L('mdt_record_type_warning')}</option>
                <option value="citation" ${!e.type || e.type === 'citation' ? 'selected' : ''}>${L('mdt_record_type_citation')}</option>
                <option value="arrest" ${e.type === 'arrest' ? 'selected' : ''}>${L('mdt_record_type_arrest')}</option>
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_record_fine')}</label>
                <input class="mdt-form-input" id="modalPenalFine" type="number" min="0" value="${e.fine || 0}">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_record_jail')}</label>
                <input class="mdt-form-input" id="modalPenalJail" type="number" min="0" value="${e.jail || 0}">
            </div>
        </div>
    ` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_penal_offense_id')}</label>
                <input class="mdt-form-input" id="modalPenalId" value="" placeholder="z.B. V-011">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_penal_category')}</label>
                <select class="mdt-form-select" id="modalPenalCategory">
                    <option value="">— Kategorie wählen —</option>
                    ${catOpts}
                </select>
            </div>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_title')}</label>
            <select class="mdt-form-select" id="modalPenalTitle" disabled>
                <option value="">— Zuerst Kategorie wählen —</option>
            </select>
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_description')}</label>
            <input class="mdt-form-input" id="modalPenalDesc" value="" placeholder="...">
        </div>
        <div class="mdt-form-group">
            <label class="mdt-form-label">${L('mdt_record_type')}</label>
            <select class="mdt-form-select" id="modalPenalType">
                <option value="warning">${L('mdt_record_type_warning')}</option>
                <option value="citation" selected>${L('mdt_record_type_citation')}</option>
                <option value="arrest">${L('mdt_record_type_arrest')}</option>
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_record_fine')}</label>
                <input class="mdt-form-input" id="modalPenalFine" type="number" min="0" value="0">
            </div>
            <div class="mdt-form-group">
                <label class="mdt-form-label">${L('mdt_record_jail')}</label>
                <input class="mdt-form-input" id="modalPenalJail" type="number" min="0" value="0">
            </div>
        </div>
    `;

    showModal(isEdit ? L('mdt_penal_edit') : L('mdt_penal_add'), bodyHtml, async () => {
        const offenseId = $('#modalPenalId').value.trim();
        const title = $('#modalPenalTitle').value.trim();
        if (!offenseId || !title) return;
        const payload = {
            offense_id: offenseId,
            category: $('#modalPenalCategory').value || 'Sonstiges',
            title: title,
            description: $('#modalPenalDesc').value.trim(),
            type: $('#modalPenalType').value,
            fine: parseInt($('#modalPenalFine').value) || 0,
            jail: parseInt($('#modalPenalJail').value) || 0
        };
        if (isEdit) {
            payload.id = e.id;
            await nuiPost('mdtNuiUpdatePenalEntry', payload);
        } else {
            const result = await nuiPost('mdtNuiCreatePenalEntry', payload);
            if (result && result.error === 'duplicate_id') {
                alert(L('mdt_penal_duplicate'));
                return;
            }
        }
        hideModal();
        loadPenalCodeTab();
    });

    if (isEdit) {
        setModalDangerAction(L('mdt_btn_delete'), async () => {
            if (!confirm(L('mdt_penal_confirm_delete'))) return;
            await nuiPost('mdtNuiDeletePenalEntry', { id: e.id });
            hideModal();
            loadPenalCodeTab();
        });
    }

    setTimeout(() => {
        // Create mode: cascade category → Tatbestand
        if (!isEdit) {
        const catSel = $('#modalPenalCategory');
        const titleSel = $('#modalPenalTitle');

        function buildOffenseOptions(categoryName) {
            const cat = _penalCode.find(c => c.category === categoryName);
            if (cat && cat.offenses && cat.offenses.length) {
                titleSel.innerHTML = '<option value="">— Tatbestand wählen —</option>' +
                    cat.offenses.map(o =>
                        `<option value="${escHtml(o.title)}"
                            data-id="${escHtml(o.id || '')}"
                            data-desc="${escHtml(o.desc || '')}"
                            data-type="${escHtml(o.type || 'citation')}"
                            data-fine="${o.fine || 0}"
                            data-jail="${o.jail || 0}"
                        >${escHtml(o.title)}</option>`
                    ).join('');
                titleSel.disabled = false;
            } else {
                titleSel.innerHTML = '<option value="">— Keine Tatbestände —</option>';
                titleSel.disabled = true;
            }
        }

        catSel.addEventListener('change', () => {
            buildOffenseOptions(catSel.value);
            $('#modalPenalId').value = '';
            $('#modalPenalDesc').value = '';
            $('#modalPenalFine').value = 0;
            $('#modalPenalJail').value = 0;
        });

        titleSel.addEventListener('change', () => {
            const opt = titleSel.selectedOptions[0];
            if (!opt || !opt.value) return;
            $('#modalPenalId').value = opt.dataset.id || '';
            $('#modalPenalDesc').value = opt.dataset.desc || '';
            $('#modalPenalType').value = opt.dataset.type || 'citation';
            $('#modalPenalFine').value = opt.dataset.fine || 0;
            $('#modalPenalJail').value = opt.dataset.jail || 0;
        });
        }
    }, 100);
}

// ── Penal Code Event Listeners ───────────────────────────────────

$('#penalSearchBtn').addEventListener('click', () => filterPenalCode($('#penalSearchInput').value.trim()));
$('#penalSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') filterPenalCode($('#penalSearchInput').value.trim()); });
$('#penalSearchInput').addEventListener('input', () => {
    const v = $('#penalSearchInput').value.trim();
    if (v.length < 2) { renderPenalResults(_penalEntries); return; }
    filterPenalCode(v);
});
$('#penalAddBtn').addEventListener('click', () => openPenalModal());

// ── Cases Event Listeners ───────────────────────────────────────

$('#caseSearchBtn').addEventListener('click', searchCase);
$('#caseSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchCase(); });
$('#caseSearchInput').addEventListener('input', debounce(() => {
    const v = $('#caseSearchInput').value.trim();
    if (v.length < 2) { $('#caseResults').innerHTML = ''; return; }
    searchCase();
}, 250));
$('#caseAddBtn').addEventListener('click', () => openCaseModal());
$('#caseBackBtn').addEventListener('click', () => {
    $('#caseDetailOverlay').classList.add('mdt-hidden');
    currentCase = null;
});
$('#caseEditBtn').addEventListener('click', () => {
    if (currentCase && currentCase.case) openCaseModal(currentCase.case);
});
$('#caseNoteAddBtn').addEventListener('click', () => openCaseNoteModal());

// Case sub-tab switching
document.addEventListener('click', e => {
    const tab = e.target.closest('.mdt-ptab[data-ctab]');
    if (!tab) return;
    $$('.mdt-ptab[data-ctab]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.mdt-case-tab-content').forEach(t => t.classList.add('mdt-hidden'));
    const target = $(`#ctab-${tab.dataset.ctab}`);
    if (target) target.classList.remove('mdt-hidden');
});

// ══════════════════════════════════════════════════════════════════
//  Rich Text Editor (contenteditable)
// ══════════════════════════════════════════════════════════════════

function createRTE(containerId, placeholder, initialHtml) {
    const container = $('#' + containerId);
    if (!container) return null;

    container.innerHTML = `
        <div class="mdt-rte-wrap">
            <div class="mdt-rte-toolbar">
                <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
                <button type="button" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
                <span class="rte-sep"></span>
                <button type="button" data-cmd="formatBlock" data-val="H1" title="H1" style="font-weight:800;font-size:15px">H1</button>
                <button type="button" data-cmd="formatBlock" data-val="H2" title="H2" style="font-weight:700;font-size:14px">H2</button>
                <button type="button" data-cmd="formatBlock" data-val="H3" title="H3" style="font-weight:600;font-size:13px">H3</button>
                <button type="button" data-cmd="formatBlock" data-val="H4" title="H4" style="font-weight:600;font-size:12px">H4</button>
                <span class="rte-sep"></span>
                <button type="button" data-cmd="insertUnorderedList" title="Bullet List"><i class="fa-solid fa-list-ul"></i></button>
                <button type="button" data-cmd="insertOrderedList" title="Numbered List"><i class="fa-solid fa-list-ol"></i></button>
                <button type="button" data-cmd="formatBlock" data-val="BLOCKQUOTE" title="Quote"><i class="fa-solid fa-quote-left"></i></button>
                <button type="button" data-cmd="formatBlock" data-val="PRE" title="Code Block"><i class="fa-solid fa-code"></i></button>
                <span class="rte-sep"></span>
                <button type="button" data-cmd="justifyLeft" title="Align Left"><i class="fa-solid fa-align-left"></i></button>
                <button type="button" data-cmd="justifyCenter" title="Align Center"><i class="fa-solid fa-align-center"></i></button>
                <button type="button" data-cmd="justifyRight" title="Align Right"><i class="fa-solid fa-align-right"></i></button>
                <span class="rte-sep"></span>
                <button type="button" data-action="link" title="Link"><i class="fa-solid fa-link"></i></button>
                <button type="button" data-cmd="removeFormat" title="Clear Formatting"><i class="fa-solid fa-eraser"></i></button>
                <button type="button" data-cmd="insertHorizontalRule" title="Horizontal Rule">—</button>
                <span class="rte-sep"></span>
                <button type="button" data-cmd="superscript" title="Superscript">X<sup style="font-size:9px">2</sup></button>
                <button type="button" data-cmd="subscript" title="Subscript">X<sub style="font-size:9px">2</sub></button>
            </div>
            <div class="mdt-rte-body" contenteditable="true" data-placeholder="${placeholder || '...'}" id="${containerId}_body"></div>
        </div>
    `;

    const body = $('#' + containerId + '_body');
    if (initialHtml) body.innerHTML = initialHtml;

    // Toolbar button handlers
    container.querySelectorAll('.mdt-rte-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            updateToolbarState(container);
        });
    });

    // Link button
    const linkBtn = container.querySelector('[data-action="link"]');
    if (linkBtn) {
        linkBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            const url = prompt('URL:');
            if (url) document.execCommand('createLink', false, url);
        });
    }

    // Update active state on selection change
    body.addEventListener('keyup', () => updateToolbarState(container));
    body.addEventListener('mouseup', () => updateToolbarState(container));

    return {
        getHTML: () => body.innerHTML,
        getText: () => body.textContent,
        setHTML: (html) => { body.innerHTML = html; },
        focus:  () => body.focus(),
    };
}

function updateToolbarState(container) {
    container.querySelectorAll('.mdt-rte-toolbar button[data-cmd]').forEach(btn => {
        const cmd = btn.dataset.cmd;
        if (['bold','italic','underline','strikeThrough','superscript','subscript',
             'justifyLeft','justifyCenter','justifyRight',
             'insertUnorderedList','insertOrderedList'].includes(cmd)) {
            btn.classList.toggle('active', document.queryCommandState(cmd));
        }
    });
}

// Sanitize HTML - erlaubt nur sichere Tags fuer Rich-Text-Anzeige
function safeHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    // Entferne script/style/iframe Tags
    div.querySelectorAll('script,style,iframe,object,embed,form,input,select,textarea').forEach(el => el.remove());
    // Entferne on* Event-Attribute
    div.querySelectorAll('*').forEach(el => {
        for (const attr of [...el.attributes]) {
            if (attr.name.startsWith('on') || attr.name === 'srcdoc') el.removeAttribute(attr.name);
        }
    });
    return div.innerHTML;
}

// Plain-Text aus HTML extrahieren (fuer Vorschau)
function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
}

function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Hebt den getippten Suchbegriff in Autocomplete-Vorschlägen hervor (jedes Segment
// einzeln escaped, nie roher Nutzertext im HTML — sicher gegen Injection).
function highlightMatch(text, query) {
    const t = String(text || '');
    const q = String(query || '').trim();
    if (!q) return escHtml(t);
    const idx = t.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escHtml(t);
    return escHtml(t.substring(0, idx)) + '<mark>' + escHtml(t.substring(idx, idx + q.length)) + '</mark>' + escHtml(t.substring(idx + q.length));
}
