using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using TaskOTron.Api.Data;
using TaskOTron.Api.Endpoints;
using TaskOTron.Api.Services;

// `dotnet run --project src/TaskOTron.Api -- hash-password <password>` prints a PBKDF2 hash to
// store as Auth:PasswordHash (via `dotnet user-secrets set` in dev, or an env var in prod) —
// exits before the host is built, so it needs no DB or config beyond the raw args.
if (args.Length == 2 && args[0] == "hash-password")
{
    Console.WriteLine(PasswordHasher.Hash(args[1]));
    return;
}

var builder = WebApplication.CreateBuilder(args);

const string DevCors = "dev-frontend";

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=taskotron.db"));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "taskotron_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Kestrel only listens on https now
        options.ExpireTimeSpan = TimeSpan.FromDays(30);
        options.SlidingExpiration = true;
        // Minimal API, not MVC — never redirect to an HTML login page, just report the status.
        options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
        options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
    });

// Serialize enums as camelCase strings (e.g. "due" / "transaction"); keep null amounts as null.
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
});

builder.Services.AddCors(o => o.AddPolicy(DevCors, p =>
{
    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
        ?? ["http://localhost:5173", "http://localhost:3000"];
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));

var app = builder.Build();

// Apply migrations and seed on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    DbInitializer.Seed(db);
}

app.UseCors(DevCors);

// Serve the built Angular SPA (after `ng build`) from this same origin/port, if present.
// This matters for the login gate below: `ng serve`'s dev-server proxy forwards /api calls
// server-side, so the backend only ever sees that proxy's own loopback connection — never the
// real caller's IP — which makes the local-vs-remote check meaningless. Exposing this backend
// directly (with the SPA served from it) instead of the dev server is what fixes that; see
// BACKEND.md → Auth.
var angularDist = Path.GetFullPath(Path.Combine(
    builder.Environment.ContentRootPath, "..", "..", "web", "dist", "taskotron-web", "browser"));
StaticFileOptions? spaFiles = Directory.Exists(angularDist)
    ? new StaticFileOptions { FileProvider = new PhysicalFileProvider(angularDist) }
    : null;
if (spaFiles is not null) app.UseStaticFiles(spaFiles);

app.UseAuthentication();

// Single-user gate: this is a one-user system, so "authenticated" == "everything is available".
// A request from the local network is trusted outright (no login prompt on the LAN); anything
// else must carry a valid login cookie. Only /api/* is gated — /api/auth/* (login/logout/status)
// stays open so the frontend can always ask "am I logged in?", and everything outside /api/* is
// the SPA shell itself (or its assets), which the SPA's own login screen guards on the client.
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path;
    if (!path.StartsWithSegments("/api") || path.StartsWithSegments("/api/auth"))
    {
        await next();
        return;
    }
    if (NetworkUtil.IsLocalRequest(ctx) || (ctx.User.Identity?.IsAuthenticated ?? false))
    {
        await next();
        return;
    }
    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
    await ctx.Response.WriteAsJsonAsync(new { error = "unauthorized" });
});

// SPA fallback for deep-linked Angular routes (e.g. /tasks navigated to directly): if nothing
// below matched (routing's default 404) and it's not an /api/* path, serve index.html and let
// the Angular router take it from there. A plain middleware rather than MapFallbackToFile —
// registering both that and UseStaticFiles above (even with separate StaticFileOptions
// instances) makes UseStaticFiles stop serving real files, an ASP.NET Core routing quirk.
if (spaFiles is not null)
{
    var spaFileProvider = spaFiles.FileProvider!; // always set just above, alongside StaticFileOptions
    app.Use(async (ctx, next) =>
    {
        await next();
        if (ctx.Response.StatusCode != StatusCodes.Status404NotFound
            || ctx.Response.HasStarted
            || !HttpMethods.IsGet(ctx.Request.Method)
            || ctx.Request.Path.StartsWithSegments("/api"))
        {
            return;
        }
        var index = spaFileProvider.GetFileInfo("index.html");
        if (!index.Exists) return;
        ctx.Response.StatusCode = StatusCodes.Status200OK;
        ctx.Response.ContentType = "text/html";
        await using var stream = index.CreateReadStream();
        await stream.CopyToAsync(ctx.Response.Body);
    });
}

app.MapAuthEndpoints();
app.MapTodoEndpoints();
app.MapCategoryEndpoints();
app.MapBankAccountEndpoints();
app.MapSavedQueryEndpoints();
app.MapTitleDefaultEndpoints();
app.MapImportEndpoints();
app.MapReportEndpoints();
app.MapBudgetEndpoints();
app.MapAskEndpoints();

// Always-on health check (used by the start-app/restart-backend skills), kept off "/" itself
// so a built SPA can own the root path instead of a JSON blob.
app.MapGet("/healthz", () => Results.Ok(new { app = "TASK-O-TRON 9000 API", status = "online" }));
// No Angular build yet (plain API dev mode, e.g. alongside `ng serve`) — "/" still answers with
// the same JSON so visiting it in a browser or curling it isn't a surprise 404.
if (spaFiles is null)
{
    app.MapGet("/", () => Results.Ok(new { app = "TASK-O-TRON 9000 API", status = "online" }));
}

app.Run();

public partial class Program { } // exposed for WebApplicationFactory in tests
