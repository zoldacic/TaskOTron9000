using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

public static class SavedQueryEndpoints
{
    // The criteria blob is stored/read with the same camelCase options the API uses on the wire.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static void MapSavedQueryEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/saved-queries");

        g.MapGet("", async (AppDbContext db) =>
        {
            var rows = await db.SavedQueries.OrderBy(q => q.Name).AsNoTracking().ToListAsync();
            return Results.Ok(rows.Select(ToDto).ToList());
        });

        g.MapPost("", async (SavedQueryWriteDto dto, AppDbContext db) =>
        {
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            if (await db.SavedQueries.AnyAsync(q => q.Name == name))
                return Results.Conflict($"A saved query named '{name}' already exists.");
            var id = await UniqueId(db, "q", async gid => await db.SavedQueries.AnyAsync(q => q.Id == gid));
            var row = new SavedQuery { Id = id, Name = name, CriteriaJson = JsonSerializer.Serialize(dto.Query, Json) };
            db.SavedQueries.Add(row);
            await db.SaveChangesAsync();
            return Results.Created($"/api/saved-queries/{row.Id}", ToDto(row));
        });

        // Rename and/or overwrite the criteria of an existing saved query.
        g.MapPut("/{id}", async (string id, SavedQueryWriteDto dto, AppDbContext db) =>
        {
            var row = await db.SavedQueries.FindAsync(id);
            if (row is null) return Results.NotFound();
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            if (await db.SavedQueries.AnyAsync(q => q.Name == name && q.Id != id))
                return Results.Conflict($"A saved query named '{name}' already exists.");
            row.Name = name;
            row.CriteriaJson = JsonSerializer.Serialize(dto.Query, Json);
            await db.SaveChangesAsync();
            return Results.Ok(ToDto(row));
        });

        g.MapDelete("/{id}", async (string id, AppDbContext db) =>
        {
            var row = await db.SavedQueries.FindAsync(id);
            if (row is null) return Results.NotFound();
            db.SavedQueries.Remove(row);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static SavedQueryDto ToDto(SavedQuery q) =>
        new(q.Id, q.Name, JsonSerializer.Deserialize<TaskQueryDto>(q.CriteriaJson, Json)!);

    // Backend-generated string id, mirroring the scheme in BankAccountEndpoints/CategoryEndpoints.
    private static async Task<string> UniqueId(AppDbContext db, string prefix, Func<string, Task<bool>> exists)
    {
        var baseTs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        for (var bump = 0; ; bump++)
        {
            var id = prefix + (baseTs + bump);
            if (!await exists(id)) return id;
        }
    }
}
