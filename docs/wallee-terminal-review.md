# Wallee-Terminal-Review für EasyTable

> Historische Bestandsaufnahme vor dem LocalMaster-Umbau. Der umgesetzte Zielstand und die noch extern auszuführenden Abnahmetests sind in [`wallee-terminal-test-plan.md`](./wallee-terminal-test-plan.md) beschrieben.

Stand: 2026-07-10  
Bewertungsbasis: Repository-Stand, [`deep-research-report.md`](./deep-research-report.md), offizielle Wallee-Dokumentation.

## Verdict

**Breaks architecture für produktive Kartenzahlungen.**

Der aktuelle Code ist ein brauchbarer Integrations-Prototyp: Credentials werden im Relay verschlüsselt gespeichert, die Zahlung wird über `localMaster` ausgelöst, Requests sind grundsätzlich idempotent und der Cloud-Till-Endpunkt ist auf die aktuelle V2-URL-Struktur ausgerichtet. Für einen produktiven Zahlungsfluss fehlen jedoch die sichere Reconciliation nach Unterbrechungen, ein korrektes Webhook-Processing, Receipt-Persistenz sowie eine harte Trennung zwischen Wallee-Terminal-ID und lokaler POS-Geräte-ID.

Die zentrale Architekturentscheidung bleibt **Cloud Till Long Polling**. Wallee beschreibt Cloud Till als netzunabhängig und passend für Terminals mit Internet-/SIM-Verbindung; Local Till ist ein separates TCP/XML-Protokoll für dasselbe LAN. Die aktuelle Implementierung sollte daher nicht länger unter LTI-Namen laufen und darf nicht stillschweigend auf einen Simulator oder ein anderes Terminal ausweichen.

## Aktueller Datenfluss

```text
POS-Shell
  -> /api/payments/wallee-terminal/start
  -> localMaster: idempotenter Command
  -> RelaySyncApi: Auswahl von Wallee-Profil und Terminal
  -> Wallee V2: transaction create
  -> Wallee V2: terminal perform-transaction / Long Polling
  -> localMaster: payment + order + print queue
  -> RelaySyncApi: Webhook wird nur angenommen und gespeichert
```

Die relevanten Einstiegspunkte sind:

- POS-Shell nimmt in [`CashRegisterScreen.tsx`](../apps/pos-shell/src/screens/CashRegisterScreen.tsx#L447) die gespeicherte lokale `terminalId` und sendet sie als Zahlungs-Terminalreferenz.
- `localMaster` führt in [`orderStore.ts`](../services/localMaster/src/store/orderStore.ts#L262) den idempotenten Zahlungs-Command aus und setzt nach Provider-Autorisierung die Bestellung auf `PAID`.
- Relay wählt in [`walleePaymentStore.ts`](../services/relaySyncApi/src/store/walleePaymentStore.ts#L332) das Wallee-Terminal und ruft ab Zeile 584 den Cloud-Till-Gateway auf.
- Der Webhook-Endpunkt in [`webhookRoutes.ts`](../services/relaySyncApi/src/routes/webhookRoutes.ts#L5) übergibt das bereits geparste JSON an den Store.

## Hauptprobleme

### P0 — Falsche oder stille Terminalauswahl

`pos-shell` verwendet die lokale Pairing-ID des POS-Geräts als `terminal_id`. Diese ist nicht automatisch die Wallee-Cloud-API-Terminal-ID. Relay akzeptiert zwar mehrere Referenztypen, fällt bei einer unbekannten Referenz aber auf das Default-Terminal zurück (`selectTerminal`, Zeilen 332–345).

Folgen:

- Eine Zahlung kann unerwartet auf einem anderen Terminal starten.
- Ein falsch konfiguriertes POS sieht nicht zwingend einen Fehler.
- Audit- und Supportdaten enthalten keine sichere Aussage, welches Wallee-Terminal tatsächlich belastet wurde.

Erforderliche Änderung:

- POS-Geräte-ID, lokales Pairing und Wallee-Terminalreferenz getrennt modellieren.
- Für Zahlungen ausschließlich eine explizite Wallee-Referenz oder einen vom LocalMaster geladenen Standort-Default verwenden.
- Bei unbekannter Referenz hart mit `409`/`404` abbrechen; niemals auf ein anderes Terminal fallbacken.
- Vor dem Start `terminal_id`, `terminal_identifier`, Wallee-Space und Location-Mapping validieren.

Wallee unterscheidet die interne Terminal-ID und den sichtbaren Identifier/TID ausdrücklich. Die Plattform-UI hat beide Felder, aber keine verbindliche Validierung oder Verifikation gegen Wallee.

### P0 — Provider-Erfolg wird zu früh als lokale Zahlung finalisiert

In [`orderStore.ts`](../services/localMaster/src/store/orderStore.ts#L314) wird nach `providerResult.authorized` sofort ein Payment angelegt; kurz danach werden Orderstatus und `payment_status` auf `PAID` gesetzt (Zeile 359). Das ist gefährlich, wenn danach die lokale Persistierung, Outbox-Erzeugung oder Receipt-Queue fehlschlägt.

Das vorhandene Lifecycle-Modell enthält zwar `provider_authorized`, `local_recorded`, `receipt_queued`, `completed` und `reversal_required`, aber der Fehlerpfad setzt den Payment-Status auf `FAILED`, ohne eine echte Wallee-Reconciliation oder Void-/Reversal-Aufgabe zu erzeugen.

Erforderliche Änderung:

- Provider-Zustand und lokale Buchungszustände getrennt persistieren.
- `provider_authorized` darf niemals automatisch `order.payment_status = PAID` bedeuten.
- Lokale Finalisierung atomar mit Payment, Order, Audit, Outbox und Printjob durchführen.
- Bei Provider-Erfolg plus lokalem Fehler einen dauerhaften `reversal_required`-/`reconciliation_required`-Datensatz anlegen.
- Nach Neustart offene Payment-Attempts aktiv wieder aufnehmen oder zur manuellen Klärung anzeigen.

### P0 — Kein belastbarer finaler Statusabgleich

Der Gateway erstellt die Transaktion und pollt `perform-transaction`, mappt anschließend aber nur den zurückgelieferten Zustand (`walleePaymentStore.ts`, Zeile 619). Es gibt keinen separaten `transaction/read`-Abgleich nach Timeout, Verbindungsabbruch oder unbekanntem Zustand.

Wallee dokumentiert, dass ein Long-Polling-Timeout erneut mit denselben Parametern aufgerufen werden soll. Ein HTTP-Timeout oder ein lokaler Abort ist kein Zahlungsfehler. Nach einem unklaren Ergebnis muss die Transaktion über ihre Wallee-ID erneut gelesen und mit dem lokalen Payment-Attempt korreliert werden.

Erforderliche Änderung:

- Payment-Attempt vor dem ersten Provider-Aufruf persistieren.
- `merchantReference` und lokale `paymentAttemptId` dauerhaft speichern.
- `543` als `pending`, nicht als `failed`, behandeln und innerhalb eines begrenzten Fensters mit identischen Parametern fortsetzen.
- Bei Netzwerk-/Prozessabbruch `transaction/read` über einen Recovery-Worker ausführen.
- Nur ein nachweislich finaler Wallee-Zustand darf `authorized`/`completed` auslösen.
- Unbekannte Zustände bleiben `unknown`/`reconciliation_required`.

### P0 — Webhooks werden nur angenommen, nicht verarbeitet

`acceptWalleeWebhook` validiert und dedupliziert das Event, schreibt es in `wallee_webhook_events` und markiert es sofort als `accepted`/`processedAt`. Es wird weder die Wallee-Entity über `entityId` gelesen noch der lokale Payment-Attempt aktualisiert.

Zusätzlich wird in [`webhookRoutes.ts`](../services/relaySyncApi/src/routes/webhookRoutes.ts#L13) `request.body` verwendet. Für eine belastbare Signaturprüfung muss der unveränderte Raw Body verfügbar sein. Die aktuelle Prüfung serialisiert in [`verifyWebhookSignature`](../services/relaySyncApi/src/store/walleePaymentStore.ts#L487) das bereits geparste Objekt erneut; das kann bei Whitespace, Feldreihenfolge oder Encoding von der signierten Nachricht abweichen.

Erforderliche Änderung:

- Raw Body und relevante Signaturmetadaten unverändert entgegennehmen.
- Aktuelle Wallee-Signatur (`x-signature`, Algorithmus, `keyId`) über den offiziellen SDK-/Public-Key-Mechanismus prüfen.
- Event zunächst als `received`/`verified` speichern.
- Danach `entityId` bei Wallee lesen, den aktuellen Zustand anwenden und erst dann als `processed` markieren.
- Fehlerzustände und Retry-Anforderungen persistieren; `processedAt` nicht vor der Verarbeitung setzen.
- `eventId` deduplizieren, aber bei bereits gespeichertem `failed`-Event eine sichere Wiederholung ermöglichen.

### P1 — Receipt-Handling fehlt

Der aktuelle Gateway liefert nur Providerstatus und Transaktions-ID zurück. `fetch-receipts`, Base64-Dekodierung, MIME-Typ, `printed`-Flag und Receipt-Persistenz sind nicht implementiert. `localMaster` erstellt lediglich den normalen lokalen Receipt-Printjob.

Folgen:

- Der Wallee-Händler-/Kundenbeleg kann fehlen.
- Ein auf dem Terminal bereits gedruckter Beleg kann doppelt gedruckt werden.
- Ein nicht gedruckter Wallee-Beleg wird nicht zuverlässig nachgedruckt.
- Receipt-Recovery nach Prozessabbruch ist nicht möglich.

Erforderliche Änderung:

- Nach finalem Paymentzustand `fetch-receipts` über Wallee V2 implementieren.
- Receipt-Metadaten und binäre Daten bzw. eine sichere lokale Referenz persistieren.
- `mimeType`, Receipt-Typ und `printed` berücksichtigen.
- Printjobs idempotent anlegen und bei Fehlern über die bestehende Queue wiederholen.

### P1 — LTI-/Simulator-Fallback verschleiert reale Produktionsfehler

`startWalleeLtiPayment` ruft Cloud Till auf, trägt aber LTI im Namen und startet bei fehlendem Relay-Pairing einen Simulator. Der Simulator ist zwar für Tests nützlich, ein automatischer Produktionspfad ist jedoch unsicher.

Erforderliche Änderung:

- Cloud Till in `walleeCloudTillProvider`/`startWalleeCloudTillPayment` als alleinigen produktiven Pfad benennen.
- Simulator nur über explizite Testkonfiguration oder Test-Dependency aktivieren.
- Fehlendes Pairing, fehlende Credentials, unbekanntes Terminal und Wallee-Konfigurationsfehler als echte Fehler melden.
- Local Till als separate Provider-Implementierung mit eigenem Modus und eigener Konfiguration führen.

### P1 — Create-/Confirm-Vertrag ist nicht explizit

Der V2-Gateway erstellt eine Transaktion mit `merchantReference`, `lineItems`, Betrag und Währung. Ein expliziter Confirm-Schritt bzw. eine bewusste `autoConfirmationEnabled`-Policy ist im Code nicht sichtbar. Damit bleibt unklar, ob die Transaktion im Ziel-Tenant zuverlässig für den Terminalflow bereit ist.

Erforderliche Änderung:

- Confirm-Policy als Konfiguration und Testfall festlegen.
- Bei deaktivierter Auto-Confirmation explizit `/payment/transactions/{id}/confirm` ausführen.
- Create-Response, Confirm-Response und Perform-Response getrennt loggen und persistieren.
- Geldbeträge intern als Minor Units führen und beim Wallee-Payload exakt in die erwartete Dezimaldarstellung übertragen.

### P1 — API-/Auth-Vertrag braucht Tenant-Verifikation

Die JWT-Erzeugung in [`createWalleeAuthorizationHeader`](../services/relaySyncApi/src/store/walleePaymentStore.ts#L719) ist an die aktuelle V2-Dokumentation angelehnt und verwendet den `Space`-Header. Vor Produktion muss sie jedoch gegen den konkreten Application-User, die aktuelle API-Dokumentation und einen echten Test-Tenant verifiziert werden.

Die Admin-Oberfläche speichert `space_id`, `application_user_id`, ein Secret und einen Webhook-Key, prüft aber nicht, ob Space, Credential und Terminal zusammengehören. Die Terminalliste wird lokal gepflegt und nicht gegen Wallee synchronisiert.

Erforderliche Änderung:

- Eine serverseitige „Test connection“-/Terminal-Read-Funktion ergänzen.
- Nur vom Server aus mit Application-User-Credentials kommunizieren.
- Space, Terminal-ID, Identifier, Location und Displaynamen getrennt speichern.
- Credential-Rotation, fehlende Schlüssel und deaktivierte Profile fail-closed behandeln.

### P2 — Statusmodell ist zu grob für Reconciliation

`mapWalleeState` reduziert Wallee-Zustände auf `AUTHORIZED`, `DECLINED`, `CANCELLED`, `TIMEOUT` und `UNKNOWN`. Für die lokale Buchhaltung fehlen mindestens `pending`, `completed`, `voided`, `refunded` und `reconciliation_required` als fachlich unterscheidbare Zustände.

Erforderliche Änderung:

- Provider-State und EasyTable-Lifecycle separat speichern.
- `AUTHORIZED` nicht mit `COMPLETED` gleichsetzen.
- Void, Completion, Refund und Reversal als eigene idempotente Commands modellieren.
- Jede Zustandsänderung mit Quelle, Zeitstempel, Wallee-Transaktions-ID und Request-ID auditieren.

## Bewertung von Platform Admin und POS-Shell

### Platform Admin

Positiv:

- Credentials werden nicht erneut angezeigt; die UI zeigt nur, ob sie gespeichert sind.
- Profil und Terminals sind nach Tenant/Location scoped.
- Terminal-ID und Terminal-Identifier werden getrennt angezeigt.

Risiken:

- Freitextfelder erlauben falsche Wallee-IDs ohne Verifikation.
- Der Begriff „Terminal ID“ ist für Nutzer nicht ausreichend gegen TID/Identifier abgegrenzt.
- Default-Terminal kann konfiguriert werden, ohne Erreichbarkeit oder Status bei Wallee zu prüfen.
- Webhook-Key ist als „Public Key“ benannt, während die Implementierung zusätzlich Legacy-HMAC-Verhalten zulässt.
- Es gibt keinen sichtbaren Modus `cloud_long_polling` vs. `local_till` und keine Receipt-/Completion-Policy.

### POS-Shell

Positiv:

- Der Klickpfad verhindert parallele Zahlungen über `isCompletingPayment`.
- Die Request-ID wird pro Zahlungsversuch erzeugt.
- Die UI wartet auf `lifecycle_state === "completed"`.

Risiken:

- Die gesendete Terminalreferenz stammt aus lokalem Pairing, nicht aus Wallee-Konfiguration.
- Bei Timeout oder `unknown` wird die Zahlung nur als Fehler angezeigt; der Nutzer bekommt keinen sicheren „Status prüfen“- oder „Zahlung läuft noch“-Pfad.
- Es gibt keinen UI-Pfad für Reconciliation, Void oder Receipt-Recovery.
- Der Benutzer kann nicht erkennen, ob der Provider belastet wurde, aber die lokale Buchung fehlgeschlagen ist.

## Zielarchitektur

```text
POS-Shell
  -> localMaster: StartPaymentCommand(requestId, orderSnapshot, walleeTerminalRef)
  -> lokale PaymentAttempt: payment_started
  -> Relay: serverseitige Wallee-Anfrage
  -> Wallee: create -> optional confirm -> perform/retry
  -> Relay: read/webhook reconciliation
  -> localMaster: provider result event
  -> lokale Transaktion: local_recorded -> receipt_queued -> completed
```

Verbindliche Grenzen:

- `localMaster` bleibt Quelle der Wahrheit für Order, Payment, Reversal, Printjob und Outbox.
- RelaySyncApi bleibt Wallee-Connector und Cloud-Read-Model, nicht lokale Buchungsquelle.
- POS-Shell speichert keine autoritativen Paymentzustände.
- Kein Provider-Erfolg wird als lokaler Erfolg ausgegeben, bevor LocalMaster die Konsequenzen atomar persistiert hat.
- Jede externe Mutation erhält stabile `request_id`/`payment_attempt_id` und ist replay-sicher.

## Edge-Case-Bewertung

| Szenario | Aktuelles Verhalten | Erforderliches Verhalten |
|---|---|---|
| Wallee antwortet mit 543 | Wiederholung im Gateway | Gleiches Request-Set wiederholen, danach Payment als pending/recovery markieren |
| HTTP-/Prozessabbruch nach Kartenzahlung | Unklarer Fehler | Wallee-Transaktion lesen, nicht blind neu belasten |
| Falsche Terminalreferenz | Default-Fallback möglich | Hart ablehnen |
| Provider autorisiert, lokale DB schreibt nicht | `reversal_required` nur im Speicher-/Paymentstatus | Dauerhafte Recovery-/Void-Aufgabe |
| Webhook doppelt | Deduplizierung vorhanden | Zusätzlich entity read, Zustandsanwendung und Retrystatus |
| Ungültige Webhook-Signatur | Prüfung vorhanden, aber Raw-Body-Risiko | Raw-Body-Signatur mit aktueller Wallee-Methode |
| Receipt-Fetch fehlschlägt | Nicht vorhanden | Persistenter Receipt-Retryjob |
| LocalMaster offline | POS kann keine finale Zahlung buchen | Kein finaler Erfolg; pending command bzw. klare Sperre |
| Internet offline, LocalMaster/WLAN verfügbar | Cloud Till nicht verfügbar | Cloud-Zahlung pending/failed; keine Fake-Zahlung; optional separater LTI-Modus |
| POS reconnect | Kein Recovery-UI sichtbar | Payment-Attempts laden und Status fortsetzen |
| Wallee-Terminal deaktiviert | Erst beim API-Aufruf sichtbar | Admin-Test und harte Startvalidierung |

## Erforderliche Fix-Reihenfolge

1. Terminalreferenz korrigieren und Default-Fallback entfernen.
2. Persistente Payment-Attempt-/Reconciliation-Zustände in LocalMaster einführen.
3. Cloud-Till-Flow mit expliziter Confirm-Policy, korrekt begrenztem 543-Retry und `transaction/read`-Recovery vervollständigen.
4. Webhook-Raw-Body, aktuelle Signaturprüfung, Entity-Read und Verarbeitungsstatus implementieren.
5. Receipt-Fetching und idempotente lokale Print-Queue ergänzen.
6. Void/Completion/Refund als getrennte, auditierbare Commands ergänzen.
7. Platform-Admin-Validierung und POS-Reconciliation-UX nachziehen.
8. LTI und Simulator aus dem produktiven Cloud-Pfad herauslösen.

## Testmatrix

### Unit/API

- Terminalreferenz: Wallee-ID, Identifier, lokale POS-ID und unbekannte Referenz.
- Kein Fallback bei unbekanntem Terminal.
- Create/Confirm/Perform mit Minor-Unit-Beträgen und CHF.
- HTTP 543, HTTP Timeout, HTTP 409, 442 und 542.
- Providerzustände `PENDING`, `AUTHORIZED`, `COMPLETED`, `DECLINED`, `VOIDED`, `CANCELLED`, unbekannt.
- Idempotente Wiederholung derselben `request_id`.
- Provider-Erfolg plus lokale Persistenz-/Printfehler.
- Webhook mit identischem Event, falscher Signatur, verändertem Raw Body und fehlendem `entityId`.
- Webhook-Verarbeitung nach temporärem Wallee-Read-Fehler.
- Receipt Base64, MIME-Typ, `printed=true/false` und Retry.

### Integration

- Echter Test-Tenant mit erfolgreicher Zahlung und dokumentierten Decline-Mustern.
- Terminalwechsel zwischen WLAN und SIM.
- Terminal nicht erreichbar, Terminal deaktiviert und falsche Space-/Credential-Kombination.
- LocalMaster-Neustart während `perform-transaction`.
- Reconciliation nach Prozessabbruch.
- Void vor Completion und Completion bei Deferred-Completion-Konfiguration.
- Tagesabschluss und Abgleich zwischen Wallee, LocalMaster und Relay-Read-Model.

### Playwright/POS

- Erfolgreiche Kartenzahlung.
- Decline und Cancel mit verständlicher UI.
- „Zahlung läuft noch“ bei Timeout statt sofortigem Doppelversuch.
- Reconnect mit offenem Payment-Attempt.
- Falsches/fehlendes Wallee-Terminal.
- Receipt-Queue sichtbar und wiederholbar.

## Schlussfolgerung

Die aktuelle Lösung sollte **nicht als produktionsreife Wallee-Terminalzahlung gemerged bzw. ausgerollt werden**. Der wichtigste kurzfristige Sicherheitsfix ist die Entfernung des stillen Terminal-Fallbacks. Der wichtigste fachliche Fix ist die Trennung von Provider-Autorisierung und lokaler Finalisierung mit persistenter Reconciliation. Erst danach sind Webhook- und Receipt-Funktionen sinnvoll belastbar.

Wallee-Referenzen:

- [Terminal Integration: Cloud Till, Local Till und Long Polling](https://app-wallee.com/doc/payment/terminal)
- [Wallee Web Service API V2](https://app-wallee.com/doc/api/web-service)
- [Wallee Webhooks](https://app-wallee.com/en/doc/webhooks)
- [Wallee Local Till Interface](https://lti.docs.wallee.com)
