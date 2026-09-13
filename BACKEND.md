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
Delete it to reseed. Default URL: `https://0.0.0.0:5249` — HTTPS on every interface, using the dev cert at `web/.certs/` (`Kestrel:Certificates:Default` in `appsettings.json`; see `Properties/launchSettings.json` and CLAUDE.md).

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

See `src/TaskOTron.Api/TaskOTron.Api.http` for ready-to-run example requests. `GET /healthz`
(always 200 `{"status":"online"}`, ungated) is a health check, not part of the app's API —
`/` is where the built SPA lives instead (see Deployment below).

## Auth

A request from the local network (10/8, 172.16/12, 192.168/16, link-local, loopback — see
`Services/NetworkUtil.cs`) gets full access outright: this is a one-user home system, so nothing
is gated on the LAN. A request from anywhere else must carry a valid login cookie, checked by a
gate middleware in `Program.cs` in front of every `/api/*` endpoint except `/api/auth/*`.

**This backend must be the thing actually exposed to the internet — not `ng serve`.** The check
reads `HttpContext.Connection.RemoteIpAddress` directly (no reverse proxy in front, so there's no
forwarded-for header to trust or spoof) — deliberately, since that's the real client IP *only*
when nothing sits between the caller and this process. `ng serve`'s dev-server proxy forwards
`/api/*` calls server-side, so if you expose `:4200` instead, the backend only ever sees that
proxy's own loopback connection and the gate never fires for anyone, local or not. See
Deployment below for the setup that keeps this check meaningful.

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

**Login only travels safely over HTTPS**, so Kestrel terminates TLS itself (`https://0.0.0.0:5249`,
self-signed dev cert, login cookie marked `Secure`). Doing it in-process rather than behind a reverse
proxy is deliberate: a proxy on the same machine would hand this process `127.0.0.1` for every
caller and the gate above would wave the whole internet through as "local". If you ever do put a
proxy in front, add `UseForwardedHeaders` with only that proxy in `KnownProxies` and bind Kestrel
to loopback. For a real (browser-trusted) certificate you need a DNS name — swap the PEM paths in
`appsettings.json`; the self-signed cert means a one-time warning on each device instead.

## Deployment (exposing this to the internet)

For day-to-day local dev, keep using `ng serve` + `dotnet run` as two processes (see Frontend
below) — the router port-forward just shouldn't point at `:4200`. To actually expose the app:

```bash
cd web && ng build              # writes web/dist/taskotron-web/browser
dotnet run --project src/TaskOTron.Api
```

`Program.cs` looks for that `web/dist/taskotron-web/browser` folder on startup; when it's there,
the backend serves the SPA itself — `/` and any other non-`/api` path return the Angular app
(`index.html` for deep links like `/tasks`, real files for its JS/CSS/etc.), `/api/*` is the
gated API, and there's no dev-server proxy in the way. Forward your router's port at **this**
process (`:5249`, or whatever you rebind Kestrel to), not `:4200`. TLS is already on (Kestrel
terminates it, see Auth above), so nothing else needs to sit in front. Without a `web/dist` build present, `/` falls
back to the same JSON as `/healthz` (below), matching the old dev-only behavior.

A version of `web/dist` a few commits stale still works — it's just what "reload the browser tab"
looks like a bit behind. Re-run `ng build` after frontend changes you want reflected there.

## Frontend

An Angular 22 SPA lives in `web/` (see `web/README.md` from the scaffold). Run it against this API:

```bash
# terminal 1 — backend
dotnet run --project src/TaskOTron.Api
# terminal 2 — frontend (proxies /api -> https://localhost:5249, so no CORS)
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
