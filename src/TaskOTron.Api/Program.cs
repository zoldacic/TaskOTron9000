using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
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
app.UseAuthentication();

// Single-user gate: this is a one-user system, so "authenticated" == "everything is available".
// A request from the local network is trusted outright (no login prompt on the LAN); anything
// else must carry a valid login cookie. /api/auth/* (login/logout/status) and the root health
// check stay open so the frontend can always ask "am I logged in?" and show a login form.
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path;
    if (path.StartsWithSegments("/api/auth") || path == "/")
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

app.MapAuthEndpoints();
app.MapTodoEndpoints();
app.MapCategoryEndpoints();
app.MapBankAccountEndpoints();
app.MapSavedQueryEndpoints();
app.MapTitleDefaultEndpoints();
app.MapImportEndpoints();
app.MapReportEndpoints();
app.MapAskEndpoints();

app.MapGet("/", () => Results.Ok(new { app = "TASK-O-TRON 9000 API", status = "online" }));

app.Run();

public partial class Program { } // exposed for WebApplicationFactory in tests
