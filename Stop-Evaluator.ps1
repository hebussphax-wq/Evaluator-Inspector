param([int]$Port = 4318)
$ErrorActionPreference = 'Stop'
$address = "http://127.0.0.1:$Port"
try {
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 2 } catch { }
    if ($null -eq $health) { Write-Output 'Kein erreichbarer Dienst an diesem Port; ein Prozessende wurde nicht geprüft.'; exit 0 }
    if ($health.application -ne 'evaluator-inspector' -or [IO.Path]::GetFullPath($health.root) -ne [IO.Path]::GetFullPath($PSScriptRoot)) { throw 'Fremde Dienstidentität; keine Aktion ausgeführt.' }
    if (-not $health.pid -or -not $health.dataDir) { throw 'Dienst liefert keine prüfbare Prozessidentität.' }
    $lockFile = Join-Path ([IO.Path]::GetFullPath($health.dataDir)) 'service.lock'
    $lockText = Get-Content -LiteralPath $lockFile -Raw
    $identity = ConvertFrom-Json -InputObject $lockText
    if ($identity.pid -ne $health.pid) { throw 'PID von Dienst und Sperrdatei stimmen nicht überein.' }
    $owner = Get-Process -Id ([int]$identity.pid)
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port)
    $matches = @($listeners.Where({ $_.OwningProcess -eq $owner.Id }))
    if ($matches.Count -eq 0) { throw 'Port gehört nicht zum angegebenen Prozess.' }
    $bootstrap = Invoke-RestMethod -Uri "$address/api/bootstrap" -TimeoutSec 2
    if ($null -ne $bootstrap.active) { throw 'Aktiven Lauf zuerst im Cockpit abbrechen und seinen Abschluss abwarten.' }
    $receipt = Invoke-RestMethod -Uri "$address/api/shutdown" -Method Post -ContentType 'application/json' -Body '{}' -Headers @{'X-Cockpit-Token' = $bootstrap.token} -TimeoutSec 3
    if (-not $receipt.shutdownRequested) { throw 'Abschaltanforderung nicht bestätigt.' }
    if (-not $owner.WaitForExit(5000)) { throw 'Prozessende noch nicht bestätigt.' }
    if (Test-Path -LiteralPath $lockFile) { throw 'Prozess beendet, Datenordnersperre aber noch vorhanden oder neu belegt.' }
    Write-Output 'Dienstprozess beendet und Datenordnersperre freigegeben. Definitionen und Läufe bleiben gespeichert.'
    exit 0
} catch { Write-Error $_; exit 1 }
