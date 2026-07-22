# EasyTable TODOs

## Ziel

EasyTable ist bereit fuer einen betreuten Restaurant-Piloten, wenn alle P0-Gates abgeschlossen und in einer produktionsnahen Windows-/Netzwerkumgebung nachgewiesen sind.

Architekturgrundsatz: `localMaster` bleibt die operative Source of Truth pro Standort. POS, Staff und KDS muessen im lokalen Netzwerk ohne Cloud weiterarbeiten. Cloud-Daten fuer Orders und Payments sind Sync-/Reporting-Readmodels und kein Ersatz fuer ein Backup.

## P0 - Blockiert Pilot und Produktion

### 1. Auth und Production Security

- [x] Better-Auth-Kontext mit Tenant-, Location- und Rolleninformationen bereitstellen
- [x] Staff-Build von fest konfigurierten Tenant-/Location-IDs entkoppeln
- [x] Lokale Staff-Geräte koppeln und Offline-Anmeldung mit PIN ermöglichen
- [ ] Relay-CORS auf eine explizite Production-Allowlist beschränken; keine beliebigen Origins mit Credentials akzeptieren
- [ ] In Production alle Auth-, PowerSync-, Encryption- und Signing-Secrets erzwingen; bekannte Development-Fallbacks müssen fail-closed abbrechen
- [ ] Rate Limits und Brute-Force-Schutz für Login, PIN, Pairing, Passwort-Reset und Setup-Codes implementieren und testen
- [ ] Session- und Geräte-Revocation für verlorene oder ersetzte Geräte implementieren
- [ ] Ablaufregeln für Offline-Sessions und Verhalten bei entzogenen Benutzerrechten festlegen und testen
- [ ] Production-TLS, Cookie-Flags, Trusted Proxies und Secret-Rotation prüfen
- [ ] Security-Review der Auth-, Pairing-, Admin- und Tenant-Isolation durchführen

### 2. Sync und Relay End-to-End abnehmen

- [x] Idempotente Relay Commands mit `pending`, `delivered`, `accepted` und `failed` implementieren
- [x] Commands bei Timeout erneut zustellen, ohne sie an einen fremden LocalMaster zu liefern
- [x] Finanz-, Operations-, Catalog- und Layout-Readmodels im Relay anlegen
- [x] Cloud-Binding an Tenant, Location und LocalMaster-Instanz validieren
- [ ] Eine verbindliche Sync-Matrix erstellen: Entität, Source of Truth, Datenrichtung, Command/Event, Konfliktregel und Offline-Verhalten
- [ ] Remote-Katalogänderung vom Owner bis zur lokalen Annahme und zurück zum Cloud-Readmodel als E2E-Test abdecken
- [ ] Orders, Order Items, Payments, KDS, Pickups, Layout, Benutzerprojektion und Konfiguration jeweils End-to-End prüfen
- [ ] Standort- und Tischplanbearbeitung über Relay fertigstellen
- [ ] Reconnect nach längerer Offline-Zeit, doppelte Zustellung, veraltete Versionen und teilweise fehlgeschlagene Uploads testen
- [ ] Reconciliation und Diagnose für festhängende oder widersprüchliche Datensätze implementieren
- [ ] Sicherstellen, dass Remote-Mutationen erst nach `accepted` als erfolgreich angezeigt werden

Hinweis: Sync ist kein Backup. Fehler oder Löschungen können synchronisiert werden; Backup und Restore sind ein separates Gate.

### 3. Deployment, Installer und Updater

- [x] Staff lokal über `localMaster` unter `/staff` ausliefern
- [x] LocalMaster-Identität und API-Kompatibilitätsvertrag bereitstellen
- [x] Update-Sperren für offene Orders, Payments und Recovery-Arbeit vorbereiten
- [x] Signiertes Release-Manifest und Tauri-Updater-Grundlagen implementieren
- [ ] Aktuellen Platform-Admin-TypeScript-Build reparieren
- [ ] Alle Apps und Services reproduzierbar auf einer sauberen Windows-CI-Maschine bauen und testen
- [ ] CI-Pipeline für Tests, Builds, Migration-Checks und Release-Artefakte einrichten
- [ ] Signierten Master-Station-Installer mit gebündelter Runtime und WinSW erstellen
- [ ] SQLite und Laufzeitdaten unter `ProgramData` ablegen und Berechtigungen prüfen
- [ ] Windows-Service-Autostart, Firewall-Regeln, Health-Diagnose und Deinstallation testen
- [ ] Tauri-Production-Update-URLs und Public Key konfigurieren
- [ ] Signierte `stable`- und `beta`-Kanäle für POS und LocalMaster bereitstellen
- [ ] Backup-before-migration, Neustart-Healthcheck und automatischen Rollback implementieren
- [ ] Upgrade, fehlgeschlagenes Upgrade, Downgrade/Rollback und Stromausfall während eines Updates in einer Release-Umgebung testen
- [ ] Verbleibende Technikerfelder durch einen geführten Owner-Setup-Wizard ersetzen

### 4. Backup, Restore und Migrationen

- [ ] Automatische, versionierte SQLite-Backups definieren; Aufbewahrung, Verschlüsselung und Speicherort festlegen
- [ ] Konsistentes Backup vor jeder Migration und jedem LocalMaster-Update erzwingen
- [ ] Restore auf einer neuen oder ersetzten Master Station vollständig testen
- [ ] Bestehende Restaurant-Datenbanken über jede unterstützte Migration testen
- [ ] Verhalten bei beschädigter DB, vollem Datenträger und fehlendem Backup definieren
- [ ] Recovery-Runbook und Verantwortlichkeiten für Support dokumentieren
- [ ] Optionales Cloud-/Offsite-Backup klar vom operativen Sync trennen

### 5. Payments und reale Hardware-Abnahme

- [x] Lokale Cash-Zahlungen idempotent und mit unveränderlichen Order-/Ledger-Snapshots persistieren
- [x] Wallee Create/Confirm/Perform/Read, Receipts, Refunds und Recovery implementieren
- [x] Provider-Erfolg von lokaler Persistenz und Receipt-Queueing trennen
- [x] Wiederholung derselben `request_id` ohne zweite Provider-Transaktion testen
- [ ] Echtes Wallee/PAX-Terminal im produktionsnahen Netzwerk anbinden
- [ ] Terminal-Abbruch, Decline, Timeout und unbekannten Provider-Status mit realer Hardware prüfen
- [ ] Internetverlust und LocalMaster-Neustart während jeder Payment-Phase testen
- [ ] Fall „Provider erfolgreich, lokale Speicherung zunächst fehlgeschlagen“ vollständig reconciliieren und im Betrieb sichtbar machen
- [ ] Refund, Voll-/Teilstorno und Belege mit realen Transaktionen abnehmen
- [ ] Tagesabschluss mit Cash-, Karten-, Storno- und Recovery-Fällen abnehmen
- [ ] Wallee-Plattform-/Subtenant-Modell und Credential-Onboarding final festlegen
- [ ] Local Network API später separat evaluieren; Cloud API bleibt V1, solange die lokale Variante nicht verifiziert ist

### 6. Betrieb, Monitoring und Recovery

- [ ] Strukturierte Logs mit Tenant-, Location-, Instance-, Command- und Payment-Korrelation einführen
- [ ] Alerts für Payment-Recovery, festhängende Relay Commands, fehlgeschlagene Migrationen, DB-/Speicherprobleme und wachsende Print-Queues einrichten
- [ ] Healthchecks für SQLite, Cloud-Binding, Sync, Wallee, Drucker und Versionskompatibilität bereitstellen
- [ ] Support-Diagnosepaket ohne Secrets oder unnötige Personendaten exportierbar machen
- [ ] Runbooks für Internet-Ausfall, LocalMaster-Ausfall, Drucker-Ausfall, Terminal-Ausfall und falsche Gerätebindung erstellen
- [ ] Austausch einer defekten Master Station inklusive Restore und Re-Pairing üben

## P0 - Pilot-Abnahmeszenarien

- [ ] Restaurant arbeitet mindestens 24 Stunden ohne Internet lokal mit POS, Staff und KDS weiter
- [ ] Staff wechselt zwischen WLAN und Mobilfunk, ohne lokale und Remote-Erfolge zu verwechseln
- [ ] LocalMaster-Neustart während offener Order, Zahlung, Print-Job und Sync wird sicher verarbeitet
- [ ] Doppelte lokale Requests und doppelte Relay Commands erzeugen keine doppelten Verkäufe, Zahlungen, Stornos oder Ausdrucke
- [ ] Ein Gerät am falschen LocalMaster wird fail-closed blockiert
- [ ] Offline-Drucker führt zu persistenter Queue und erfolgreichem Retry
- [ ] Update wird bei kritischer Arbeit blockiert und bei fehlgeschlagenem Healthcheck zurückgerollt
- [ ] Backup wird auf Ersatzhardware wiederhergestellt und der Betrieb danach fortgesetzt

## P1 - Vor breiter Produktion

- [ ] Geführtes Onboarding vom Platform Admin über Owner Setup bis Master-Station-Claim und Geräte-Pairing fertigstellen
- [ ] Datenschutz, Aufbewahrungsfristen, Audit-Export und Löschkonzept definieren
- [ ] Last- und Soak-Tests für einen typischen sowie einen grossen Standort durchführen
- [ ] Rollout-, Rollback- und Supportprozess für mehrere Restaurants dokumentieren
- [ ] Pilot-Ergebnisse auswerten und Freigabekriterien für unbeaufsichtigte Produktion festlegen

## P2 - Produktverbesserungen

- [ ] Staff: Bei Counterbetrieb-Locations Tischmanagement nicht anzeigen und stattdessen verständlich erklären, dass es für diesen Standort nicht verfügbar ist

## Bereits abgeschlossen

- [x] E-Mail- und Passwort-Reset über Resend
- [x] Passwort-/PIN-Reset und Mitarbeiterverwaltung in Platform Admin und Staff Owner
- [x] Owner Analytics mit korrekter CHF-Darstellung
- [x] Produkt- und Kategorie-Variantengruppen inklusive Basket-Snapshots
- [x] Persistente Print-Queue und idempotenter Retry
- [x] Storno, Tagesabschluss und Financial Ledger im LocalMaster

## Release-Entscheidung

Ein Pilot darf erst starten, wenn alle P0-Punkte entweder abgeschlossen oder mit dokumentierter, ausdrücklich akzeptierter Pilot-Einschränkung versehen sind. Eine breite Produktion beginnt erst nach erfolgreichem Pilot, Restore-Übung, realer Payment-Abnahme und nachgewiesenem Update-Rollback.
