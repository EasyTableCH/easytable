# POS-Hospitality-System: Neue Zielarchitektur

> **Version:** 2.0
> **Prinzip:** Erst lokal stabil, dann Cloud.
> **Kernidee:** POS-Shell ist die lokale Wahrheit. Local Realtime Manager verbindet Staff, KDS, Drucker und später Cloud.

---

## 1. Grundprinzip

Das System wird nicht zuerst als Cloud-System gebaut, sondern als **lokales POS-System**, das auch ohne Internet vollständig funktioniert.

Die zentrale Regel:

> **Die POS-Shell ist die lokale Source of Truth.**

Alle finanzkritischen und operativen Daten werden zuerst lokal gespeichert:

* Bestellungen
* Order Items
* Zahlungen
* Bons
* Tagesabschlüsse
* Cash Sessions
* Stornos
* Küchenstatus

Cloud-Sync kommt später und ist nicht Voraussetzung für den Betrieb vor Ort.

---

## 2. Hauptkomponenten

### 2.1 POS-Shell

Die POS-Shell ist die Desktop-App der Kasse.

Technologie:

* Tauri
* React
* SQLite lokal auf Dateisystem
* läuft auf Windows/Linux/Mac
* später Autostart/Kiosk-Modus möglich

Aufgaben:

* Kassenoberfläche
* Produkt-Auswahl
* Warenkorb
* Bestellung erstellen
* Zahlung erfassen
* Tagesabschluss
* lokale SQLite-Datenbank verwalten
* lokale Wahrheit speichern

Die POS-Shell ist die operative Master-Komponente.

---

### 2.2 Local Realtime Manager

Der Local Realtime Manager läuft auf demselben Gerät wie die POS-Shell.

Technologie:

* Node.js
* Fastify
* REST API
* WebSocket Server
* lokales Netzwerk
* Print-Routing

Aufgaben:

* REST API für Staff/KDS/Manager bereitstellen
* WebSocket-Verbindungen verwalten
* Echtzeit-Events verteilen
* Bestellungen von Staff-PWA entgegennehmen
* Bestellungen an POS-Shell/lokale DB übergeben
* Küchenaufträge an KDS senden
* Druckaufträge an Bondrucker/Küchendrucker routen
* Kassenschublade ansteuern
* Gerätestatus verwalten
* später Cloud-Sync anstossen

Wichtig:

Der Local Realtime Manager ersetzt den alten Begriff `Print-Hub`.

Er ist nicht nur Druckserver, sondern die lokale Kommunikationszentrale.

---

### 2.3 Staff PWA

Die Staff PWA ist eine Web-App für Service-Mitarbeiter.

Technologie:

* React/Vite PWA
* läuft auf iPad, Tablet, Laptop oder Handy
* Verbindung zum Local Realtime Manager über lokales WLAN

Aufgaben:

* Tisch auswählen
* Bestellung aufnehmen
* Produkte hinzufügen
* Notizen erfassen
* Bestellung an Local Realtime Manager senden
* Statusupdates empfangen

Wichtig:

Die Staff PWA speichert höchstens lokale Entwürfe.

Die finale Bestellung entsteht erst, wenn der Local Realtime Manager/POS-Shell sie bestätigt.

---

### 2.4 KDS PWA

Die KDS PWA ist das Kitchen Display System.

Technologie:

* React/Vite PWA
* WebSocket-Verbindung zum Local Realtime Manager

Aufgaben:

* neue Küchenaufträge live anzeigen
* Status ändern: `NEW → PREPARING → READY → SERVED`
* Änderungen zurück an Local Realtime Manager senden

Wichtig:

KDS ist nicht Master.

KDS zeigt nur den aktuellen Zustand und sendet Statusänderungen zurück.

---

### 2.5 Manager PWA

Die Manager PWA ist eine Web-App für Konfiguration und Berichte.

MVP-Aufgaben:

* lokale Produkte ansehen
* Tagesabschluss anzeigen
* einfache Reports ansehen

Spätere Aufgaben:

* Produktverwaltung
* Preisänderungen
* Benutzerverwaltung
* Cloud-Reports
* Multi-Standort-Verwaltung

---

### 2.6 Cloud Sync API

Die Cloud kommt erst später.

Technologie:

* Node.js/Fastify
* PostgreSQL
* optional Redis
* Auth/API Keys
* später Manager Dashboard

Aufgaben:

* lokale Verkäufe sichern
* Produkte/Preise zentral verwalten
* Berichte erstellen
* Multi-Standort ermöglichen
* Wallee Webhooks empfangen
* Geräte-Backups speichern

Wichtig:

Staff/KDS sprechen nicht direkt mit der Cloud.

Nur POS-Shell/Local Realtime Manager synchronisiert mit der Cloud.

---

## 3. Neue Systemarchitektur

```text
                       CLOUD
        ┌────────────────────────────────┐
        │ Sync API / Reporting / Auth    │
        │ PostgreSQL                     │
        └───────────────▲────────────────┘
                        │
                        │ späterer Sync
                        │
┌───────────────────────┴────────────────────────┐
│               POS-GERÄT / KASSEN-PC             │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │              POS-Shell                    │  │
│  │  Tauri + React                            │  │
│  │  Lokale SQLite Source of Truth            │  │
│  │                                           │  │
│  │  - Orders                                 │  │
│  │  - Payments                               │  │
│  │  - Cash Sessions                          │  │
│  │  - Day Close                              │  │
│  │  - Product Snapshot                       │  │
│  └──────────────────▲────────────────────────┘  │
│                     │                           │
│                     │ lokale IPC / HTTP         │
│                     │                           │
│  ┌──────────────────┴────────────────────────┐ │
│  │        Local Realtime Manager             │ │
│  │  Node.js + Fastify                        │ │
│  │                                           │ │
│  │  - REST API                               │ │
│  │  - WebSocket Server                       │ │
│  │  - Print Routing                          │ │
│  │  - Device Coordination                    │ │
│  │  - später Cloud Sync                      │ │
│  └─────────────▲──────────────▲──────────────┘ │
│                │              │                │
│                │              │ USB/Serial     │
│                │              ▼                │
│                │        Bondrucker/Küche       │
└────────────────┼───────────────────────────────┘
                 │
                 │ lokales WLAN
                 │
     ┌───────────┼───────────────┬────────────────┐
     │           │               │                │
     ▼           ▼               ▼                ▼
 Staff PWA     KDS PWA        Manager PWA      weitere Geräte
 iPad          Küche          Büro             optional
```

---

## 4. Kommunikationsprinzip

Die Kommunikation im lokalen Netzwerk läuft über:

* REST für klare Aktionen
* WebSocket für Echtzeit-Updates

### REST wird verwendet für:

* Bestellung absenden
* Zahlung starten
* Bon erneut drucken
* Status ändern
* Produkte laden
* Tagesabschluss starten

### WebSocket wird verwendet für:

* neue Bestellung live an KDS senden
* Kitchen Status live aktualisieren
* Tischstatus live aktualisieren
* Zahlungsstatus live anzeigen
* Druckerstatus live anzeigen
* Verbindung/Heartbeat prüfen

---

## 5. Beispiel: Staff nimmt Bestellung auf

### Ablauf

```text
Staff-Mitarbeiter nimmt Bestellung auf
→ Staff PWA sendet REST Call an Local Realtime Manager
→ Local Realtime Manager validiert Bestellung
→ POS-Shell/lokale SQLite speichert Bestellung
→ Local Realtime Manager erzeugt Events
→ KDS erhält Bestellung live per WebSocket
→ Druckjob wird für Küche/Bar erzeugt
→ Bondrucker druckt Küchenbon
→ Staff PWA erhält Bestätigung mit Order Number
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
  "tableId": "table-5",
  "guestCount": 4,
  "items": [
    {
      "productId": "prod-pizza-margherita",
      "quantity": 2,
      "notes": "eine ohne Zwiebeln"
    },
    {
      "productId": "prod-cola",
      "quantity": 3
    }
  ]
}
```

### Antwort

```json
{
  "success": true,
  "order": {
    "id": "ord_01J...",
    "orderNumber": "T-0042",
    "tableName": "Tisch 5",
    "status": "OPEN",
    "total": 4950
  }
}
```

---

## 7. Beispiel WebSocket Event: Neue Bestellung für KDS

```json
{
  "type": "ORDER_CREATED",
  "payload": {
    "orderId": "ord_01J...",
    "orderNumber": "T-0042",
    "tableName": "Tisch 5",
    "items": [
      {
        "name": "Pizza Margherita",
        "quantity": 2,
        "notes": "eine ohne Zwiebeln",
        "station": "KITCHEN"
      },
      {
        "name": "Cola",
        "quantity": 3,
        "station": "BAR"
      }
    ],
    "createdAt": 1719324000000
  }
}
```

---

## 8. Netzwerkbedingungen

Damit das System lokal ohne Internet funktioniert, müssen diese Bedingungen erfüllt sein:

### Pflicht

* POS-Gerät, Staff-Geräte, KDS und Drucker sind im gleichen lokalen Netzwerk
* Local Realtime Manager ist unter stabiler Adresse erreichbar
* Firewall erlaubt eingehende Verbindungen auf dem POS-Gerät
* Port für API/WebSocket ist offen, z. B. `3000`
* Drucker sind über USB, Serial, LAN oder Netzwerkdruck erreichbar

### Empfohlen

* feste IP für POS-Gerät, z. B. `192.168.1.10`
* oder lokaler Hostname, z. B. `pos.local`
* DHCP Reservation im Router statt manuell gesetzter IP
* separates Restaurant-WLAN/VLAN für POS-Geräte
* kein Client-Isolation-Modus im WLAN
* stabile 5 GHz/2.4 GHz Abdeckung
* USV für Kassen-PC und Netzwerkgeräte

### Wichtig

Die POS-Shell muss Staff-Geräte nicht vorher kennen.

Die Staff PWA muss nur wissen, wo der Local Realtime Manager erreichbar ist.

Beispiel:

```text
http://192.168.1.10:3000
```

oder

```text
http://pos.local:3000
```

---

## 9. Lokale Datenverantwortung

| Bereich          | Master                            |
| ---------------- | --------------------------------- |
| Bestellungen     | POS-Shell / lokale SQLite         |
| Zahlungen        | POS-Shell / lokale SQLite         |
| Bon-History      | POS-Shell / lokale SQLite         |
| Tagesabschluss   | POS-Shell / lokale SQLite         |
| Küchenstatus     | POS-Shell / lokale SQLite         |
| Staff-Entwürfe   | Staff PWA lokal, bis abgesendet   |
| KDS-Anzeige      | Cache/View                        |
| Produkte MVP     | POS-Shell lokal                   |
| Produkte später  | Cloud, POS-Shell pullt Änderungen |
| Reporting später | Cloud                             |

---

## 10. MVP-Reihenfolge

Es wird nicht alles parallel gebaut.

Die Regel lautet:

> Immer ein vollständiges End-to-End-Stück bauen.

---

### MVP 1: Lokale POS-Shell mit Barzahlung

Ziel:

Ein einzelner Kassen-PC kann komplett verkaufen.

Enthält:

* Tauri POS-Shell
* lokale SQLite-Datenbank
* Produkte seeden
* Produkt-Grid
* Warenkorb
* Bestellung speichern
* Barzahlung
* Rückgeldberechnung
* Bon als Printjob
* einfacher Tagesabschluss

Nicht enthalten:

* Staff PWA
* KDS
* Cloud
* Wallee
* QR Payment
* Multi-Device Sync

---

### MVP 2: Local Realtime Manager

Ziel:

Die lokale Kasse bekommt eine API und Echtzeit-Zentrale.

Enthält:

* Node/Fastify Server
* REST API
* WebSocket Server
* Verbindung zur lokalen SQLite/POS-Shell
* Print Routing
* Drucker Mock
* Geräte Heartbeat

---

### MVP 3: Staff PWA

Ziel:

Service-Mitarbeiter können im WLAN Bestellungen aufnehmen.

Enthält:

* Staff View
* Produktliste von Local Realtime Manager laden
* Tisch auswählen
* Bestellung erfassen
* Bestellung per REST absenden
* Bestätigung anzeigen
* lokale Drafts bei Verbindungsverlust

---

### MVP 4: KDS PWA

Ziel:

Küche sieht Bestellungen live.

Enthält:

* WebSocket-Verbindung
* neue Kitchen Orders live anzeigen
* Status ändern
* Status zurück an Local Realtime Manager senden
* Kitchen-Bon optional drucken

---

### MVP 5: Tagesabschluss sauber machen

Ziel:

Kasse wird finanztechnisch brauchbar.

Enthält:

* Cash Session öffnen
* Startgeld
* Barverkäufe
* Cash In / Cash Out
* Tagesabschluss
* Soll/Ist-Vergleich
* Differenz
* Tagesreport

---

### MVP 6: Cloud Sync

Ziel:

Lokale Daten werden gesichert und zentral auswertbar.

Enthält:

* Sync API
* PostgreSQL
* Push von Orders/Payments/Day Close
* Pull von Produkten/Preisen
* Konfliktregeln
* Retry Queue
* Sync Status

---

### MVP 7: Payment Integration

Ziel:

Kartenzahlung/QR-Zahlung integrieren.

Enthält:

* Wallee QR
* Wallee Webhook
* Terminal Integration nur nach technischer Verifikation
* Payment Status Events
* Refunds/Stornos

---

## 11. Minimales SQLite-Schema für MVP 1

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  tax_rate_bps INTEGER NOT NULL DEFAULT 810,
  is_available INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  closed_at INTEGER
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  tax_rate_bps INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  station TEXT DEFAULT 'KITCHEN',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('CASH','CARD_MANUAL')),
  status TEXT NOT NULL CHECK(status IN ('COMPLETED','FAILED')),
  created_at INTEGER NOT NULL
);

CREATE TABLE cash_sessions (
  id TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  opening_cash INTEGER NOT NULL DEFAULT 0,
  closing_cash_expected INTEGER,
  closing_cash_counted INTEGER,
  difference INTEGER,
  status TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE cash_movements (
  id TEXT PRIMARY KEY,
  cash_session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('OPENING','SALE','CASH_IN','CASH_OUT','CLOSING')),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('RECEIPT','KITCHEN_SLIP','BAR_SLIP','DRAWER')),
  payload_json TEXT NOT NULL,
  station TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE day_closes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_cash INTEGER NOT NULL,
  total_card INTEGER NOT NULL,
  order_count INTEGER NOT NULL,
  item_count INTEGER NOT NULL,
  report_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

---

## 12. Kritische Regeln

1. POS-Shell ist die lokale Source of Truth.
2. Local Realtime Manager ist API-, WebSocket- und Print-Zentrale.
3. Staff PWA darf Bestellungen vorschlagen, aber nicht final autoritativ speichern.
4. KDS darf Statusänderungen senden, aber POS-Shell speichert final.
5. Ohne Internet muss Barverkauf, Bon-Druck und Tagesabschluss funktionieren.
6. Ohne POS-Shell darf Staff PWA nur Drafts speichern, keine finalen Verkäufe.
7. Alle Preise werden als Integer gespeichert.
8. Order Items speichern Produktname, Preis und Steuer als Snapshot.
9. Cloud-Sync kommt erst, wenn lokale Kasse stabil ist.
10. Wallee/Terminal kommt erst nach MVP und technischer Verifikation.
11. Druckaufträge laufen immer über Queue.
12. Tagesabschlüsse und Zahlungen müssen nachvollziehbar bleiben.

---

## 13. Finale Empfehlung

Die Entwicklung startet nicht mit Cloud, Wallee oder Multi-Device-Komplexität.

Die Entwicklung startet mit diesem End-to-End-Flow:

```text
Produkt auswählen
→ Warenkorb
→ Bar bezahlen
→ Rückgeld berechnen
→ Bon erzeugen
→ Verkauf lokal speichern
→ Tagesabschluss zeigt korrekte Zahlen
```

Erst wenn dieser Ablauf stabil ist, werden Staff PWA, KDS, Local Realtime Manager, Cloud Sync und Payment Integrationen ergänzt.