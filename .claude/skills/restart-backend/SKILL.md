---
name: restart-backend
description: Restart the TASK-O-TRON 9000 .NET 10 backend API (port 5249) — stop any running instance and start a fresh one. Use when the user wants to restart, bounce, reboot, or relaunch the backend / API, e.g. after changing backend code or config.
---

# Restart the TASK-O-TRON 9000 backend

The backend is the `.NET 10` API in `src/TaskOTron.Api`. It uses SQLite, runs EF migrations on startup, and listens on **http://localhost:5249**. This skill stops any running instance and starts a fresh one. It does **not** touch the frontend (`:4200`).

> The SQLite DB holds the user's **real imported tasks** — startup only applies pending migrations, it does not reseed or wipe data. A restart is safe.

## 1. Stop any running instance

Find and stop whatever is listening on 5249 (there may be nothing — that's fine, a restart then is just a start):

```bash
Get-NetTCPConnection -LocalPort 5249 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

As a fallback, also stop any lingering TaskOTron host that isn't bound to the port yet. Note that `dotnet run` launches the app as a **separate `TaskOTron.Api.exe` child process** that outlives its shell — so match both that exe and any `dotnet.exe` still running the project:

```bash
Get-CimInstance Win32_Process -Filter "Name = 'TaskOTron.Api.exe'" |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name = 'dotnet.exe'" |
  Where-Object { $_.CommandLine -like '*TaskOTron*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

If you started the previous instance in a background shell this session, stop that shell too (TaskStop). Be aware the reverse also happens: the background `dotnet run` shell can report a **failure (exit 255)** while the detached `TaskOTron.Api.exe` keeps running and serving on 5249 — so always check the port (step 3) rather than trusting the shell's exit status.

## 2. Start a fresh instance

Run it in its **own background shell** (it's long-running) from the repo root:

```bash
dotnet run --project src/TaskOTron.Api
```

`global.json` pins the SDK to 10.0.302 (`rollForward: latestPatch`) so the build doesn't pick up a preview SDK.

## 3. Confirm it's up

Poll for the port to start listening (the build + migration check takes a few seconds):

```bash
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  if (Get-NetTCPConnection -LocalPort 5249 -State Listen -ErrorAction SilentlyContinue) { "LISTENING on 5249"; break }
  Start-Sleep -Seconds 2
}
```

You can also read the background shell's output — a healthy start ends with `Now listening on: http://localhost:5249` and `Application started`.

## Notes

- Don't use `Start-Process` for the server — run `dotnet run` directly inside a background PowerShell shell.
- This restarts only the backend. To (re)start the frontend or launch both together, use the **start-app** skill.
