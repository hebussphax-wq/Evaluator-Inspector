param([int]$Port = 4318)
$ErrorActionPreference = 'Stop'
$address = "http://127.0.0.1:$Port"
try {
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 2 } catch { }
    if ($null -eq $health) { Write-Output 'Kein erreichbarer Dienst an diesem Port.'; exit 0 }
    if ($health.application -ne 'evaluator-inspector' -or [IO.Path]::GetFullPath($health.root) -ne [IO.Path]::GetFullPath($PSScriptRoot)) { throw 'Fremde Dienstidentität; keine Aktion ausgeführt.' }
    $bootstrap = Invoke-RestMethod -Uri "$address/api/bootstrap" -TimeoutSec 2
    if ($null -ne $bootstrap.active) { throw 'Aktiven Lauf zuerst im Cockpit abbrechen und seinen Abschluss abwarten.' }
    $receipt = Invoke-RestMethod -Uri "$address/api/shutdown" -Method Post -ContentType 'application/json' -Body '{}' -Headers @{'X-Cockpit-Token' = $bootstrap.token} -TimeoutSec 3
    if (-not $receipt.shutdownRequested) { throw 'Abschaltanforderung nicht bestätigt.' }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 100
        $stillRunning = $false
        try { $check = Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 1; $stillRunning = $true } catch { }
        if (-not $stillRunning) { Write-Output 'Dienst beendet. Definitionen und Läufe bleiben gespeichert.'; exit 0 }
    }
    throw 'Dienstende noch nicht bestätigt.'
} catch { Write-Error $_; exit 1 }
