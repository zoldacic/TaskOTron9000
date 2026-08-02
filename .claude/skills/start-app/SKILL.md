---
name: start-app
description: Start the TASK-O-TRON 9000 app locally — the .NET 10 backend (port 5249) and the Angular 22 frontend (port 4200). Use when the user wants to run, launch, boot, or serve the app / backend / frontend for local development.
---

# Start TASK-O-TRON 9000

The app has two processes that run together:

- **Backend** — `.NET 10` API in `src/TaskOTron.Api`. SQLite, seeds the DB on startup, listens on **http://localhost:5249**.
- **Frontend** — `Angular 22` SPA in `web/`. Listens on **https://localhost:4200** and proxies `/api` → `:5249` via `web/proxy.conf.json` (so no CORS setup needed). TLS uses the ASP.NET dev cert exported to `web/.certs/` (gitignored); if that folder is missing, recreate it with `dotnet dev-certs https --export-path web/.certs/localhost.pem --format Pem --no-password`.

Both must be running for the app to work. Start the backend first (the frontend proxies to it).

## 1. Backend

From the repo root:

```bash
dotnet run --project src/TaskOTron.Api
```

Leave it running. `global.json` pins the SDK to 10.0.302 (`rollForward: latestPatch`) so the build doesn't pick up a preview SDK.

**Wait for it before starting the frontend** — the first `dotnet run` restores + builds, so poll the root endpoint until it answers (it returns `{"status":"online"}`). Don't move on until this prints `BACKEND UP`:

```powershell
$ok=$false; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-WebRequest -Uri http://localhost:5249/ -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } } catch {} ; Start-Sleep -Seconds 2 }; if($ok){ Write-Output "BACKEND UP: $($r.Content)" } else { Write-Output "BACKEND NOT UP YET" }
```

## 2. Frontend

Node was installed after the shells were launched, so **the tool shells don't have Node on PATH automatically** — prefix PATH in the same command. In PowerShell:

```bash
$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:PATH"; cd web; ng serve
```

Notes:
- Run each process in its **own background shell** (or two terminals) — both are long-running.
- `ng` is a `.cmd` shim, so `Start-Process ng` fails. Invoke `ng` directly inside a PowerShell command instead.
- Toolchain versions: Node 24, npm 12, Angular CLI 22.

**Wait for the dev server to finish its first build** before declaring the app ready — the initial bundle takes ~10–15s. Poll `:4200` until it serves. The check can outlast a single command timeout on a cold build; if so, confirm from the `ng serve` background log (look for `Application bundle generation complete` / `Local: https://localhost:4200/`) and then a single request.

The dev cert is only trusted if someone ran `dotnet dev-certs https --trust` on this machine, so the health check accepts it explicitly — otherwise `Invoke-WebRequest` fails cert validation and the check lies to you:

```powershell
if(-not ("TrustAll" -as [type])){ Add-Type "using System.Net;using System.Security.Cryptography.X509Certificates;public class TrustAll : ICertificatePolicy { public bool CheckValidationResult(ServicePoint s, X509Certificate c, WebRequest r, int p) { return true; } }" }
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll
$ok=$false; for($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -Uri https://localhost:4200/ -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } } catch {} ; Start-Sleep -Seconds 2 }; if($ok){ Write-Output "FRONTEND UP" } else { Write-Output "FRONTEND NOT UP YET" }
```

## 3. Open / verify

Open **https://localhost:4200** in a browser. If the cert is untrusted the browser shows an interstitial — that is expected until `dotnet dev-certs https --trust` is run (the user must run it; it writes to the Windows root store).

> The in-app browser **screenshot** tool times out against this app (the renderer hangs on capture). To verify the app loaded, use `get_page_text`, `read_page`, or `javascript_tool` instead of a screenshot.

## Related commands

- Backend tests: `dotnet test`
- Frontend tests: `cd web && ng serve` prefix + `ng test --watch=false` (Vitest)
- Frontend production build: `ng build`
