# Verifikation und Veröffentlichungsumfang

Evaluator – Inspector 1.0.0 ist ein lokales Einzelbenutzerwerkzeug. Es umfasst 22 Adapter, 108 konfigurierbare Vorlagen und eine reine Software-Engine ohne KI. Dieses Repository enthält die Programmquellen und reproduzierbare Tests; persönliche Bibliotheken und historische Laufdateien werden nicht mitgeliefert.

## Prüfungen

Die ursprüngliche Suite umfasst 66 Regressionen. Der vorbereitete Patch ergänzt gezielte Adapter-, Datenrettungs-, Shutdown-, CLI-, UI-Zustands- und Paketprüfungen. Die tatsächliche Testzahl und Ergebnisse stehen im TAP des jeweiligen Kandidaten. Die Suite prüft insbesondere positive und negative Adapterfälle, echte Prozessabbruch-/Timeoutwirkung, Schutz der Projektpfade, CSV-/JSON-Grenzfälle, Statistik, Datums-/Schema-/Regex-Regeln, atomare Importvalidierung, dauerhafte Snapshots, konkurrierende Änderungen, Testplanzuordnung und neue Checklistenurteile je Lauf.

Ausführen: `node tools/verify.mjs`. Der Befehl schreibt TAP und ein Quellmanifest in den ignorierten Ordner evidence. Die vorbereitete GitHub-Actions-Workflowdatei enthält Windows, Ubuntu und macOS mit Node.js 22 und 24; sie generiert zuerst lokale Beispielpfade. Eine vorbereitete Matrix ist kein Ausführungsnachweis. Der jeweilige Workflowstatus ist erst nach tatsächlichem Lauf der Nachweis für den zugehörigen Commit. Windows-Stop- und .NET-Paketprüfungen werden auf anderen Plattformen ausdrücklich übersprungen. POSIX-Prozessgruppenprüfung umfasst keine Prozesse mit eigener Sitzung/Gruppe.

Die lokale Ausgangslieferung wurde außerdem im Browser bedient: Beispielplan, konfigurierbare A04/A08-Varianten, absichtliche Regex-Gegenprobe und korrigierter Lauf, Vergleich, Checklistenurteile, Dateisuche und ungültiger Import. Start/Stop und Neustart bewahrten Definitionen und alle Lauf-Snapshots. Das Quellpaket wurde unabhängig entpackt und sein Beispielplan tatsächlich ausgeführt.

## Vorlagen und Aussagegrenzen

8 Lehren, 35 Prüfzwecke und 65 bewertete Quellenfälle liefern konfigurierbare Zwecke, Sollkriterien und Gegenfälle. Ihre Herkunft wird als Dokumentbezeichnung geführt. Die zugrunde liegenden lokalen Auditdateien werden nicht veröffentlicht. Die Vorlageninhalte sind vollständig im Ressourcen-JSON vorhanden.

Eine Vorlage ist noch kein ausgeführter Nachweis. Für Desktop-, Hardware-, Installations-, Last- und vollständige Browserprüfungen müssen passende Testprogramme angebunden oder reale Schritte dokumentiert werden. Statische Security-/HTML-Regeln sind keine umfassende Sicherheits- oder Barrierefreiheitsfreigabe. Kandidatenbezeichnungen sind deklarierte Metadaten; Datei-Hashes und reale Readbacks dienen dem tatsächlichen Identitätsnachweis.

## Quellpakete

`node tools/package.mjs` erzeugt ZIP, TXT und Einzeldateihashes in exports. Der TXT-Download im laufenden Cockpit nutzt dieselbe Dateiauswahl. GitHub ergänzt automatisch einen ZIP-Download des gesamten Repository-Commits.

Nach einem Umzug erzeugt `node tools/export-examples.mjs` die Beispielbibliothek mit dem eigenen absoluten Projektpfad. Die normale Oberfläche verwendet beim ersten Start automatisch den aktuellen Installationsordner. Runtime-Voraussetzung ist Node.js ≥22; Windows-Starter benötigen zusätzlich PowerShell 7. Eine npm-Veröffentlichung oder ein öffentlich erreichbarer Webdienst ist nicht Bestandteil dieses Repositorys.
