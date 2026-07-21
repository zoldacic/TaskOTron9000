using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/categories", async (AppDbContext db) =>
        {
            var mains = await db.Mains.OrderBy(m => m.Name).AsNoTracking()
                .Select(m => new MainDto(m.Id, m.Name)).ToListAsync();
            var subs = await db.Subs.AsNoTracking()
                .Select(s => new SubDto(s.Id, s.MainId, s.Name, s.Todos.Count)).ToListAsync();
            return Results.Ok(new CategoriesDto(mains, subs));
        });

        // ---- mains ----
        var mainG = app.MapGroup("/api/mains");

        mainG.MapPost("", async (MainWriteDto dto, AppDbContext db) =>
        {
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            var id = await UniqueId(db, "m", async gid => await db.Mains.AnyAsync(m => m.Id == gid));
            var m = new Main { Id = id, Name = name };
            db.Mains.Add(m);
            await db.SaveChangesAsync();
            return Results.Created($"/api/mains/{m.Id}", new MainDto(m.Id, m.Name));
        });

        mainG.MapPut("/{id}", async (string id, CategoryRenameDto dto, AppDbContext db) =>
        {
            var m = await db.Mains.FindAsync(id);
            if (m is null) return Results.NotFound();
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            m.Name = name;
            await db.SaveChangesAsync();
            return Results.Ok(new MainDto(m.Id, m.Name));
        });

        // Deleting a main cascades to its subs and strips those subs from tasks + title defaults.
        // Blocked (409) if the main is still the required category of any task.
        mainG.MapDelete("/{id}", async (string id, AppDbContext db) =>
        {
            var m = await db.Mains.FindAsync(id);
            if (m is null) return Results.NotFound();
            if (await db.Todos.AnyAsync(t => t.MainId == id))
                return Results.Conflict("This category is the main category of existing tasks.");
            db.Mains.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- subs ----
        var subG = app.MapGroup("/api/subs");

        subG.MapPost("", async (SubWriteDto dto, AppDbContext db) =>
        {
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            if (!await db.Mains.AnyAsync(m => m.Id == dto.MainId))
                return Results.BadRequest($"Unknown main category '{dto.MainId}'.");
            var id = await UniqueId(db, "s", async gid => await db.Subs.AnyAsync(s => s.Id == gid));
            var s = new Sub { Id = id, MainId = dto.MainId, Name = name };
            db.Subs.Add(s);
            await db.SaveChangesAsync();
            return Results.Created($"/api/subs/{s.Id}", new SubDto(s.Id, s.MainId, s.Name, 0));
        });

        subG.MapPut("/{id}", async (string id, CategoryRenameDto dto, AppDbContext db) =>
        {
            var s = await db.Subs.FindAsync(id);
            if (s is null) return Results.NotFound();
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            s.Name = name;
            await db.SaveChangesAsync();
            return Results.Ok(new SubDto(s.Id, s.MainId, s.Name, await db.Todos.CountAsync(t => t.Categories.Any(c => c.Id == id))));
        });

        // Deleting a sub strips it from tasks and title defaults (join rows cascade).
        subG.MapDelete("/{id}", async (string id, AppDbContext db) =>
        {
            var s = await db.Subs.FindAsync(id);
            if (s is null) return Results.NotFound();
            db.Subs.Remove(s);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    // Backend-generated string id, mirroring the prototype's 'm'/'s' + timestamp scheme,
    // with a collision guard for the single-user single-process case.
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
