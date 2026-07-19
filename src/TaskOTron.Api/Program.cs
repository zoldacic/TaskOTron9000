using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

const string DevCors = "dev-frontend";

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=taskotron.db"));

// Serialize enums as camelCase strings (e.g. "due" / "transaction"); keep null amounts as null.
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
});

builder.Services.AddCors(o => o.AddPolicy(DevCors, p =>
{
    var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
        ?? ["http://localhost:5173", "http://localhost:3000"];
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
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

app.MapTodoEndpoints();
app.MapCategoryEndpoints();
app.MapBankAccountEndpoints();
app.MapSavedQueryEndpoints();
app.MapTitleDefaultEndpoints();
app.MapImportEndpoints();
app.MapReportEndpoints();

app.MapGet("/", () => Results.Ok(new { app = "TASK-O-TRON 9000 API", status = "online" }));

app.Run();

public partial class Program { } // exposed for WebApplicationFactory in tests
