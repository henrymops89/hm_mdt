# hm_mdt

[🇩🇪 Deutsch](README.md) | 🇬🇧 English

**A Mobile Data Terminal for FiveM that feels like a real government system — not just another form-menu.**

Person records, vehicle registry, case files, judgments, evidence, reports, and a role-based access system that isn't just for police — judges, prosecutors, lawyers, and paramedics get their own access too — all in a calm, native macOS-inspired interface with full Dark Mode.

---

## ✦ Why hm_mdt?

- **A system, not a pile of tabs.** People, vehicles, cases, evidence, judgments, and reports are actually linked — a case file pulls in its evidence, involved parties, and reports directly instead of you maintaining everything twice.
- **More than just police.** A granular role system lets you define per-job access profiles — judges see judgments and cases, prosecutors get charging rights, paramedics only get person records. Configurable per tab and per action.
- **Runs standalone.** No dependency on a specific duty/department script — hm_mdt ships its own duty management and runs directly on your framework job (ESX, QBCore, QBox via `hm_lib`).
- **Built for production, not just a demo.** Rate limiting, an audit log with history per record, server-side permission checks on every single callback — not just hidden in the frontend.

## ✦ Features

**Investigation & Records**
- Person profiles with criminal record, vehicles, properties, licenses, warrants, notes, and judgment history in one place
- Vehicle registry with automatic BOLO matching on every search
- Weapon registry, property registry, evidence management with sequential evidence numbers
- Case files with automatic case numbers, linkable people/vehicles/evidence/reports, and their own audit timeline

**Judiciary**
- Judgment issuance with multi-select charges, plea deal option, fine multiplier, and automatic driver's license suspension for traffic offenses
- DB-backed, live-editable penal code
- Reports with an approval workflow (approve/reject/archive from a configurable rank)

**System & Security**
- Granular role system: per-job tabs/actions, not just "police yes/no"
- Full audit log with a history tab directly in every record
- Server-side rate limiting against spam/exploits
- Image URL whitelisting and free-text length limits against abusive input
- Optional, soft integration with prison scripts (`rip-prison`, `rcore_prison`) — everything still works without one, just without actual jail time

**Tech**
- Multi-framework: ESX, QBCore, QBox — abstracted via `hm_lib`
- Parallel instead of sequential DB queries for fast loading of the dashboard, profiles, and judgments
- Mugshot system with real remote photos (the target player gets photographed, not just the officer)
- Full Dark Mode
- German/English out of the box, own locale system

## ✦ Requirements

- [`hm_lib`](https://github.com/henrymops89/hm_lib) — framework abstraction layer (ESX/QBCore/QBox)
- [`oxmysql`](https://github.com/overextended/oxmysql)
- [`ox_lib`](https://github.com/overextended/ox_lib)

## ✦ Installation

1. Unzip the resource into `resources/[hm]/hm_mdt`
2. Add `ensure hm_mdt` to your `server.cfg`
3. The database schema is created automatically on first server start (`server/core/migrations.lua`) — alternatively run `sql/install.sql` manually
4. Adjust `config.lua` to your jobs, ranks, and access roles
5. Done — `/mdt` or **F7** opens the terminal

## ✦ Configuration

The main settings live in `config.lua`:

- `Config.OfficerJobs` — which jobs count as officers, and from which grade someone counts as "boss"
- `Config.MDTAccess` — access roles for non-police jobs (judge, prosecutor, lawyer, ambulance, ...)
- `Config.PrisonSystem` — optional connection to a prison script
- `Config.AuditLogRetentionDays` / `Config.AllowedImageHosts` — cleanup & hardening
- `Config.CaseNumberFormat` / `Config.DateFormat` — freely customizable formats

---

<sub>Developed by MopsScripts.</sub>
