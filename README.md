# hm_mdt

🇩🇪 Deutsch | [🇬🇧 English](README.en.md)

**Ein Mobile Data Terminal für FiveM, das sich anfühlt wie ein echtes Behörden-System — nicht wie ein weiteres Formular-Menü.**

Personen-Akten, Fahrzeugregister, Fall-Akten, Urteile, Beweismittel, Berichte und ein rollenbasiertes Zugriffssystem, das nicht nur Polizei kennt, sondern auch Richter, Staatsanwaltschaft, Anwälte und Sanitäter — alles in einer ruhigen, nativen macOS-artigen Oberfläche mit vollem Dark Mode.

---

## ✦ Warum hm_mdt?

- **Kein Sammelsurium, sondern ein System.** Personen, Fahrzeuge, Fälle, Beweise, Urteile und Berichte sind untereinander verknüpft — eine Fall-Akte zieht ihre Beweise, Beteiligten und Berichte direkt rein, statt dass man alles doppelt pflegt.
- **Mehr als nur Polizei.** Ein granulares Rollensystem erlaubt eigene Zugriffsprofile pro Job — Richter sehen Urteile und Fälle, Staatsanwaltschaft bekommt Anklage-Rechte, Sanitäter nur Personen-Akten. Alles pro Tab und pro Aktion konfigurierbar.
- **Läuft eigenständig.** Keine Abhängigkeit zu einem bestimmten Dienst-/Departement-Script — hm_mdt bringt seine eigene Dienstverwaltung mit und läuft direkt auf eurem Framework-Job (ESX, QBCore, QBox via `hm_lib`).
- **Für den Ernstfall gebaut, nicht nur für die Demo.** Rate-Limiting, Audit-Log mit Verlauf pro Akte, serverseitige Berechtigungsprüfung auf jedem einzelnen Callback — nicht nur im Frontend versteckt.

## ✦ Features

**Ermittlung & Akten**
- Personen-Profile mit Strafregister, Fahrzeugen, Immobilien, Führerscheinen, Haftbefehlen, Notizen und Urteilshistorie an einem Ort
- Fahrzeug-Register mit BOLO-Abgleich bei jeder Suche
- Waffenregister, Immobilien-Register, Beweismittelverwaltung mit fortlaufender Beweisnummer
- Fall-Akten mit automatischer Fallnummer, verknüpfbaren Personen/Fahrzeugen/Beweisen/Berichten und eigener Audit-Timeline

**Rechtsprechung**
- Urteilsvergabe mit Mehrfachauswahl, Plea-Deal-Option, Straf-Multiplikator und automatischem Führerschein-Entzug bei Verkehrsdelikten
- DB-gestützter, live editierbarer Strafenkatalog
- Berichte mit Freigabe-Workflow (Genehmigen/Ablehnen/Archivieren ab konfigurierbarem Dienstgrad)

**System & Sicherheit**
- Granulares Rollensystem: eigene Tabs/Aktionen pro Job, nicht nur "Polizei ja/nein"
- Vollständiges Audit-Log mit Verlaufs-Tab direkt in jeder Akte
- Serverseitiges Rate-Limiting gegen Spam/Exploits
- Bild-URL-Whitelist und Freitext-Längenbegrenzung gegen missbräuchliche Eingaben
- Optionale, weiche Integration mit Gefängnis-Scripts (`rip-prison`, `rcore_prison`) — ganz ohne Integration läuft alles trotzdem, nur ohne echten Freiheitsentzug

**Technik**
- Multi-Framework: ESX, QBCore, QBox — über `hm_lib` abstrahiert
- Parallele statt sequenzielle DB-Abfragen für schnelles Laden von Dashboard, Profilen und Urteilen
- Mugshot-System mit echtem Remote-Foto (Zielspieler wird fotografiert, nicht nur der Beamte)
- Vollständiger Dark Mode
- Deutsch/Englisch von Haus aus, eigenes Locale-System

## ✦ Voraussetzungen

- [`hm_lib`](https://github.com/henrymops89/hm_lib) — Framework-Abstraktionsschicht (ESX/QBCore/QBox)
- [`oxmysql`](https://github.com/overextended/oxmysql)
- [`ox_lib`](https://github.com/overextended/ox_lib)

## ✦ Installation

1. Resource in `resources/[hm]/hm_mdt` entpacken
2. `ensure hm_mdt` in die `server.cfg`
3. Datenbank-Schema wird beim ersten Serverstart automatisch angelegt (`server/core/migrations.lua`) — alternativ `sql/install.sql` manuell einspielen
4. `config.lua` an eure Jobs, Dienstgrade und Zugriffsrollen anpassen
5. Fertig — `/mdt` oder **F7** öffnet das Terminal

## ✦ Konfiguration

Die wichtigsten Stellschrauben liegen in `config.lua`:

- `Config.OfficerJobs` — welche Jobs gelten als Beamte, ab welchem Grade als "Boss"
- `Config.MDTAccess` — Zugriffsrollen für Nicht-Polizei-Jobs (Richter, Staatsanwaltschaft, Anwälte, Sanitäter, ...)
- `Config.PrisonSystem` — optionale Anbindung an ein Gefängnis-Script
- `Config.AuditLogRetentionDays` / `Config.AllowedImageHosts` — Aufräumen & Absicherung
- `Config.CaseNumberFormat` / `Config.DateFormat` — frei anpassbare Formate

---

<sub>Entwickelt von MopsScripts.</sub>
