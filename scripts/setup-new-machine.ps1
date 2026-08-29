<#
.SYNOPSIS
    Prepares a freshly cloned TASK-O-TRON 9000 checkout for development on this machine.

.DESCRIPTION
    Checks the toolchain, restores both dependency trees, and recreates the per-machine
    bits that are deliberately not in git:

      1. .NET SDK   -- must satisfy global.json (10.0.302, rollForward latestPatch)
      2. Node/npm   -- Node 24 / npm 12 expected
      3. dotnet restore + npm ci
      4. web/.certs -- HTTPS dev certificate exported for `ng serve`
      5. reports whether the database and the Anthropic API key are in place

    Safe to re-run.

.PARAMETER RunTests
    Also run the backend (xUnit) and frontend (Vitest) suites at the end.

.PARAMETER SkipCert
    Do not touch web/.certs.

.EXAMPLE
    .\scripts\setup-new-machine.ps1
    .\scripts\setup-new-machine.ps1 -RunTests
#>
[CmdletBinding()]
param(
    [switch] $RunTests,
    [switch] $SkipCert
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'TaskOTron.slnx'))) {
    throw "Could not find TaskOTron.slnx above '$PSScriptRoot'. Run this from inside the repo."
}

$warnings = New-Object System.Collections.ArrayList
function Warn([string] $Message) {
    [void]$warnings.Add($Message)
    Write-Host "  ! $Message" -ForegroundColor Yellow
}
function Step([string] $Title) {
    Write-Host ""
    Write-Host "== $Title" -ForegroundColor Cyan
}

# --- 1. toolchain -----------------------------------------------------------
Step "Toolchain"

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    throw "dotnet is not on PATH. Install the .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0"
}
$sdks = & dotnet --list-sdks
$net10 = $sdks | Where-Object { $_ -match '^10\.' }
if (-not $net10) {
    Write-Host ($sdks -join "`n")
    throw "No .NET 10 SDK found. global.json pins 10.0.302 (rollForward latestPatch). Install it from https://dotnet.microsoft.com/download/dotnet/10.0"
}
Write-Host "  dotnet SDK: $(& dotnet --version)"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "node is not on PATH. Install Node 24 LTS from https://nodejs.org/ (then open a NEW shell -- PATH is only picked up by new processes)."
}
$nodeVersion = & node --version
$nodeMajor = [int](($nodeVersion.TrimStart('v') -split '\.')[0])
Write-Host "  node: $nodeVersion"
if ($nodeMajor -lt 24) { Warn "Node $nodeVersion is older than the expected Node 24; Angular 22 may not build." }
Write-Host "  npm:  $(& npm --version)"

# --- 2. restore -------------------------------------------------------------
Step "Restoring .NET packages"
& dotnet restore (Join-Path $repo 'TaskOTron.slnx')
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed." }

Step "Restoring npm packages (npm ci)"
Push-Location (Join-Path $repo 'web')
try {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
} finally { Pop-Location }

# --- 3. https dev certificate ----------------------------------------------
if (-not $SkipCert) {
    Step "HTTPS dev certificate for ng serve"
    $certDir = Join-Path $repo 'web\.certs'
    if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir -Force | Out-Null }
    $pem = Join-Path $certDir 'localhost.pem'
    if (Test-Path $pem) {
        Write-Host "  web/.certs/localhost.pem already exists -- leaving it alone."
    }
    else {
        & dotnet dev-certs https --export-path $pem --format Pem --no-password
        if ($LASTEXITCODE -ne 0) { Warn "Exporting the dev certificate failed. See MIGRATION.md for the manual command." }
        else { Write-Host "  Exported to web/.certs/localhost.pem" }
    }
    $trust = & dotnet dev-certs https --check --trust 2>&1
    if ($LASTEXITCODE -ne 0) {
        Warn "The dev certificate is not trusted on this machine. Run:  dotnet dev-certs https --trust  (a Windows dialog will ask you to confirm). Until then the browser shows a warning at https://localhost:4200."
    }
    else { Write-Host "  Certificate is trusted." }
}

# --- 4. data + secrets ------------------------------------------------------
Step "Data and secrets"

$db = Join-Path $repo 'src\TaskOTron.Api\taskotron.db'
if (Test-Path $db) {
    $kb = [math]::Round((Get-Item -LiteralPath $db).Length / 1KB)
    Write-Host "  Database present: src/TaskOTron.Api/taskotron.db ($kb KB)"
}
else {
    Warn "No database at src/TaskOTron.Api/taskotron.db. Restore it with scripts\import-migration.ps1, or the backend will create an empty one and seed the demo dataset on first run."
}

$hasKey = $false
if ($env:ANTHROPIC_API_KEY) { $hasKey = $true; Write-Host "  Anthropic API key: found in ANTHROPIC_API_KEY." }
else {
    Push-Location $repo
    try {
        $secrets = & dotnet user-secrets list --project src/TaskOTron.Api 2>&1
        if ($LASTEXITCODE -eq 0 -and ($secrets -match 'Anthropic:ApiKey')) {
            $hasKey = $true
            Write-Host "  Anthropic API key: found in user secrets."
        }
    } catch {} finally { Pop-Location }
}
if (-not $hasKey) {
    Warn "No Anthropic API key configured -- the Ask feature will return 503. Set it with:  dotnet user-secrets set `"Anthropic:ApiKey`" `"<key>`" --project src/TaskOTron.Api"
}

# --- 5. optional tests ------------------------------------------------------
if ($RunTests) {
    Step "Backend tests (xUnit)"
    & dotnet test (Join-Path $repo 'TaskOTron.slnx')
    if ($LASTEXITCODE -ne 0) { Warn "dotnet test failed." }

    Step "Frontend tests (Vitest via ng)"
    Push-Location (Join-Path $repo 'web')
    try {
        & npx ng test --watch=false
        if ($LASTEXITCODE -ne 0) { Warn "ng test failed." }
    } finally { Pop-Location }
}

# --- done -------------------------------------------------------------------
Write-Host ""
if ($warnings.Count -eq 0) {
    Write-Host "Setup complete -- no warnings." -ForegroundColor Green
}
else {
    Write-Host "Setup complete with $($warnings.Count) warning(s):" -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "  - $w" -ForegroundColor Yellow }
}
Write-Host ""
Write-Host "Start the app with two shells:" -ForegroundColor Cyan
Write-Host "  1)  dotnet run --project src/TaskOTron.Api        (http://localhost:5249)"
Write-Host "  2)  cd web; npx ng serve                          (https://localhost:4200)"
