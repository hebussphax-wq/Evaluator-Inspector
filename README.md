# Evaluator – Inspector

Lokales Testcockpit für Definition, Steuerung und Auswertung unterschiedlicher Prüfungen. Keine KI, kein Cloudkonto, keine installierten npm-Pakete. Menschen und externe KI können dieselbe strukturierte JSON-Schnittstelle verwenden.

## Start und erster Test

1. Unter Windows **Start-Evaluator.cmd** doppelklicken. Voraussetzung: Node.js ≥22 und PowerShell 7.
2. Das Cockpit öffnet sich unter http://127.0.0.1:4318. Ein erneuter Start öffnet dieselbe Instanz. Der Datenordner besitzt eine Dienstsperre gegen konkurrierende Schreiber.
3. **Testpläne → Lokale Beispiele → Ausführen** prüft fünf tatsächliche Dateien und Datenverträge im Programmordner. Es gibt keine vorgetäuschten historischen Läufe.
4. **Schnellmenü** bietet 108 anpassbare Vorlagen. **Testkatalog → Test erstellen** bietet alle 22 Adapter.
5. **Stop-Evaluator.cmd** beendet den eigenen Dienst nach Identitätsprüfung. Einen aktiven Lauf zuerst im Cockpit abbrechen und den Abschluss abwarten.

Alternativ in diesem Ordner: `node server.mjs`. Auf anderen Betriebssystemen genügt Node.js ≥22. COCKPIT_PORT und COCKPIT_DATA konfigurieren Port und Speicherort beim direkten Dienststart. Die Windows-Starter verwenden den lokalen Ordner .data und standardmäßig Port 4318.

## Schnellmenü aus den Testbewertungen

Enthalten sind **8 Lehren**, **35 vorgeschlagene Prüfzwecke** und **65 einzeln bewertete historische Testfälle**. Die Quellen sind Testbewertung.md, Teststrategie.md und test-design-review.md aus dem lokalen Session-Audit vom 16.09.2026. Jede Vorlage trägt ihre Quelle und Aussagegrenze. resources/quick-presets.json enthält die vollständigen, lokal verfügbaren Vorlagentexte. Die Ursprungsdokumente bleiben unverändert.

Eine Vorlage wird zu einem konfigurierbaren Testplan:

- **Erfolgsfall:** ein unabhängiger Sollwert und der tatsächliche Ablauf.
- **Gegenprobe:** gezielte Vertragsverletzung, die erkannt werden muss. Bestanden bedeutet hier korrekte Fehlererkennung.
- **Wirkung & Zuordnung:** Ziel, Kandidat und beobachteter Endzustand separat nachweisen.

Bis zu zehn Varianten lassen sich als Zeilen eintragen. Jede Variante bekommt eigene Test-IDs. L08 bringt A04 und A08 mit und erzeugt deshalb sechs Fälle. Ein erfolgreicher A04-Fall ersetzt keinen A08-Nachweis.

Vor dem Anlegen Ziel/Host/Instanz, Kandidatenidentität, Sollkriterium, Gegenfälle und Aussagegrenze anpassen. Im Modus **Geführter realer Ablauf** bleibt jeder Fall offen, bis Prüfer, Beobachtung, Nachweisreferenz und Urteil dokumentiert sind. Im Modus **Vorhandene Testprogramme** für jeden Fall ein echtes Programm samt Argumenten und erwarteten Exitcodes eintragen. Der Platzhalter `{{variant}}` wird in Argumenten ersetzt. Die Programmfreigabe erfolgt unter Einstellungen.

Die generierten Definitionen können anschließend im Testkatalog einzeln auf andere Adapter umgestellt, erweitert oder mit eigenen Dateien verknüpft werden. Historische Bewertungen werden nicht als neue erfolgreiche Ergebnisse importiert. Eine manuelle Referenz wird gespeichert, ihr Inhalt aber nicht automatisch überprüft.

## Teststeuerung und Umgebung

- Projekte registrieren einen absoluten lokalen Dateiordner sowie Ziel, Kandidat und Umgebungsnotizen. Der angegebene Kandidat ist eine Deklaration; für einen tatsächlichen Paketnachweis zusätzlich einen SHA256-Dateitest oder ein geeignetes Testprogramm ausführen.
- Tests haben stabile IDs, Zweck, Sollkriterium, Gegenfälle, Quelle, Kategorie, Tags, Adapterregeln und Zeitlimit.
- Einzeltests, gefilterte Auswahl und Testpläne gezielt ausführen. Wiederholungen 1–100 werden ausdrücklich geplant. Maximal 10.000 Ausführungen pro Lauf.
- Ein aktiver Plan, serielle Ausführung, keine versteckten automatischen Wiederholungen. Optional nach dem ersten Fehler stoppen. Offene manuelle Fälle bleiben offen.
- Abbruch und Zeitlimit beenden unter Windows den Prozessbaum über taskkill; unter POSIX wird die Worker-Prozessgruppe beendet und ihr Ende mit Frist geprüft. Linux-Zombies zählen als beendet. Prozesse, die unter POSIX eine eigene Prozessgruppe/Sitzung eröffnen, liegen außerhalb dieser Garantie. Eine nicht bestätigte Beendigung wird als Fehler ausgewiesen.
- Datei-Inventar zeigt Einträge und direkt zugeordnete Datei-/Vergleichstests. Symlinks, ausgeschlossene Ordner, Zugriffsfehler und Begrenzungen werden ausgewiesen. Eine Verknüpfung bedeutet keine fachliche Testabdeckung.

## Auswertung und Belege

Jeder Lauf speichert ursprüngliche Testdefinitionen, Projektdefinitionen, Einstellungen, Wiederholungen, SHA256-Identitäten von Definition und Engine, Status, Dauer, Assertions und Adapternachweise. Quelldateien, die ein Datei-/Textadapter liest, werden mit Hash dokumentiert. Laufvergleich zeigt Zustands- und Dauerunterschiede; geänderte Definitionen oder Umgebungen erlauben keine automatische Regressionsaussage.

Ein Testplan gilt nur anhand seines eigenen vollständigen aktuellen Laufs als bestanden. Geänderte Engine, Definition, Umgebung, deklarierter Kandidat oder Ausführungseinstellungen machen das Urteil veraltet. Fehlende Ergebnisse sind unvollständig. Einzeltests fremder Pläne geben keine Freigabe.

Status unterscheidet bestanden, nicht bestanden, Ausführungsfehler, Zeitlimit, abgebrochen, unterbrochen, übersprungen und manuell offen. Checklisten benötigen je offenem Pflichtschritt ein neues Urteil mit Beobachtung und Nachweis. Urteile können nicht nachträglich überschrieben werden; erneut prüfen erzeugt einen neuen Lauf.

Exportformate: JSON mit vollständigem Snapshot, CSV und JUnit-XML. **Einstellungen → Kompletter Code (.txt)** exportiert die Programmquellen ohne persönliche Bibliothek und Läufe. Der Auslieferungsordner exports enthält zusätzlich ein ZIP und Quellmanifest.

## Adapter und tatsächlicher Umfang

- **file** — Dateien: Existenz, Typ, Größe, SHA256
- **text** — Text/Logs: Inhalte und Zeilen
- **json** — JSON-Pointer und typisierte Vergleiche
- **csv** — CSV-Struktur, Werte, Eindeutigkeit
- **compare** — Byte-, Text- oder JSON-Referenzvergleich
- **http** — HTTP-Status, Inhalt, JSON und Antwortdauer
- **command** — Bestehende lokale Testprogramme
- **manual** — Dokumentiertes Prüfurteil
- **assert** — Assertion · Soll/Ist
- **expression** — Ausdruck · reine Formeln
- **numeric** — Numerisch · Toleranz
- **regex** — Regex · Muster
- **schema** — JSON-Schema · Teilmenge
- **date** — Datum · Kalender
- **format** — Format · Syntax
- **stats** — Statistik · Kennzahlen
- **collection** — Kollektion · Arrays
- **table** — Datentabelle · Fälle
- **checklist** — Checkliste · Urteile
- **security** — Security · statische Regeln
- **a11y** — HTML · Zugänglichkeitsregeln
- **perf** — Performance · Formelbenchmark

Formeln verwenden einen eigenen begrenzten Parser, kein JavaScript-eval. Syntax: Zahlen, JSON-Zeichenfolgen, true/false/null, Arrays, pi/e, Rechen-/Vergleichs-/Logikoperatoren sowie abs, floor, ceil, round, sqrt, pow, min, max, sum, avg, len und clamp. Beispiel: `sum([1,2,3]) + pow(2,3)`. Keine Zugriffe auf Dateien, globale Objekte oder beliebige Funktionen. HTTP und Performance hängen von realen Laufzeitbedingungen ab; „deterministisch“ bezeichnet die feste Ausführungs- und Entscheidungslogik.

Security und A11y sind begrenzte statische Regeln. Sie ersetzen weder einen Penetrationstest noch Browserrendering, CSS-/Screenreaderprüfung oder einen vollständigen WCAG-Nachweis. JSON-Schema unterstützt die ausdrücklich dokumentierte Teilmenge; unbekannte oder widersprüchliche Regeln werden abgewiesen. Formatprüfungen prüfen Syntax; IBAN prüft Mod97, keine Länder-Längenliste oder Kontenexistenz. Statistik verwendet alle Messwerte, Populationsstandardabweichung und Nearest-Rank-p95.

Für Browser-/Desktop-/Hardware-/Last-/Installationsprüfungen werden passende externe Testwerkzeuge oder geführte reale Abläufe benötigt. pytest, dotnet test, Playwright oder eigene Programme lassen sich als command anschließen, werden aber nicht mitgeliefert. Ein beliebiger Exitcode 0 beweist nur den eingetragenen Vertrag; die gewählte Prüfung muss zum fachlichen Soll passen.

## Daten und Schnittstellen

.data/library.json enthält die Definitionen, .data/backups automatische Bibliothekssicherungen und .data/runs die vollständigen Laufdateien. Nach Neustart bleiben sie erhalten. Unterbrochene Läufe werden als solche gekennzeichnet. Beschädigte historische Dateien erzeugen Warnungen. Der Dienst benötigt lokale Schreibrechte. Zum Umziehen Dienst stoppen und Programm plus .data kopieren; Projektpfade danach anpassen. Das ZIP enthält keine Nutzerdaten.

Die REST-API lauscht nur auf Loopback. GET /api/bootstrap liefert Sitzungsschlüssel und Bibliotheksrevision. Andere API-Aufrufe verwenden X-Cockpit-Token; PUT /api/library und POST /api/quick-plans zusätzlich If-Match mit libraryRevision. Veraltete Änderungen werden mit 409 abgewiesen. Fremde Origins/Hostnamen werden zurückgewiesen. Das ist ein lokales Werkzeug für einen Benutzer, keine öffentlich betreibbare Mehrbenutzerplattform. Programmtests laufen mit den Rechten des Dienstbenutzers, ohne Shell-Interpretation; importierte Programme deshalb vor Ausführung prüfen.

```text
node tools/export-examples.mjs
node cli.mjs validate examples/library.json
node cli.mjs run examples/library.json --suite examples --output .cli-evidence
node cli.mjs run bibliothek.json --tests test-a,test-b --allow-commands
node tools/export-examples.mjs
node tools/verify.mjs
node tools/package.mjs
```

CLI-Exitcodes: 0 bestanden, 1 fachlich fehlgeschlagen/offen, 2 Eingabe-/Ausführungsfehler. Beispielbibliothek nach Umzug mit export-examples neu erzeugen. CONTRACT.md enthält den Datenvertrag und alle Adaptervorlagen.

## Herkunft und Verifikation

Eigenständige lokale Implementierung auf Basis des zuvor erstellten TestCockpit. Die Prüfzwecke der gelieferten PRÜFSTAND-Software wurden übernommen und ihre belegten Fehlbewertungen in Regressionen übersetzt. Dies ist keine Behauptung, die fremde Grok-Vorschau oder die unveränderte React-Anwendung repariert zu haben. Andere Produktquellen, insbesondere TobyKi, bleiben unverändert.

tools/verify.mjs führt alle Produkttests aus und schreibt TAP sowie eine Kandidatenidentität nach evidence. Die Veröffentlichungshinweise stehen in VERIFICATION.md. Bestandene Beispieltests sind kein Nachweis für fremde Software oder Hardware.
