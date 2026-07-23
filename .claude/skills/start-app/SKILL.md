---
name: start-app
description: Start the TASK-O-TRON 9000 app locally — the .NET 10 backend (port 5249) and the Angular 22 frontend (port 4200). Use when the user wants to run, launch, boot, or serve the app / backend / frontend for local development.
---

# Start TASK-O-TRON 9000

The app has two processes that run together:

- **Backend** — `.NET 10` API in `src/TaskOTron.Api`. SQLite, seeds the DB on startup, listens on **http://localhost:5249**.
- **Frontend** — `Angular 22` SPA in `web/`. Listens on **http://localhost:4200** and proxies `/api` → `:5249` via `web/proxy.conf.json` (so no CORS setup needed).

Both must be running for the app to work. Start the backend first (the frontend proxies to it).

## 1. Backend

From the repo root:

```bash
dotnet run --project src/TaskOTron.Api
```

Leave it running. `global.json` pins the SDK to 10.0.302 (`rollForward: latestPatch`) so the build doesn't pick up a preview SDK.

## 2. Frontend

Node was installed after the shells were launched, so **the tool shells don't have Node on PATH automatically** — prefix PATH in the same command. In PowerShell:

```bash
$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:PATH"; cd web; ng serve
```

Notes:
- Run each process in its **own background shell** (or two terminals) — both are long-running.
- `ng` is a `.cmd` shim, so `Start-Process ng` fails. Invoke `ng` directly inside a PowerShell command instead.
- Toolchain versions: Node 24, npm 12, Angular CLI 22.

## 3. Open / verify

Open **http://localhost:4200** in a browser.

> The in-app browser **screenshot** tool times out against this app (the renderer hangs on capture). To verify the app loaded, use `get_page_text`, `read_page`, or `javascript_tool` instead of a screenshot.

## Related commands

- Backend tests: `dotnet test`
- Frontend tests: `cd web && ng serve` prefix + `ng test --watch=false` (Vitest)
- Frontend production build: `ng build`
