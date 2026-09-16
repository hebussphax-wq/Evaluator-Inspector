param([switch]$NoBrowser, [int]$Port = 4318)
$ErrorActionPreference = 'Stop'
$productRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$address = "http://127.0.0.1:$Port"
function Read-Health {
    try { return Invoke-RestMethod -Uri "$address/api/health" -TimeoutSec 2 } catch { return $null }
}
function Assert-Identity($health) {
    if ($health.application -ne 'evaluator-inspector' -or [IO.Path]::GetFullPath($health.root) -ne $productRoot) {
        throw "Port $Port wird von einem anderen Programm oder Produktordner verwendet."
    }
}
try {
    $health = Read-Health
    if ($null -ne $health) { Assert-Identity $health } else {
        $nodePath = 'C:\Program Files\nodejs\node.exe'
        if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { $nodePath = (Get-Command node.exe -ErrorAction Stop).Source }
        $nodeVersion = & $nodePath --version
        if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22 oder neuer erforderlich.' }
        $runtimeDir = Join-Path $productRoot '.data'
        [void][IO.Directory]::CreateDirectory($runtimeDir)
        $env:COCKPIT_PORT = [string]$Port
        $env:COCKPIT_DATA = $runtimeDir
        $serverArgument = '"' + (Join-Path $productRoot 'server.mjs') + '"'
        $service = Start-Process -FilePath $nodePath -ArgumentList @($serverArgument) -WorkingDirectory $productRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'service.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'service.stderr.log')
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 200
            $health = Read-Health
            if ($null -ne $health) { break }
            if ($service.HasExited) { throw ('Dienst beendet. Siehe ' + (Join-Path $runtimeDir 'service.stderr.log')) }
        }
        if ($null -eq $health) { throw 'Dienststart nicht bestätigt. Protokoll im Ordner .data prüfen.' }
        Assert-Identity $health
    }
    Write-Output "Evaluator – Inspector: $address"
    if (-not $NoBrowser) { Start-Process $address }
} catch { Write-Error $_; exit 1 }
