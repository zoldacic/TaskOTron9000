# TASK-O-TRON 9000 — Backend

ASP.NET Core Web API (.NET 10) + EF Core + SQLite. Single-user: once past the login gate (see
Auth below), everything is available — there's no per-user permission model. Persists the data
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

## Auth

A request from the local network (10/8, 172.16/12, 192.168/16, link-local, loopback — see
`Services/NetworkUtil.cs`) gets full access outright: this is a one-user home system, so nothing
is gated on the LAN. A request from anywhere else must carry a valid login cookie, checked by a
gate middleware in `Program.cs` in front of every endpoint except `/api/auth/*`. This assumes the
app is reached remotely via a router port-forward straight to this process — there's no reverse
proxy in front, so `HttpContext.Connection.RemoteIpAddress` is the real client IP (nothing to
spoof via a forwarded-for header, because none is trusted).

Endpoints (`Endpoints/AuthEndpoints.cs`): `GET /api/auth/status` (always open — `{ authenticated,
isLocal, username }`, so the frontend knows whether to show a login form at all), `POST
/api/auth/login` (`{ username, password }`, sets a cookie), `POST /api/auth/logout`.

The one username/password pair lives in config as `Auth:Username` / `Auth:PasswordHash` — **never
commit a real value to `appsettings.json`**, set it via user secrets (dev) or an env var (prod):

```bash
dotnet run --project src/TaskOTron.Api -- hash-password "your password"   # prints a PBKDF2 hash
dotnet user-secrets set Auth:Username "yourname" --project src/TaskOTron.Api
dotnet user-secrets set Auth:PasswordHash "<hash from above>" --project src/TaskOTron.Api
```

In production, set the `Auth__Username` / `Auth__PasswordHash` environment variables instead
(double underscore = ASP.NET Core's config-section separator). Until both are set, `/api/auth/login`
returns 500 rather than silently rejecting every attempt.

**Login only travels safely over HTTPS.** The dev setup (`ng serve` fronting the plain-HTTP
backend) is fine on the LAN; before actually exposing the forwarded port to the internet, put
TLS in front of it (e.g. a Caddy reverse proxy with automatic certs) — sending the password over
plain HTTP defeats the point of the login.

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
