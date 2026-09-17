# Datenvertrag · Evaluator – Inspector 1.0.0

schemaVersion bleibt 1. Unbekannte Felder und Regeln sind Fehler. Definitionen sind JSON-Objekte; keine ausführbaren JavaScript-Strings außerhalb der eingeschränkten Formelsprache. Die konkrete Validierung steht in lib/contract.mjs und lib/extended-contract.mjs.

## Bibliothek

```json
{"schemaVersion":1,"projects":[{"id":"local","name":"Meine Testumgebung","root":"E:/MeinProjekt","target":"Host/Instanz","candidate":"Commit oder Paket-SHA256","notes":"Vorbedingungen"}],"tests":[],"suites":[],"settings":{"allowCommands":false}}
```

Projekt-IDs und Test-/Plan-IDs sind innerhalb ihrer Gruppe eindeutig, 1–80 Zeichen [a-zA-Z0-9_-]. Jeder Test referenziert ein vorhandenes Projekt. Jeder Plan enthält eine nichtleere eindeutige Liste vorhandener Tests. Ein Plan hat id, name, testIds und optional stopOnFailure. Referenzierte Tests können erst nach Anpassung des Plans gelöscht werden.

Tests benötigen id, name, purpose, projectId, type, timeoutMs (100–3.600.000) und config. Optional: category, tags (Textliste), enabled, oracle, counterexamples, scope, source. oracle beschreibt den unabhängigen Sollwert; config ist die tatsächlich ausgeführte maschinenlesbare Prüfregel. Beide müssen fachlich übereinstimmen.

## Adaptervorlagen

Dateipfade sind relativ zum Projektordner; absolute Pfade sind nur innerhalb dieses Ordners zulässig. Realpath-Prüfung verhindert Verlassen über Symlinks. Datei-/Body-/Programmausgaben sind auf 8 MiB begrenzt. UTF-8 wird strikt gelesen. Für große Datenmengen ein passendes externes Programm verwenden.

### file

```json
{
  "path": "README.md",
  "exists": true,
  "kind": "file",
  "minBytes": 1
}
```

### text

```json
{
  "path": "README.md",
  "includes": [
    "Test"
  ],
  "excludes": [
    "TODO"
  ]
}
```

### json

```json
{
  "path": "package.json",
  "checks": [
    {
      "path": "/name",
      "op": "eq",
      "value": "evaluator-inspector"
    }
  ]
}
```

### csv

```json
{
  "path": "examples/metrics.csv",
  "delimiter": ",",
  "columns": [
    "name",
    "value"
  ],
  "minRows": 2,
  "rules": [
    {
      "column": "value",
      "op": "gte",
      "value": 0
    }
  ]
}
```

### compare

```json
{
  "left": "examples/expected.txt",
  "right": "examples/actual.txt",
  "mode": "text"
}
```

### http

```json
{
  "url": "http://127.0.0.1:4318/api/health",
  "method": "GET",
  "status": [
    200
  ],
  "includes": [
    "ok"
  ],
  "maxDurationMs": 2000
}
```

### command

```json
{
  "executable": "C:/Program Files/nodejs/node.exe",
  "args": [
    "--version"
  ],
  "expectedExitCodes": [
    0
  ],
  "includes": [
    "v"
  ],
  "cwd": "."
}
```

### manual

```json
{
  "steps": [
    "Vorbedingung herstellen",
    "Aktion ausführen",
    "Istzustand mit Sollzustand vergleichen"
  ],
  "expected": "Beobachtung entspricht dem beschriebenen Sollzustand."
}
```

### assert

```json
{
  "actual": 4,
  "operator": "eq",
  "expected": 4
}
```

### expression

```json
{
  "expression": "sum([1,2,3])",
  "expected": 6
}
```

### numeric

```json
{
  "expression": "19.6 * 1.077 + 4",
  "operator": "approx",
  "expected": 25.1092,
  "tolerance": 0.001
}
```

### regex

```json
{
  "input": "EI-2026",
  "pattern": "^EI-[0-9]{4}$",
  "flags": "",
  "shouldMatch": true
}
```

### schema

```json
{
  "path": "package.json",
  "schema": {
    "type": "object",
    "required": [
      "name",
      "version"
    ],
    "properties": {
      "name": {
        "type": "string",
        "minLength": 1
      },
      "version": {
        "type": "string"
      }
    }
  }
}
```

### date

```json
{
  "input": "2026-09-16",
  "operator": "between",
  "reference": "2026-01-01",
  "end": "2026-12-31"
}
```

### format

```json
{
  "input": "2026-09-16",
  "format": "iso_date"
}
```

### stats

```json
{
  "values": [
    10,
    20,
    30
  ],
  "metric": "mean",
  "operator": "eq",
  "expected": 20
}
```

### collection

```json
{
  "values": [
    1,
    2,
    3
  ],
  "itemType": "number",
  "unique": true,
  "sorted": "ascending",
  "length": 3
}
```

### table

```json
{
  "rows": [
    {
      "name": "Addition",
      "expression": "1+1",
      "operator": "eq",
      "expected": 2
    },
    {
      "name": "Quadrat",
      "expression": "3*3",
      "operator": "eq",
      "expected": 9
    }
  ]
}
```

### checklist

```json
{
  "steps": [
    {
      "id": "step-1",
      "label": "Sollzustand dokumentiert",
      "required": true
    }
  ]
}
```

### security

```json
{
  "input": "<p>Beispieltext</p>",
  "rules": [
    "script-tags",
    "event-handlers",
    "javascript-urls",
    "path-traversal",
    "eval-calls",
    "xxe",
    "prototype-keys"
  ]
}
```

### a11y

```json
{
  "input": "<html lang=\"de\"><h1>Test</h1><img src=\"x\" alt=\"Diagramm\"><button>Start</button></html>",
  "rules": [
    "html-lang",
    "image-alt",
    "button-name",
    "input-name",
    "heading-order"
  ]
}
```

### perf

```json
{
  "expression": "sum([1,2,3,4,5])",
  "iterations": 1000,
  "maxDurationMs": 250,
  "expected": 15
}
```


## Präzise Regeln

JSON-Pointer: leerer Pfad wählt das ganze Dokument, /name wählt ein Feld, ~0 maskiert ~ und ~1 maskiert /. Vergleiche sind typisiert und berücksichtigen eigene Eigenschaften. Objekt-Key-Reihenfolge ist beim JSON-Vergleich unerheblich. eq/ne/contains/gt/gte/lt/lte/exists/type sind die JSON-/CSV-Operatoren. exists mit value:false prüft Abwesenheit. CSV-Werte werden bei numerischen Sollwerten numerisch geprüft; ungültige Zahlen bestehen nicht.

assert/numeric/stats/table unterstützen eq/ne/gt/gte/lt/lte/approx/contains/type. approx erfordert nichtnegative tolerance. expression vergleicht strikt mit expected. Arrays und Objekte werden strukturell verglichen. Stats: count, sum, mean, median, min, max, stddev (Population), p95 (Nearest Rank).

Schema-Teilmenge: type (object/array/string/number/integer/boolean/null), properties, required, additionalProperties (boolean), items, enum, minimum, maximum, minLength, maxLength, minItems, maxItems, pattern. Es gibt keine $ref-, format-, oneOf- oder weiteren Keywords. Längen zählen Unicode-Codepoints. Ein Schema benötigt type und dazu passende Regeln; negative, gebrochene oder widersprüchliche Längen-/Anzahlgrenzen sind ungültig.

regex und security/a11y verlangen genau input oder path. Regex akzeptiert leere Eingaben, hat ein Elternprozess-Zeitlimit und begrenzt Musterlänge. Security/a11y lehnen leere Quellen ab. A11y-Regeln: html-lang, image-alt, button-name, input-name, heading-order, contrast. contrast benötigt foreground/background als #RGB oder #RRGGBB und minContrast 1–21. Statischer HTML-Tokenizer: höchstens 50.000 Elemente und 200 Verschachtelungen. Diese Teilregeln emulieren keinen Browser.

date akzeptiert YYYY-MM-DD mit echten Kalendertagen; valid, before, after, between (inklusive Grenzen). format: email, url (HTTP/S), uuid, ipv4, iso_date, semver, hex_color, iban_checksum.

checklist definiert Schritte nur mit id, label, required. Keine früheren Status-/Prüfer-/Nachweisfelder in der Definition. Jeder Lauf erzeugt neue offene Schritte. Ein Urteil je Pflichtschritt erfolgt über die Run-API, wird an den Lauf gebunden und unveränderlich gespeichert. Optionale Schritte erzeugen keine Freigabebedingung.

http folgt keinen Redirects. status enthält die zulässigen Antworten. headers/body sind optional, checks prüft JSON. maxDurationMs ist ein Messkriterium; timeoutMs beendet den Worker. command benötigt absoluten executable, args als Liste und expectedExitCodes. includes/excludes prüfen stdout. Kein shell:true und keine Auswertung von Metazeichen. cwd muss innerhalb des registrierten Projekts liegen. Externe Programme können mit Benutzerrechten wirken.

## REST-API

- GET /api/health — Produkt-/Quellidentität; GET /api/bootstrap — Bibliothek, Revision, Schlüssel, Katalog, Vorlagen, Pläne, Historie.
- GET /api/library; PUT /api/library — vollständige validierte Bibliothek, If-Match erforderlich. Antwort: library, libraryRevision, gates.
- POST /api/validate — validiert eine komplette Bibliothek ohne Speicherung.
- POST /api/quick-plans — presetId, projectId, mode (manual/command), optional name, variants (1–10 eindeutige Texte), timeoutMs, environment {target,candidate}, adaptation {oracle,negative,scope}, commands {positive,negative,readback}. If-Match erforderlich.
- GET /api/inventory?projectId=… — Dateien, direkte Testverweise und Scan-Grenzen.
- POST /api/runs — testIds oder suiteId, optional repeat, stopOnFailure, requestId. Identische requestId mit identischem Inhalt liefert den vorhandenen Lauf; anderer Inhalt ist ein Fehler.
- GET /api/runs; GET /api/runs/:id; POST /api/runs/:id/cancel.
- POST /api/runs/:id/manual — index (0-basiert), reviewer sowie für manual status (passed/failed), note, evidence. Für checklist stattdessen steps [{id,status,note,evidence}] für alle offenen Pflichtschritte.
- GET /api/runs/:id/export?format=json|csv|junit; GET /api/source.
- POST /api/shutdown — nur ohne aktiven Lauf; eigenes Dienstende separat verifizieren.

Alle außer health/bootstrap benötigen X-Cockpit-Token aus bootstrap. Keine Fremd-Origin-Zugriffe. Änderungen während eines automatischen Laufs sind gesperrt. Import in der Oberfläche deaktiviert command-Ausführung. Erfolgreicher Transport allein bedeutet kein bestandenes Testergebnis; dafür den Laufstatus und seine Assertions lesen.

## Präzisierungen des vorbereiteten Patches (Version bleibt 1.0.0)

- Textzeilen: leere Datei = 0, LF/CRLF/CR trennen Zeilen; ein abschließender Umbruch erzeugt keine zusätzliche Zeile. `a\nb\n` hat 2 Zeilen. Textvergleich normalisiert CRLF und CR auf LF; Bytevergleich bleibt unverändert.
- JSON-Pointer: Bei Arrays sind ausschließlich kanonische Indizes `0` oder eine Dezimalzahl ohne führende Null zulässig. `length`, `01`, `-` und geerbte Eigenschaften werden nicht aufgelöst. Objektfelder behalten ihre Namen.
- Numerische CSV-Prüfungen akzeptieren endliche Dezimalzahlen einschließlich Exponent und äußerem Whitespace. Leere Werte, Hexzahlen, NaN und Infinity bestehen auch `ne` nicht.
- `len` zählt bei Strings Unicode-Codepoints, bei Arrays Elemente; Grapheme wie kombinierte Akzente können mehrere Codepoints enthalten. Die Ausdruckssprache ist keine JavaScript-Syntax: `-2 ** 2` ergibt weiterhin -4.
- HTTP unterstützt `includes` und `excludes` für den Antworttext. Command sammelt stdout und stderr als Bytes; das 8-MiB-Limit gilt für beide Ströme gemeinsam und wird als Ausführungsfehler gemeldet. Erst nach Prozessende wird jeder Strom vollständig und strikt als UTF-8 dekodiert, sodass mehrbytige Zeichen an Chunkgrenzen erhalten bleiben; ungültige Bytes in stdout oder stderr sind Ausführungsfehler. `includes`/`excludes` prüfen weiterhin nur stdout.
- Security kennt auch `sql-patterns` (Muster `union select` und `drop table`). Alle Security-Regeln sind Mustererkennung, keine vollständige Sicherheitsprüfung. Die HTML-Teilmenge erkennt Raw-Text/RCDATA für script/style/textarea/title und Namen aus img-alt sowie input-image-alt. Der Endtag wird case-insensitiv erkannt und darf Leerraum enthalten (`</script >`); Inhalt von script/style trägt nicht zum Textinhalt bei. Die Raw-Text-Regel gilt unabhängig vom Namensraum, daher wird auch `<title>` innerhalb von `<svg>` als RCDATA gelesen und darin verschachtelte Elemente bleiben Text. Attributwerte werden nicht normalisiert; `type` wird für input-image-alt und Button-Werte kleingeschrieben erwartet. Sie bleibt ohne vollständige HTML5-Fehlerkorrektur; doppelte Attribute bleiben Fehler.
- Engine-Identität (`engineHash`) umfasst package.json, server.mjs, cli.mjs sowie die direkten, nicht rekursiv gesammelten Quell-/Ressourcendateien in lib, public und resources mit den Endungen .mjs/.js/.html/.css/.json. Tests, Dokumentation, Beispielpfade, Werkzeugskripte in tools, Starter-/Stopper-Skripte und CI-Dateien sind ausgeschlossen. Der Umfang ist bewusst konservativ; auch eine UI-Änderung veraltet frühere Freigaben. Davon zu unterscheiden ist das Quellpaket (`tools/package.mjs`, TXT-Download): es enthält bewusst zusätzlich Tests, Dokumentation, Beispiele und Werkzeuge und geht nicht in `engineHash` ein.
- Beschädigte aktuelle Bibliotheken werden ausschließlich aus dem jüngsten gültigen, vom Store benannten Backup wiederhergestellt. Die beschädigten Originalbytes bleiben separat erhalten, Warnungen sind in bootstrap enthalten und Programme werden deaktiviert. Ohne gültiges Backup verweigert der Start die Wiederherstellung und lässt das Original unverändert. Eine allgemeine Backup-Auswahloberfläche ist noch nicht enthalten.
- Bei Revisionskonflikt bleibt der lokale Entwurf erhalten. Der Download enthält `library`, die fehlgeschlagene `request` sowie aktuelle `fields` aus offenen Dialogen. Dies ist ein Sicherungsformat für die gezielte Übertragung, keine unmittelbar importierbare Bibliothek. Ein aktualisierter Entwurf muss vor dem Laden des Serverstands erneut gesichert werden.
- CLI: 0 = vollständig bestanden; 1 = fachlich fehlgeschlagen, abgebrochen, übersprungen oder manuell offen; 2 = Eingabe-, Ausführungs-, Timeout- oder Unterbrechungsfehler. Eine vorhandene Bibliothek im Ausgabeordner wird nicht überschrieben. Dienst und CLI verwenden dieselbe Schreibersperre.

## Persistierter Lauf (schemaVersion der Bibliothek bleibt 1)

Datei: `runs/<id>.json`. `id` ist eine UUID. Ein Lauf ist an seine gespeicherte Definition gebunden; spätere Bibliotheksänderungen schreiben diese nicht um.

| Feld | Inhalt |
| --- | --- |
| id, requestId, requestHash | Laufidentität, Idempotenzschlüssel, Hash des Ausführungsauftrags |
| name, status, startedAt, finishedAt | Anzeigename, Aggregatstatus, ISO-Zeitpunkte; finishedAt erst nach Abschluss |
| engineVersion, engineHash | Produktversion und Quellidentität |
| definitionHash, definition | Hash und Snapshot von projects, tests, settings, repeat, stopOnFailure; optional suite |
| results | Geordnete Ergebnisse für Test und Wiederholung |
| error | Optionaler laufweiter Infrastrukturfehler |

Ergebnisse enthalten testId, iteration, status, assertions und evidence; nach Ausführung gegebenenfalls startedAt, finishedAt, durationMs, error oder reason. Assertions enthalten label, passed, actual, expected. Evidence ist adapterspezifisch (Dateihashes, HTTP-Antwort, Prozessausgabe, manuelle Urteile). `termination` ist unter Windows `process-tree-terminated`, unter POSIX `process-group-terminated`; die Reichweite steht in `terminationScope`. `unverified` erzwingt status=error und bewahrt den beabsichtigten Zustand in requestedStatus.

Aggregatpriorität: running/queued → running; anschließend cancelled, interrupted, error, timeout, failed, pending_manual, skipped; passed ausschließlich wenn alle Ergebnisse passed sind. Ein leerer Lauf ist error. Der vollständige Ergebnisvektor bleibt bei gemischten Zuständen maßgeblich.

## HTTP-Antworten

| Situation / Route | Status |
| --- | --- |
| Erfolgreiche GETs, library PUT, validate, manuelles Urteil | 200 |
| quick-plans erstellt | 201 |
| Lauf, Abbruch oder Shutdown angenommen | 202; kein Nachweis des Abschlusses |
| Ungültige Definition, JSON, Parameter, fehlender Projektordner, allgemeiner Ausführungsaufruf-Fehler | 400 mit error |
| Host, Origin oder lokaler API-Marker nicht akzeptiert | 403 |
| Unbekannte Route oder Lauf fehlt | 404 |
| Bibliotheks-PUT während aktivem Lauf | 409, code=RUN_ACTIVE |
| Veraltete Revision bei library/quick-plans | 409, code=LIBRARY_CONFLICT |
| Shutdown während aktivem Lauf | 409 |
| Eingabekörper >4 MiB | 413 |
| Schreibanforderung nach Beginn des Shutdowns | 503, code=SERVICE_CLOSING |

`/api/health` liefert zusätzlich pid und dataDir zur Prüfung des Dienstendes. Der Stop-Helfer prüft zuerst Dienstpfad, Sperr-PID und Portbesitzer, dann Prozessende und entfernte Sperre. Offene HTTP-Verbindungen werden nach einer Frist geschlossen; bereits angenommene, verzögerte Schreibanforderungen dürfen danach keine Arbeit starten.

Die lokale API verwendet weiterhin einen Same-Origin-Marker aus bootstrap, keine Benutzeranmeldung. `allowCommands` bleibt eine globale Freigabe mit vollständiger geerbter Umgebung; HTTP-Ziele, Methoden und Bodies sind nicht separat freigegeben. Import über direkte API kann Programme freigeben. Dieser Patch beansprucht dafür keine Sicherheitsisolierung. Definitionen müssen weiterhin als vertrauenswürdige, potenziell wirkende Aufträge behandelt werden.
