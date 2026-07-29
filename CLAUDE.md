# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TASK-O-TRON 9000 is a single-user desktop-styled task manager (dark "Windows 11" look). Beyond a
to-do list it tracks **money amounts** per task, **imports bank statements** (each transaction
becomes a task), and produces a **spending report**. Two-level category tree (main → sub), tasks
grouped by smart lists (Today / Upcoming / Completed / All).

Two projects:
- **Backend** — ASP.NET Core Minimal API, **.NET 10**, EF Core + SQLite, in `src/TaskOTron.Api`. No auth.
- **Frontend** — **Angular 22** standalone-component SPA (signals, zoneless, Vitest) in `web/`.

`Tasks.dc.html` at the repo root is the original in-memory prototype and the **source of truth for
behavior** — import parsing, report math, date logic, sort order were all ported from its bottom
`class Component` JS block. `README.md` documents the intended UI in detail; `BACKEND.md` the API.

## Commands

Backend (run from repo root):
```bash
dotnet run --project src/TaskOTron.Api      # serves http://localhost:5249, applies migrations + seeds
dotnet test                                  # xUnit tests for ImportParser + ReportBuilder
dotnet test --filter FullyQualifiedName~ImportParser   # single test class
dotnet ef migrations add <Name> --project src/TaskOTron.Api   # after changing an entity
```

Frontend (run from `web/`):
```bash
ng serve            # https://localhost:4200, proxies /api -> :5249 (proxy.conf.json), no CORS
ng test             # Vitest via @angular/build:unit-test; *.spec.ts colocated with source
ng build            # production build to web/dist/
ng test --include=src/app/core/bank-import.spec.ts   # single spec
```

Always run the frontend tests through `ng`. Invoking `npx vitest` directly fails with
`ReferenceError: describe is not defined` — the test globals come from the `@angular/build:unit-test`
builder (`web/angular.json`), not from a standalone vitest config. The whole suite runs in well under
10s, so narrowing rarely pays; `ng test --reporters=verbose` prints individual test names when you
need to confirm a specific spec actually ran.

The dev server serves **HTTPS** using the ASP.NET dev certificate, exported to `web/.certs/`
(gitignored, per-machine). The backend stays on plain HTTP — the browser never talks to it directly,
the dev-server proxy does. To recreate the cert on a new machine:
```bash
dotnet dev-certs https --export-path web/.certs/localhost.pem --format Pem --no-password
```
Trust it once (`dotnet dev-certs https --trust`, needs your confirmation in a Windows dialog) or the
browser and any `curl`/`Invoke-WebRequest` health check will reject it — use `curl -k` if untrusted.

Prefer the project skills for routine ops: `/start-app`, `/restart-backend`, `/verify-ui`,
`/commit-and-pr`, `/merge-to-main`. The backend does **not** survive being launched from a
background shell — use the skills, which handle this.

## Critical constraints

- **The SQLite DB (`src/TaskOTron.Api/taskotron.db`) holds the user's REAL imported tasks.** It does
  NOT reseed on restart (seed only runs on an empty DB). Ignore the "delete it to reseed" line in
  BACKEND.md for day-to-day work: deleting it destroys real data. Any test/experiment that mutates
  data through the API must be reverted.
- **All UI text is translated (EN/SV).** Never hardcode user-facing strings. Add a key to both
  `web/src/app/core/i18n/en.ts` and `sv.ts` and render via the store/`I18nService.t(key, params)`.
  `TranslationKey` is derived from `en.ts`, so a missing SV key is a type error.
- **Import parsing and report math are dual-implemented** on server (`Services/ImportParser.cs`,
  `Services/ReportBuilder.cs`) and mirrored on the client (`core/bank-import.ts`, plus report logic).
  Keep the two in sync and matched to the prototype; both have spec/unit tests asserting prototype
  outputs.

## Architecture

### Backend (`src/TaskOTron.Api`)
- `Program.cs` — composition root. Registers `AppDbContext`, CORS (`Cors:Origins` in appsettings),
  camelCase enum JSON, runs `Migrate()` + `DbInitializer.Seed()` on startup, then maps endpoint
  groups. Enums (e.g. `DateKind`) serialize as camelCase strings (`"due"` / `"transaction"`).
- `Endpoints/*.cs` — one static `Map…Endpoints()` extension per area (Todo, Category, Import, Report,
  BankAccount, SavedQuery, TitleDefault). `Mapping.cs` converts entities ↔ DTOs (`Dtos/Dtos.cs`).
- `Models/` — EF entities. `Data/AppDbContext.cs` + `Migrations/`. `DbInitializer.cs` seeds the exact
  prototype dataset (from `Tasks.dc.html`) only when the DB is empty.
- Cascade rules: deleting a main deletes its subs and strips those ids from tasks and title defaults;
  deleting a sub strips it from tasks. Report `categories` query param: omit = all, empty = none,
  `__none__` = uncategorized. See `TaskOTron.Api.http` for example requests.

### Frontend (`web/src/app`)
- **`core/task.store.ts` is the hub** — a single `@Injectable` root store holding all state in Angular
  **signals** (todos, categories, filters, dialog drafts, import rows, report selection). Components
  read `computed` signals and call store methods; the store calls `ApiService` and updates signals.
  `App.ngOnInit` calls `store.loadAll()`.
- `core/api.service.ts` — thin typed HttpClient wrapper, one method per endpoint. `core/api-base.ts`
  exports `API_BASE` (empty in dev; the proxy handles routing).
- `core/` pure helpers, each with a colocated `.spec.ts`: `bank-import.ts` (parse), `date-util.ts`,
  `money-util.ts`, `todo-util.ts` (smart-list `matches` + `sortTodos`), `task-query.ts` (saved-query
  matching). These are the ported prototype logic — change with care and update specs.
- `features/<area>/` view components (tasks, categories, import, report); `dialogs/` modal components;
  `shell/` title-bar + sidebar; `shared/icon.component.ts` (Lucide-style inline SVG). `models.ts` holds
  the TS types mirroring the backend DTOs.
- Smart-list filtering, sorting, due labels, and money formatting are **presentation** tied to "now"
  and live in the frontend by design (the backend returns raw data).

## Conventions
- Angular: standalone components, `ChangeDetectionStrategy.OnPush`, signals over RxJS for state, the
  `app-` selector prefix. New user-facing strings go through i18n (see above).
- After changing a backend entity, add an EF migration (do not hand-edit the model snapshot).
- Match surrounding style; keep the server/client ported-logic pair and its tests in agreement.
