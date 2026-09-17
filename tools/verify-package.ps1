param([Parameter(Mandatory = $true)][string]$Root)
$ErrorActionPreference = 'Stop'
$resolvedRoot = [IO.Path]::GetFullPath($Root)
$exportDir = Join-Path $resolvedRoot 'exports'
$manifestText = [IO.File]::ReadAllText((Join-Path $exportDir 'manifest.json'))
$manifest = ConvertFrom-Json -InputObject $manifestText
$zipFile = Join-Path $exportDir 'Evaluator-Inspector.zip'
$textFile = Join-Path $exportDir 'Evaluator-Inspector-komplettes-programm.txt'
function Hash-Bytes([byte[]]$Bytes) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()
}
if ((Hash-Bytes ([IO.File]::ReadAllBytes($zipFile))) -ne $manifest.zipSha256) { throw 'ZIP-Gesamthash falsch' }
if ((Hash-Bytes ([IO.File]::ReadAllBytes($textFile))) -ne $manifest.textSha256) { throw 'Textpaket-Gesamthash falsch' }
$archive = [IO.Compression.ZipFile]::OpenRead($zipFile)
try {
    if ($archive.Entries.Count -ne $manifest.files.Count) { throw 'ZIP-Dateimenge falsch' }
    foreach ($file in $manifest.files) {
        $entry = $archive.GetEntry('Evaluator-Inspector/' + $file.name)
        if ($null -eq $entry) { throw "ZIP-Eintrag fehlt: $($file.name)" }
        $stream = $entry.Open()
        $memory = [IO.MemoryStream]::new()
        try { $stream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $stream.Dispose(); $memory.Dispose() }
        if ($bytes.Length -ne $file.bytes -or (Hash-Bytes $bytes) -ne $file.sha256) { throw "ZIP-Inhalt falsch: $($file.name)" }
        if ((Hash-Bytes ([IO.File]::ReadAllBytes((Join-Path $resolvedRoot $file.name)))) -ne $file.sha256) { throw "Quellhash falsch: $($file.name)" }
        if ($file.name -match '(^|/)(\.data|evidence|node_modules)/') { throw 'Private Daten im Paket' }
    }
} finally { $archive.Dispose() }
Write-Output "PACKAGE_VERIFIED entries=$($manifest.files.Count) sha256=verified reader=dotnet"
