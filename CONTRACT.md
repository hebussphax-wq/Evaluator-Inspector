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
