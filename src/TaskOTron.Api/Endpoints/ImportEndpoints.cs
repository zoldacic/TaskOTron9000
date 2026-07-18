using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;
using TaskOTron.Api.Services;

namespace TaskOTron.Api.Endpoints;

public static class ImportEndpoints
{
    public static void MapImportEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/import");

        // Parse pasted text into preview rows, pre-filling categories from remembered title defaults.
        g.MapPost("/parse", async (ImportParseRequest req, AppDbContext db) =>
        {
            var defaults = await LoadTitleDefaults(db);
            var rows = ImportParser.Parse(req.Text, defaults);
            return Results.Ok(rows.Select(r =>
                new ImportRowDto(r.Key, r.Title, r.Date, r.Amount, r.Ok, r.CatIds)));
        });

        // Commit confirmed rows: each importable (amount != null) row becomes a Transaction task.
        g.MapPost("/commit", async (ImportCommitRequest req, AppDbContext db) =>
        {
            var rows = (req.Rows ?? []).Where(r => r.Amount is not null).ToList();
            if (rows.Count == 0) return Results.BadRequest("No importable rows (each needs a detected amount).");

            // Resolve all referenced sub ids up front.
            var wantedIds = rows.SelectMany(r => r.CatIds ?? []).Distinct().ToList();
            var subs = await db.Subs.Where(s => wantedIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

            var created = new List<Todo>();
            foreach (var r in rows)
            {
                var t = new Todo
                {
                    Title = r.Title,
                    Done = false,
                    Due = Mapping.ParseDate(r.Date),
                    Amount = r.Amount,
                    DateKind = DateKind.Transaction,
                    Categories = (r.CatIds ?? [])
                        .Where(subs.ContainsKey)
                        .Select(id => subs[id])
                        .ToList(),
                };
                db.Todos.Add(t);
                created.Add(t);
            }
            await db.SaveChangesAsync();
            return Results.Ok(created.Select(t => t.ToDto()));
        });
    }

    private static async Task<Dictionary<string, List<string>>> LoadTitleDefaults(AppDbContext db)
    {
        var defs = await db.TitleDefaults.Include(td => td.Categories).AsNoTracking().ToListAsync();
        return defs.ToDictionary(td => td.NormalizedTitle, td => td.Categories.Select(c => c.Id).ToList());
    }
}
