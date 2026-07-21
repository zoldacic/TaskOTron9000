using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

public static class TitleDefaultEndpoints
{
    public static void MapTitleDefaultEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/title-defaults");

        g.MapGet("", async (AppDbContext db) =>
        {
            var defs = await db.TitleDefaults.Include(td => td.Categories).AsNoTracking().ToListAsync();
            return Results.Ok(defs.Select(td =>
                new TitleDefaultDto(td.NormalizedTitle, td.Categories.Select(c => c.Id).OrderBy(x => x).ToList(), td.MainId)));
        });

        // Upsert the remembered main + subcategories for a title (matches the import "Remember as default" flag).
        g.MapPut("/{title}", async (string title, TitleDefaultWriteDto dto, AppDbContext db) =>
        {
            if (!string.IsNullOrEmpty(dto.MainId) && !await db.Mains.AnyAsync(m => m.Id == dto.MainId))
                return Results.BadRequest($"Unknown main category '{dto.MainId}'.");

            var norm = title.Trim().ToLowerInvariant();
            var td = await db.TitleDefaults.Include(x => x.Categories)
                .FirstOrDefaultAsync(x => x.NormalizedTitle == norm);
            if (td is null)
            {
                td = new TitleDefault { NormalizedTitle = norm };
                db.TitleDefaults.Add(td);
            }
            td.MainId = string.IsNullOrEmpty(dto.MainId) ? null : dto.MainId;
            td.Categories.Clear();
            if (dto.CatIds is { Count: > 0 })
                foreach (var s in await db.Subs.Where(s => dto.CatIds.Contains(s.Id)).ToListAsync())
                    td.Categories.Add(s);
            await db.SaveChangesAsync();
            return Results.Ok(new TitleDefaultDto(td.NormalizedTitle, td.Categories.Select(c => c.Id).OrderBy(x => x).ToList(), td.MainId));
        });

        g.MapDelete("/{title}", async (string title, AppDbContext db) =>
        {
            var norm = title.Trim().ToLowerInvariant();
            var td = await db.TitleDefaults.FirstOrDefaultAsync(x => x.NormalizedTitle == norm);
            // Idempotent: deleting an absent default is a no-op, not a 404. Callers clear
            // a remembered default unconditionally, so this is the common (empty) case.
            if (td is null) return Results.NoContent();
            db.TitleDefaults.Remove(td);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
