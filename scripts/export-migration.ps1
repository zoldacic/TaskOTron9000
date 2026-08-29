<#
.SYNOPSIS
    Packs the machine-local TASK-O-TRON 9000 data into a single zip for moving to another computer.

.DESCRIPTION
    The source code travels through git. This script packs everything that does NOT:

      * src/TaskOTron.Api/taskotron.db  (+ -wal/-shm) -- the real task database
      * Extracts/                        -- imported bank statement CSVs (personal data)
      * .claude/settings.local.json      -- per-machine Claude Code settings (optional)

    It does NOT pack secrets. The Anthropic API key must be re-entered on the new
    machine by hand -- see MIGRATION.md.

.PARAMETER OutDir
    Directory to write the zip to. Defaults to the parent of the repo.

.PARAMETER NoExtracts
    Skip the Extracts/ folder (bank statement CSVs).

.PARAMETER Force
    Export even if the backend appears to be running on port 5249.

.EXAMPLE
    .\scripts\export-migration.ps1
    .\scripts\export-migration.ps1 -OutDir D:\transfer -NoExtracts
#>
[CmdletBinding()]
param(
    [string] $OutDir,
    [switch] $NoExtracts,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'TaskOTron.slnx'))) {
    throw "Could not find TaskOTron.slnx above '$PSScriptRoot'. Run this from inside the repo."
}
if (-not $OutDir) { $OutDir = Split-Path -Parent $repo }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$db = Join-Path $repo 'src\TaskOTron.Api\taskotron.db'
if (-not (Test-Path $db)) {
    throw "No database at '$db'. Nothing to export -- is this the machine with the real data?"
}

# A running backend can hold un-checkpointed pages in the -wal file. Copying all three
# files together is still consistent, but a clean shutdown is safer.
$listening = $null
try { $listening = Get-NetTCPConnection -LocalPort 5249 -State Listen -ErrorAction Stop } catch {}
if ($listening -and -not $Force) {
    throw "The backend looks like it is running (port 5249 is listening). Stop it first, then re-run. Use -Force to override."
}

$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "taskotron-migration-$stamp"
$zipPath = Join-Path $OutDir "taskotron-migration-$stamp.zip"

New-Item -ItemType Directory -Path (Join-Path $staging 'db') -Force | Out-Null

$entries = @()

function Add-Entry([string] $Source, [string] $RelativeTarget) {
    $dest = Join-Path $staging $RelativeTarget
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    $hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
    $size = (Get-Item -LiteralPath $dest).Length
    Write-Host ("  + {0,-52} {1,10:N0} bytes" -f $RelativeTarget, $size)
    return [PSCustomObject]@{ path = $RelativeTarget; sha256 = $hash; bytes = $size }
}

Write-Host "Packing TASK-O-TRON 9000 migration bundle..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Database:"
$entries += Add-Entry $db 'db\taskotron.db'
foreach ($suffix in '-wal', '-shm') {
    $side = "$db$suffix"
    if (Test-Path $side) { $entries += Add-Entry $side "db\taskotron.db$suffix" }
}

if (-not $NoExtracts) {
    $extracts = Join-Path $repo 'Extracts'
    if (Test-Path $extracts) {
        Write-Host "Bank statement extracts:"
        Get-ChildItem -LiteralPath $extracts -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($repo.Length).TrimStart('\')
            $entries += Add-Entry $_.FullName $rel
        }
    }
}

$localSettings = Join-Path $repo '.claude\settings.local.json'
if (Test-Path $localSettings) {
    Write-Host "Claude Code local settings:"
    $entries += Add-Entry $localSettings 'claude\settings.local.json'
}

$commit = ''
$branch = ''
try {
    Push-Location $repo
    $commit = (git rev-parse HEAD 2>$null)
    $branch = (git rev-parse --abbrev-ref HEAD 2>$null)
} catch {} finally { Pop-Location }

$manifest = [PSCustomObject]@{
    tool        = 'taskotron-export-migration'
    version     = 1
    createdUtc  = (Get-Date).ToUniversalTime().ToString('o')
    machine     = $env:COMPUTERNAME
    gitCommit   = $commit
    gitBranch   = $branch
    files       = $entries
}
$manifest | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $staging 'manifest.json') -Encoding utf8

if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $staging -Recurse -Force

$zipSize = (Get-Item -LiteralPath $zipPath).Length
Write-Host ""
Write-Host "Wrote $zipPath ($('{0:N0}' -f $zipSize) bytes)" -ForegroundColor Green
Write-Host ""
Write-Host "Next, on the NEW machine:" -ForegroundColor Cyan
Write-Host "  1. git clone https://github.com/zoldacic/TaskOTron9000.git"
Write-Host "  2. .\scripts\import-migration.ps1 -Zip <path-to-this-zip>"
Write-Host "  3. .\scripts\setup-new-machine.ps1"
Write-Host ""
Write-Host "NOT included (on purpose): the Anthropic API key." -ForegroundColor Yellow
Write-Host "Set it on the new machine with:  dotnet user-secrets set `"Anthropic:ApiKey`" `"<key>`" --project src/TaskOTron.Api"
