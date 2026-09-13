# Moving TASK-O-TRON 9000 to another computer

Three things have to get across, and only the first one is in git:

| What | Where it lives | How it moves |
| --- | --- | --- |
| Source code | this repo | `git clone` |
| **The database** (your real tasks) | `src/TaskOTron.Api/taskotron.db` — **gitignored** | migration bundle (below) |
| Bank statement CSVs | `Extracts/` — **gitignored** | migration bundle (below) |
| Anthropic API key (for the Ask feature) | user secrets / env var — never in the repo | **you re-enter it by hand** |

Everything else (`bin/`, `obj/`, `node_modules/`, `web/.angular/`, `web/dist/`, `web/.certs/`) is
regenerated on the new machine — don't copy it.

---

## Prerequisites on the new computer

| | Version | Notes |
| --- | --- | --- |
| **.NET SDK** | **10.0.302** or newer patch | `global.json` pins `10.0.302` with `rollForward: latestPatch`, so a 10.0.3xx SDK is fine and a preview SDK is not. <https://dotnet.microsoft.com/download/dotnet/10.0> |
| **Node.js** | **24 LTS** | Brings npm 12. <https://nodejs.org/> |
| **git** | any | |
| GitHub CLI (`gh`) | optional | Only needed for the `/commit-and-pr` and `/merge-to-main` workflows. |
| Chrome | optional | Only for the `chrome-devtools` MCP server used by `/verify-ui`. |

Angular CLI does **not** need a global install — it comes in as a devDependency and is invoked as
`npx ng`.

> After installing Node, open a **new** shell. PATH changes are only picked up by newly started
> processes, which is exactly the trap the `/start-app` skill documents.

---

## Step 1 — On the OLD computer: pack the data

Stop the backend first (the SQLite write-ahead log should be checkpointed), then from the repo root:

```powershell
.\scripts\export-migration.ps1
```

This writes `taskotron-migration-<timestamp>.zip` next to the repo folder containing:

- `db/taskotron.db` (plus `-wal` / `-shm` if they exist)
- `Extracts/*.csv`
- `.claude/settings.local.json`
- `manifest.json` — creation time, source git commit, and a SHA256 for every file

Useful switches: `-OutDir D:\transfer` to choose where the zip lands, `-NoExtracts` to leave the
bank statements behind, `-Force` to export anyway while the backend is running.

Also make sure your work is pushed:

```powershell
git status --short
git push
```

Copy the zip to the new computer (USB stick, network share — it contains personal financial data,
so avoid anything public).

## Step 2 — On the NEW computer: clone and restore

```powershell
git clone https://github.com/zoldacic/TaskOTron9000.git
cd TaskOTron9000
.\scripts\import-migration.ps1 -Zip <path-to-the-zip>
```

The import verifies every checksum before writing anything, and refuses to overwrite an existing
database unless you pass `-Force` (it takes a timestamped `.backup-<timestamp>` copy either way).

## Step 3 — Set up the toolchain

```powershell
.\scripts\setup-new-machine.ps1
```

This restores NuGet and npm packages, exports the HTTPS dev certificate to `web/.certs/`, and tells
you what is still missing. Add `-RunTests` to run both test suites as a final check.

One thing it cannot do for you — trusting the certificate needs a Windows confirmation dialog:

```powershell
dotnet dev-certs https --trust
```

Without it, `https://localhost:4200` shows a browser interstitial and any `Invoke-WebRequest`
health check fails certificate validation (use `curl -k` if you skip it).

## Step 4 — Restore the Anthropic API key

The `/api/ask` endpoint reads `ANTHROPIC_API_KEY` from the environment first, then
`Anthropic:ApiKey` from configuration. The key is deliberately **not** in the migration bundle —
copy it out of your password manager on the old machine and set it on the new one:

```powershell
dotnet user-secrets set "Anthropic:ApiKey" "<your-key>" --project src/TaskOTron.Api
```

Skip this and everything works except Ask, which returns `503 No Anthropic API key configured`.

## Step 5 — Run it

Two shells, backend first:

```powershell
dotnet run --project src/TaskOTron.Api
```

```powershell
cd web; npx ng serve
```

Then open <https://localhost:4200>.

---

## Verify the move worked

1. **Backend is up** — `https://localhost:5249/healthz` returns `{"app":"TASK-O-TRON 9000 API","status":"online"}`.
2. **The data came across** — the task list shows your real tasks, not the demo seed. The seed only
   runs on an *empty* database, so if you see the prototype dataset, the restore did not land and
   the backend created a fresh DB. Stop it, delete `src/TaskOTron.Api/taskotron.db`, re-run
   `import-migration.ps1`, and start again.
3. **Categories and money** — open the Report view and confirm the totals match the old machine.
4. **Tests** — `dotnet test` at the root, and `npx ng test --watch=false` in `web/`.

## Troubleshooting

**`The backend is running on port 5249`** — the import script refuses to swap the database under a
live process. Stop `dotnet run` (or whatever holds the port) and retry.

**Demo tasks instead of real ones** — see verification step 2 above.

**`ReferenceError: describe is not defined`** — you ran `npx vitest` directly. The test globals come
from the `@angular/build:unit-test` builder; always go through `ng test`.

**`ng` is not recognized** — it is a local devDependency, so use `npx ng` (or `npm start` /
`npm test`). Also check you opened a new shell after installing Node.

**Migrations** — nothing to do by hand. `Program.cs` calls `db.Database.Migrate()` on startup, so a
restored database is upgraded automatically if the code is newer than the file.

**Never delete `taskotron.db` to "reseed"** — `BACKEND.md` says you can; on this machine that
destroys the real imported data. The seed only fills an empty database.
