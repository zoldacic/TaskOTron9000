# TASK-O-TRON 9000 — Backend

ASP.NET Core Web API (.NET 10) + EF Core + SQLite. Single-user, no auth. Persists the data
the `Tasks.dc.html` prototype held in memory (`todos`, `mains`, `subs`, `titleDefaults`) and
ports its bank-import parsing and spending-report math to the server.

## Run

```bash
dotnet run --project src/TaskOTron.Api
```

On startup it applies EF migrations and seeds a fresh DB with the exact prototype data
(18 tasks, 3 mains, 10 subs, 3 title defaults). The SQLite file is `src/TaskOTron.Api/taskotron.db`.
Delete it to reseed. Default URL: `http://localhost:5249` (see `Properties/launchSettings.json`).

## Test

```bash
dotnet test
```

Unit tests cover the two ported services (`ImportParser`, `ReportBuilder`) against known
prototype outputs.

## API

| Area | Endpoints |
|------|-----------|
| Tasks | `GET/POST /api/todos`, `GET/PUT/DELETE /api/todos/{id}`, `PATCH /api/todos/{id}/toggle` |
| Categories | `GET /api/categories`; `POST/PUT/DELETE /api/mains/{id}`; `POST/PUT/DELETE /api/subs/{id}` |
| Title defaults | `GET /api/title-defaults`, `PUT/DELETE /api/title-defaults/{title}` |
| Import | `POST /api/import/parse`, `POST /api/import/commit` |
| Reports | `GET /api/report?from=YYYY-MM-DD&to=YYYY-MM-DD&categories=<csv>` |

See `src/TaskOTron.Api/TaskOTron.Api.http` for ready-to-run example requests.

## Frontend

An Angular 22 SPA lives in `web/` (see `web/README.md` from the scaffold). Run it against this API:

```bash
# terminal 1 — backend
dotnet run --project src/TaskOTron.Api
# terminal 2 — frontend (proxies /api -> :5249, so no CORS)
cd web && ng serve
```

Then open https://localhost:4200. `ng test` runs the frontend unit tests; `ng build` produces `web/dist/`.

### Notes
- Deleting a main cascades to its subs and strips them from tasks and title defaults.
- The report `categories` param: omit for **all** categories, empty for **none**; include
  `__none__` to select uncategorized tasks.
- Smart-list filtering (today/upcoming/overdue), sorting, due labels, and money formatting
  are presentation tied to "now" and stay in the frontend, matching the prototype.
- CORS dev origins are configurable via `Cors:Origins` in `appsettings.json`.
