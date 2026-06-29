# POS-Hospitality-System: Zielarchitektur

> **Version:** 3.0
> **Prinzip:** Erst lokal stabil, dann Cloud.
> **Kernidee:** Local Master ist die lokale Wahrheit. POS-Shell, Staff, KDS und Manager sind Clients gegen diesen lokalen Core.

---

## 1. Grundprinzip

Das System wird als lokales POS-System gebaut, das auch ohne Internet vollstaendig funktioniert.

Die zentrale Regel:

> **Der Local Master ist die lokale Source of Truth.**

Alle finanzkritischen und operativen Daten werden zuerst lokal gespeichert:

* Bestellungen
* Order Items
* Zahlungen
* Bons
* Tagesabschluesse
* Cash Sessions
* Stornos
* Kuechenstatus
* Print Jobs
* Sync Outbox

Cloud-Sync kommt spaeter und ist nicht Voraussetzung fuer den Betrieb vor Ort.

---

## 2. Hauptkomponenten

### 2.1 Local Master

Der Local Master ist der lokale Backend-Core eines Standorts.

Bei kleinen Kunden laeuft er auf demselben PC wie die POS-Shell. Bei mehreren Kassen laeuft er auf einem lokalen Master-PC, und alle anderen Kassen/Clients sprechen mit seiner API.

Technologie:

* Node.js
* Fastify
* REST API
* WebSocket Server
* lokale SQLite-Datenbank
* Migrationen und Seeds
* Print Queue / Print Routing
* spaeter Sync Outbox

Aufgaben:

* lokale SQLite-Datenbank besitzen
* Migrationen und Seeds ausfuehren
* REST API fuer POS-Shell, Staff, KDS und Manager bereitstellen
* WebSocket-Verbindungen verwalten
* Echtzeit-Events verteilen
* Bestellungen autoritativ speichern
* Zahlungen autoritativ speichern
* Tagesabschluss berechnen und speichern
* Kuechenstatus speichern
* Print Jobs erzeugen und routen
* Geraetestatus verwalten
* spaeter Cloud-Sync anstossen

Wichtig:

Der Local Master ersetzt den bisherigen Begriff `Local Realtime Manager` und den alten Begriff `Print-Hub`.

Er ist nicht nur WebSocket- oder Druckserver, sondern der lokale Core des Standorts.

---

### 2.2 POS-Shell

Die POS-Shell ist die Desktop-Oberflaeche der Kasse.

Technologie:

* Tauri
* React
* laeuft auf Windows/Linux/Mac
* spaeter Autostart/Kiosk-Modus moeglich

Aufgaben:

* Kassenoberflaeche
* Tischplan anzeigen
* Produkt-Auswahl
* Warenkorb
* Zahlung ausloesen
* Tagesabschluss anzeigen und ausloesen
* Echtzeit-Events vom Local Master empfangen

Wichtig:

Die POS-Shell besitzt keine eigene SQLite-Wahrheit mehr.

Tauri bleibt Shell, Packaging-, Kiosk- und lokale Integrationsschicht. Datenlogik, Migrationen und Persistenz liegen im Local Master.

---

### 2.3 Staff PWA

Die Staff PWA ist eine mobile-first Web-App fuer Service-Mitarbeiter.

Technologie:

* React/Vite PWA
* laeuft auf iPad, Tablet, Laptop oder Handy
* Verbindung zum Local Master ueber lokales WLAN

Aufgaben:

* Tisch auswaehlen
* Bestellung aufnehmen
* Produkte hinzufuegen
* Notizen erfassen
* Bestellung an Local Master senden
* Statusupdates empfangen

Wichtig:

Die Staff PWA speichert hoechstens lokale Entwuerfe. Eine finale Bestellung entsteht erst, wenn der Local Master sie bestaetigt.

---

### 2.4 KDS PWA

Die KDS PWA ist das Kitchen Display System.

Technologie:

* React/Vite PWA
* WebSocket-Verbindung zum Local Master

Aufgaben:

* neue Kuechenauftraege live anzeigen
* Status aendern: NEW -> PREPARING -> READY -> SERVED
* Statusaenderungen an Local Master senden

Wichtig:

KDS ist nicht Master. KDS zeigt den aktuellen Zustand und sendet Statusaenderungen zurueck. Local Master speichert final.

---

### 2.5 Manager PWA

Die Manager PWA ist eine Web-App fuer Konfiguration und Berichte.

MVP-Aufgaben:

* lokale Produkte ansehen
* Tagesabschluss anzeigen
* einfache Reports ansehen

Spaetere Aufgaben:

* Produktverwaltung
* Preisaenderungen
* Benutzerverwaltung
* Cloud-Reports
* Multi-Standort-Verwaltung

---

### 2.6 Cloud Sync API

Die Cloud kommt spaeter.

Aufgaben:

* lokale Verkaeufe sichern
* zentrale Reports bereitstellen
* Produkt-/Preisupdates verteilen
* Multi-Standort ermoeglichen
* Remote Health und Versionsstatus anzeigen

Wichtig:

Staff, KDS und POS-Shell sprechen nicht direkt mit der Cloud. Nur der Local Master synchronisiert mit der Cloud.

---

## 3. Systemarchitektur

```text
                       CLOUD
       Sync API / Reporting / Auth / Updates
                         ^
                         |
                  spaeterer Sync
                         |
+------------------------------------------------+
|              LOKALER STANDORT                  |
|                                                |
|  +------------------------------------------+  |
|  |              Local Master                |  |
|  | Node.js + Fastify                        |  |
|  | REST API + WebSocket                     |  |
|  | lokale SQLite Source of Truth            |  |
|  |                                          |  |
|  | - Orders                                 |  |
|  | - Order Items                            |  |
|  | - Payments                               |  |
|  | - Cash Sessions                          |  |
|  | - Day Close                              |  |
|  | - Product Snapshot                       |  |
|  | - Print Queue                            |  |
|  | - Sync Outbox                            |  |
|  +-------------------^----------------------+  |
|                      |                         |
|        REST / WebSocket / lokale API           |
|                      |                         |
|  +---------+  +---------+  +------+  +------+  |
|  |POS-Shell|  |Staff PWA|  | KDS  |  |Manager| |
|  |Tauri UI |  |Tablet   |  |PWA   |  |PWA    | |
|  +---------+  +---------+  +------+  +------+  |
|                                                |
|  Drucker / Kueche / Bar haengen am Local Master|
+------------------------------------------------+
```

---

## 4. Kommunikationsprinzip

Alle Clients sprechen mit dem Local Master.

REST wird verwendet fuer klare Aktionen:

* Produktliste laden
* Tischplan laden
* Bestellung absenden
* Zahlung starten oder abschliessen
* Status aendern
* Tagesabschluss starten/speichern
* Bon erneut drucken

WebSocket wird verwendet fuer Echtzeit-Updates:

* ORDER_CREATED
* TABLE_UPDATED
* PAYMENT_UPDATED
* KITCHEN_STATUS_UPDATED
* PRINT_JOB_UPDATED
* DEVICE_CONNECTED
* DEVICE_DISCONNECTED
* HEARTBEAT

Wichtig:

WebSocket-Events sind Benachrichtigungen. Die bestaetigte Wahrheit liegt in SQLite und wird ueber REST/API erneut gelesen, wenn ein Client sicher synchron sein muss.

---

## 5. Beispiel: Staff nimmt Bestellung auf

```text
Staff-Mitarbeiter nimmt Bestellung auf
-> Staff PWA sendet REST Call an Local Master
-> Local Master validiert Bestellung
-> Local Master speichert Bestellung in lokaler SQLite
-> Local Master erzeugt Events
-> POS-Shell erhaelt TABLE_UPDATED / ORDER_CREATED
-> KDS erhaelt ORDER_CREATED
-> Print Job wird fuer Kueche/Bar erzeugt
-> Staff PWA erhaelt Bestaetigung mit Order Number
```

---

## 6. Beispiel REST Call: Bestellung senden

```http
POST http://pos.local:3000/api/orders
Content-Type: application/json
```

```json
{
  "source": "STAFF",
  "deviceId": "staff-ipad-01",
  "tableId": "table_basilica_bar_1",
  "guestCount": 4,
  "items": [
    {
      "productId": "prod_shisha_standard",
      "quantity": 2,
      "notes": "einmal Premium Head"
    },
    {
      "productId": "prod_chinotto",
      "quantity": 3
    }
  ]
}
```

Antwort:

```json
{
  "success": true,
  "order": {
    "id": "ord_...",
    "orderNumber": "L-0042",
    "tableName": "1",
    "status": "OPEN",
    "total": 8100
  }
}
```

---

## 7. Lokale Datenverantwortung

| Bereich           | Master                         |
| ----------------- | ------------------------------ |
| Bestellungen      | Local Master / lokale SQLite   |
| Zahlungen         | Local Master / lokale SQLite   |
| Bon-History       | Local Master / lokale SQLite   |
| Tagesabschluss    | Local Master / lokale SQLite   |
| Kuechenstatus     | Local Master / lokale SQLite   |
| Print Queue       | Local Master / lokale SQLite   |
| Sync Outbox       | Local Master / lokale SQLite   |
| Produkte MVP      | Local Master lokal             |
| Produkte spaeter  | Cloud, Local Master pullt      |
| Staff-Entwuerfe   | Staff PWA lokal bis abgesendet |
| KDS-Anzeige       | Cache/View                     |
| Reporting spaeter | Cloud                          |

Die POS-Shell darf keine parallele SQLite-Wahrheit fuehren.

---

## 8. Multi-Kassen-Modell

Ein Standort hat genau einen lokalen Master.

Kleine Installation:

```text
Kassen-PC 1 = Local Master + SQLite + POS-Shell
```

Groessere Installation:

```text
Kassen-PC 1 = Local Master + SQLite + optional POS-Shell
Kassen-PC 2 = POS-Shell Client
Kassen-PC 3 = POS-Shell Client
Tablets     = Staff/KDS/Manager Clients
```

Mehrere gleichzeitige SQLite-Master pro Standort werden vermieden. Sonst entstehen Konflikte bei Ordernummern, Tischstatus, Zahlungen, Cash Sessions, Tagesabschluss und Sync.

---

## 9. Update- und Betriebsregeln

Fuer viele Kundeninstallationen gelten diese Regeln:

1. Nur Local Master migriert SQLite.
2. Vor Schema-Migrationen wird ein lokales Backup erstellt.
3. Migrationen sind moeglichst additiv und rueckwaertskompatibel.
4. Clients pruefen Local-Master-Version und Feature-Faehigkeiten.
5. Local Master stellt `/health` und spaeter `/version` bereit.
6. Cloud sieht spaeter Core-Version, DB-Schema-Version und Sync-Status.
7. Sync und Druck laufen aus persistenten Queues/Outboxen, nicht nur aus Runtime-Events.
8. Updates muessen abbrechbar oder reparierbar sein, ohne lokale Verkaufsdaten zu verlieren.

---

## 10. MVP-Reihenfolge

Die Regel lautet:

> Immer ein vollstaendiges End-to-End-Stueck bauen.

### MVP 1: Local Master Core + POS-Shell Barverkauf

Ziel:

Ein einzelner Kassen-PC kann komplett verkaufen. Local Master besitzt SQLite, POS-Shell ist UI-Client.

Enthaelt:

* Local Master mit Node/Fastify
* lokale SQLite-Datenbank
* Migrationen und Seeds
* REST API fuer POS-Shell
* POS-Shell Produkt-Grid
* POS-Shell Warenkorb
* Bestellung ueber Local Master speichern
* Barzahlung ueber Local Master speichern
* Rueckgeldberechnung
* Print Job erzeugen
* einfacher Tagesabschluss

Nicht enthalten:

* Staff PWA als produktiver Client
* KDS als produktiver Client
* Cloud
* Wallee
* QR Payment
* Multi-Device Sync

### MVP 2: Multi-Device Local Master

Ziel:

Staff/KDS/Manager und optional weitere POS-Shells sprechen mit demselben Local Master.

Enthaelt:

* WebSocket Events
* Geraete Heartbeat
* Staff Order Flow
* KDS Status Flow
* Print Routing Mock
* LAN-Konfiguration fuer Master-Adresse

### MVP 3: Finanz- und Tagesabschluss-Haertung

Ziel:

Kasse wird finanztechnisch belastbar.

Enthaelt:

* Cash Session oeffnen
* Startgeld
* Barverkaeufe
* Cash In / Cash Out
* Tagesabschluss
* Soll/Ist-Vergleich
* Differenz
* Tagesreport
* Audit-Metadaten fuer Zahlungen

### MVP 4: Cloud Sync

Ziel:

Lokale Daten werden gesichert und zentral auswertbar.

Enthaelt:

* Sync Outbox
* Push von Orders/Payments/Day Close
* Remote Health
* zentrale Reports
* Produkt-/Preisupdates spaeter

---

## 11. Kritische Regeln

1. Local Master ist die lokale Source of Truth.
2. Nur Local Master besitzt und migriert die lokale SQLite-Datenbank.
3. POS-Shell, Staff PWA, KDS und Manager PWA sind Clients gegen die Local-Master-API.
4. Staff PWA darf Bestellungen vorschlagen, aber nicht final autoritativ speichern.
5. KDS darf Statusaenderungen senden, aber Local Master speichert final.
6. Ohne Internet muss Barverkauf, Bon-Druck und Tagesabschluss funktionieren.
7. Ohne Local Master duerfen Clients nur Drafts speichern, keine finalen Verkaeufe.
8. Alle Preise werden als Integer in Rappen/Cents gespeichert.
9. Order Items speichern Produktname, Preis und Steuer als Snapshot.
10. Cloud-Sync kommt erst, wenn lokale Kasse stabil ist.
11. Wallee/Terminal kommt erst nach technischer Verifikation.
12. Druckauftraege laufen immer ueber Queue.
13. Tagesabschluesse und Zahlungen muessen nachvollziehbar bleiben.
14. Mehrere SQLite-Master pro Standort sind kein Ziel.

---

## 12. Naechster technischer Schnitt

Der naechste Umbau entkoppelt POS-Shell von Tauri-DB-Commands:

```text
POS-Shell UI
-> Local-Master API Client
-> Local Master
-> SQLite
```

Konkrete Reihenfolge:

1. Local Master bekommt POS-kompatible APIs fuer Katalog, Varianten, Tischplan und Orders.
2. POS-Shell liest Tischplan und Katalog ueber Local Master.
3. POS-Shell schreibt Orders ueber Local Master.
4. POS-Shell subscribed auf WebSocket Events und refreshed betroffene Views.
5. Rust/Tauri-DB-Commands werden erst entfernt, wenn die UI komplett ueber Local Master laeuft.
