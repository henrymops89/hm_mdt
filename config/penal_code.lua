--[[
    ══════════════════════════════════════════════════════════════════
    Strafenkatalog / Penal Code
    ══════════════════════════════════════════════════════════════════

    Hier werden alle Straftaten mit Bußgeldern und Haftzeiten definiert.
    Diese Daten werden im MDT-Record-Modal als Dropdown angezeigt.

    Format:
        category = Kategorie-Name (wird als Gruppe im Dropdown angezeigt)
        offenses = Liste der Straftaten
            id    = Eindeutige ID (string)
            title = Tatbestand / Bezeichnung
            desc  = Kurzbeschreibung (optional, wird in Beschreibung-Feld eingefügt)
            type  = 'warning' | 'citation' | 'arrest'
            fine  = Bußgeldbetrag in $
            jail  = Haftzeit in Monaten (0 = keine)
]]

PenalCode = {
    -- ── Verkehrsdelikte ──────────────────────────────────────────
    {
        category = 'Verkehrsdelikte',
        offenses = {
            { id = 'V-001', title = 'Geschwindigkeitsüberschreitung (leicht)',       desc = 'Bis zu 20 km/h über dem Limit',                  type = 'citation', fine = 500,   jail = 0 },
            { id = 'V-002', title = 'Geschwindigkeitsüberschreitung (schwer)',       desc = 'Mehr als 40 km/h über dem Limit',                type = 'citation', fine = 2000,  jail = 0 },
            { id = 'V-003', title = 'Rotlichtverstoß',                               desc = 'Überfahren einer roten Ampel',                   type = 'citation', fine = 1500,  jail = 0 },
            { id = 'V-004', title = 'Fahren ohne Führerschein',                      desc = 'Führen eines Fahrzeugs ohne gültige Lizenz',     type = 'citation', fine = 3000,  jail = 5 },
            { id = 'V-005', title = 'Fahren unter Einfluss (DUI)',                   desc = 'Fahren unter Alkohol- oder Drogeneinfluss',      type = 'arrest',   fine = 5000,  jail = 10 },
            { id = 'V-006', title = 'Fahrerflucht',                                  desc = 'Unerlaubtes Entfernen vom Unfallort',            type = 'arrest',   fine = 5000,  jail = 10 },
            { id = 'V-007', title = 'Reckless Driving',                              desc = 'Rücksichtsloses oder gefährliches Fahren',       type = 'citation', fine = 3000,  jail = 5 },
            { id = 'V-008', title = 'Illegales Parken',                              desc = 'Parken im Halteverbot oder auf Gehwegen',        type = 'warning',  fine = 250,   jail = 0 },
            { id = 'V-009', title = 'Fehlende Fahrzeugpapiere',                      desc = 'Fahrzeug nicht ordnungsgemäß registriert',       type = 'citation', fine = 1000,  jail = 0 },
            { id = 'V-010', title = 'Flucht vor der Polizei',                        desc = 'Nichtbefolgen einer Anhalteaufforderung',        type = 'arrest',   fine = 8000,  jail = 15 },
        }
    },

    -- ── Eigentumsdelikte ─────────────────────────────────────────
    {
        category = 'Eigentumsdelikte',
        offenses = {
            { id = 'E-001', title = 'Diebstahl (geringfügig)',                       desc = 'Entwendung von Gegenständen unter $500 Wert',    type = 'citation', fine = 1000,  jail = 5 },
            { id = 'E-002', title = 'Diebstahl (schwer)',                            desc = 'Entwendung von Gegenständen über $500 Wert',     type = 'arrest',   fine = 5000,  jail = 15 },
            { id = 'E-003', title = 'Einbruch',                                      desc = 'Unerlaubtes Eindringen in ein Gebäude',          type = 'arrest',   fine = 7000,  jail = 20 },
            { id = 'E-004', title = 'Fahrzeugdiebstahl',                             desc = 'Entwendung eines Kraftfahrzeugs',                type = 'arrest',   fine = 10000, jail = 25 },
            { id = 'E-005', title = 'Sachbeschädigung',                              desc = 'Mutwillige Beschädigung von Eigentum',           type = 'citation', fine = 2000,  jail = 5 },
            { id = 'E-006', title = 'Vandalismus',                                   desc = 'Beschädigung oder Zerstörung öffentlichen Eigentums', type = 'citation', fine = 3000, jail = 5 },
            { id = 'E-007', title = 'Raub / Raubüberfall',                           desc = 'Diebstahl unter Anwendung von Gewalt oder Drohung', type = 'arrest', fine = 15000, jail = 30 },
            { id = 'E-008', title = 'Hehlerei',                                      desc = 'Ankauf oder Besitz gestohlener Waren',           type = 'arrest',   fine = 5000,  jail = 10 },
        }
    },

    -- ── Gewaltdelikte ────────────────────────────────────────────
    {
        category = 'Gewaltdelikte',
        offenses = {
            { id = 'G-001', title = 'Körperverletzung (einfach)',                    desc = 'Vorsätzliche leichte Körperverletzung',           type = 'arrest',   fine = 5000,  jail = 15 },
            { id = 'G-002', title = 'Körperverletzung (schwer)',                     desc = 'Körperverletzung mit Waffe oder erheblicher Gewalt', type = 'arrest', fine = 10000, jail = 30 },
            { id = 'G-003', title = 'Bedrohung',                                     desc = 'Androhung von Gewalt gegen eine Person',          type = 'citation', fine = 3000,  jail = 10 },
            { id = 'G-004', title = 'Totschlag',                                     desc = 'Tötung einer Person ohne Vorsatz',                type = 'arrest',   fine = 25000, jail = 60 },
            { id = 'G-005', title = 'Mord',                                          desc = 'Vorsätzliche Tötung einer Person',                type = 'arrest',   fine = 50000, jail = 99 },
            { id = 'G-006', title = 'Versuchter Mord',                               desc = 'Versuch der vorsätzlichen Tötung',                type = 'arrest',   fine = 35000, jail = 70 },
            { id = 'G-007', title = 'Geiselnahme / Entführung',                      desc = 'Freiheitsberaubung einer Person',                 type = 'arrest',   fine = 20000, jail = 50 },
        }
    },

    -- ── Drogendelikte ────────────────────────────────────────────
    {
        category = 'Drogendelikte',
        offenses = {
            { id = 'D-001', title = 'Besitz von Betäubungsmitteln (geringe Menge)',  desc = 'Besitz illegaler Substanzen zum Eigenverbrauch',  type = 'citation', fine = 2000,  jail = 5 },
            { id = 'D-002', title = 'Besitz von Betäubungsmitteln (große Menge)',    desc = 'Besitz illegaler Substanzen in dealertypischer Menge', type = 'arrest', fine = 8000, jail = 20 },
            { id = 'D-003', title = 'Drogenhandel',                                  desc = 'Verkauf oder Vertrieb illegaler Substanzen',      type = 'arrest',   fine = 15000, jail = 35 },
            { id = 'D-004', title = 'Drogenherstellung',                             desc = 'Herstellung illegaler Substanzen',                type = 'arrest',   fine = 20000, jail = 40 },
            { id = 'D-005', title = 'Besitz von Drogenutensilien',                   desc = 'Besitz von Gegenständen zur Drogenherstellung',   type = 'citation', fine = 1000,  jail = 0 },
        }
    },

    -- ── Waffendelikte ────────────────────────────────────────────
    {
        category = 'Waffendelikte',
        offenses = {
            { id = 'W-001', title = 'Illegaler Waffenbesitz',                        desc = 'Besitz einer Schusswaffe ohne gültige Lizenz',    type = 'arrest',   fine = 8000,  jail = 20 },
            { id = 'W-002', title = 'Führen einer Waffe in der Öffentlichkeit',      desc = 'Offenes Tragen einer Waffe ohne Berechtigung',    type = 'citation', fine = 5000,  jail = 10 },
            { id = 'W-003', title = 'Illegaler Waffenhandel',                        desc = 'Verkauf oder Vertrieb illegaler Waffen',          type = 'arrest',   fine = 20000, jail = 40 },
            { id = 'W-004', title = 'Schusswaffengebrauch',                          desc = 'Unerlaubte Abgabe von Schüssen',                  type = 'arrest',   fine = 10000, jail = 25 },
            { id = 'W-005', title = 'Besitz verbotener Waffen',                      desc = 'Besitz von Kriegswaffen oder Explosivmitteln',    type = 'arrest',   fine = 25000, jail = 50 },
        }
    },

    -- ── Ordnungswidrigkeiten ─────────────────────────────────────
    {
        category = 'Ordnungswidrigkeiten',
        offenses = {
            { id = 'O-001', title = 'Störung der öffentlichen Ordnung',              desc = 'Lärmbelästigung oder unangemessenes Verhalten',   type = 'warning',  fine = 500,   jail = 0 },
            { id = 'O-002', title = 'Beleidigung eines Beamten',                     desc = 'Verbale Beleidigung eines Polizeibeamten',        type = 'citation', fine = 2000,  jail = 5 },
            { id = 'O-003', title = 'Widerstand gegen Vollstreckungsbeamte',         desc = 'Aktiver Widerstand bei einer Festnahme',          type = 'arrest',   fine = 5000,  jail = 15 },
            { id = 'O-004', title = 'Hausfriedensbruch',                             desc = 'Unbefugtes Betreten eines privaten Grundstücks',  type = 'citation', fine = 1500,  jail = 0 },
            { id = 'O-005', title = 'Falsche Identität',                             desc = 'Angabe falscher Personalien gegenüber Beamten',   type = 'citation', fine = 3000,  jail = 10 },
            { id = 'O-006', title = 'Behinderung der Justiz',                        desc = 'Behinderung polizeilicher Ermittlungen',          type = 'arrest',   fine = 5000,  jail = 15 },
            { id = 'O-007', title = 'Maskierungsverbot',                             desc = 'Tragen einer Gesichtsverdeckung bei einer Kontrolle', type = 'warning', fine = 1000, jail = 0 },
        }
    },

    -- ── Betrug & Finanzdelikte ───────────────────────────────────
    {
        category = 'Betrug & Finanzdelikte',
        offenses = {
            { id = 'F-001', title = 'Betrug',                                        desc = 'Täuschen zum Zwecke der persönlichen Bereicherung', type = 'arrest', fine = 5000,  jail = 15 },
            { id = 'F-002', title = 'Geldwäsche',                                    desc = 'Waschen von illegal erworbenen Geldern',           type = 'arrest',   fine = 15000, jail = 30 },
            { id = 'F-003', title = 'Bestechung',                                    desc = 'Anbieten oder Annehmen von Bestechungsgeldern',    type = 'arrest',   fine = 10000, jail = 20 },
            { id = 'F-004', title = 'Steuerhinterziehung',                           desc = 'Vorsätzliches Hinterziehen von Steuern',          type = 'arrest',   fine = 20000, jail = 25 },
        }
    },

    -- ── Justiz (Judgements) ──────────────────────────────────────
    {
        category = 'Justiz',
        offenses = {
            { id = 'J-001', title = 'Meineid',                                           desc = 'Falschaussage unter Eid vor Gericht',              type = 'arrest',   fine = 15000, jail = 30 },
            { id = 'J-002', title = 'Missachtung des Gerichts',                          desc = 'Störung oder Nichtbefolgung richterlicher Anweisungen', type = 'arrest', fine = 10000, jail = 20 },
            { id = 'J-003', title = 'Verstoß gegen Bewährungsauflagen',                  desc = 'Nichteinhalten der Bewährungsbedingungen',         type = 'arrest',   fine = 5000,  jail = 25 },
            { id = 'J-004', title = 'Verstoß gegen Kontaktverbot',                       desc = 'Nichteinhalten einer richterlich angeordneten Kontaktsperre', type = 'arrest', fine = 8000, jail = 20 },
            { id = 'J-005', title = 'Flucht aus dem Gewahrsam',                          desc = 'Flucht oder Fluchtversuch aus polizeilichem Gewahrsam oder Haft', type = 'arrest', fine = 15000, jail = 40 },
            { id = 'J-006', title = 'Falschaussage gegenüber der Polizei',               desc = 'Bewusst falsche Angaben bei polizeilicher Vernehmung', type = 'citation', fine = 5000, jail = 10 },
            { id = 'J-007', title = 'Zeugnisverweigerung ohne Grund',                    desc = 'Verweigerung einer Zeugenaussage ohne berechtigten Grund', type = 'citation', fine = 3000, jail = 5 },
            { id = 'J-008', title = 'Vereiteln einer Festnahme',                         desc = 'Aktive Hilfe bei der Flucht einer gesuchten Person', type = 'arrest', fine = 10000, jail = 25 },
            { id = 'J-009', title = 'Manipulation von Beweismitteln',                    desc = 'Fälschen, Vernichten oder Zurückhalten von Beweisen', type = 'arrest', fine = 20000, jail = 35 },
            { id = 'J-010', title = 'Verstoß gegen einstweilige Verfügung',              desc = 'Missachtung einer gerichtlichen Anordnung',        type = 'arrest',   fine = 8000,  jail = 15 },
        }
    },
}
