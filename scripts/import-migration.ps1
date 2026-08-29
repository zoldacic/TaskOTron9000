<#
.SYNOPSIS
    Restores a TASK-O-TRON 9000 migration bundle into a fresh clone on the new computer.

.DESCRIPTION
    Unpacks the zip produced by scripts/export-migration.ps1:

      db\taskotron.db (+ -wal/-shm) -> src/TaskOTron.Api/
      Extracts\*                    -> Extracts/
      claude\settings.local.json    -> .claude/

    File contents are verified against the SHA256 hashes in the bundle manifest.
    An existing database is never silently overwritten -- it is backed up first,
    and only replaced when -Force is passed.

.PARAMETER Zip
    Path to the taskotron-migration-*.zip file.

.PARAMETER Force
    Replace an existing taskotron.db (a timestamped backup is kept regardless).

.EXAMPLE
    .\scripts\import-migration.ps1 -Zip D:\transfer\taskotron-migration-20260829-120000.zip
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Zip,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'TaskOTron.slnx'))) {
    throw "Could not find TaskOTron.slnx above '$PSScriptRoot'. Run this from inside the repo."
}
if (-not (Test-Path -LiteralPath $Zip)) { throw "Bundle not found: $Zip" }

$listening = $null
try { $listening = Get-NetTCPConnection -LocalPort 5249 -State Listen -ErrorAction Stop } catch {}
if ($listening) {
    throw "The backend is running on port 5249. Stop it before restoring the database."
}

$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("taskotron-import-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $Zip -DestinationPath $staging -Force

$manifestPath = Join-Path $staging 'manifest.json'
if (-not (Test-Path $manifestPath)) { throw "manifest.json missing -- '$Zip' is not a TASK-O-TRON migration bundle." }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

Write-Host "Bundle created $($manifest.createdUtc) on $($manifest.machine)" -ForegroundColor Cyan
if ($manifest.gitCommit) { Write-Host "Source commit: $($manifest.gitBranch) @ $($manifest.gitCommit)" }
Write-Host ""

Write-Host "Verifying $($manifest.files.Count) file(s)..."
foreach ($f in $manifest.files) {
    $src = Join-Path $staging $f.path
    if (-not (Test-Path -LiteralPath $src)) { throw "Bundle is incomplete: '$($f.path)' is missing." }
    $actual = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
    if ($actual -ne $f.sha256) { throw "Checksum mismatch for '$($f.path)' -- the bundle is corrupt." }
}
Write-Host "All checksums OK." -ForegroundColor Green
Write-Host ""

# --- database ---------------------------------------------------------------
$apiDir = Join-Path $repo 'src\TaskOTron.Api'
$dbDest = Join-Path $apiDir 'taskotron.db'

if (Test-Path $dbDest) {
    $backup = "$dbDest.backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
    Copy-Item -LiteralPath $dbDest -Destination $backup -Force
    Write-Host "Existing database backed up to $backup" -ForegroundColor Yellow
    if (-not $Force) {
        Remove-Item -LiteralPath $staging -Recurse -Force
        throw "A database already exists at '$dbDest'. Re-run with -Force to replace it (the backup above is kept)."
    }
    foreach ($suffix in '-wal', '-shm') {
        $side = "$dbDest$suffix"
        if (Test-Path $side) { Remove-Item -LiteralPath $side -Force }
    }
}

foreach ($f in $manifest.files) {
    $src = Join-Path $staging $f.path
    if ($f.path -like 'db\*') {
        $dest = Join-Path $apiDir (Split-Path -Leaf $f.path)
    }
    elseif ($f.path -like 'claude\*') {
        $dest = Join-Path $repo ('.claude\' + (Split-Path -Leaf $f.path))
    }
    else {
        $dest = Join-Path $repo $f.path
    }
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest -Force
    Write-Host ("  -> {0}" -f $dest.Substring($repo.Length).TrimStart('\'))
}

Remove-Item -LiteralPath $staging -Recurse -Force

Write-Host ""
Write-Host "Restore complete." -ForegroundColor Green
Write-Host "Next:  .\scripts\setup-new-machine.ps1" -ForegroundColor Cyan
