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
                new ImportRowDto(r.Key, r.Title, r.Date, r.Amount, r.Ok, r.CatIds, r.MainId)));
        });

        // Commit confirmed rows: each importable (amount != null) row becomes a Transaction task.
        g.MapPost("/commit", async (ImportCommitRequest req, AppDbContext db) =>
        {
            var rows = (req.Rows ?? []).Where(r => r.Amount is not null).ToList();
            if (rows.Count == 0) return Results.BadRequest("No importable rows (each needs a detected amount).");

            // Every imported task needs a main category. Validate the ones referenced.
            var wantedMains = rows.Select(r => r.MainId)
                .Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
            if (rows.Any(r => string.IsNullOrEmpty(r.MainId)))
                return Results.BadRequest("A main category is required for imported tasks.");
            var knownMains = await db.Mains.Where(m => wantedMains.Contains(m.Id))
                .Select(m => m.Id).ToListAsync();
            var missingMain = wantedMains.Except(knownMains).ToList();
            if (missingMain.Count > 0)
                return Results.BadRequest($"Unknown main category '{missingMain[0]}'.");

            // Resolve all referenced sub ids up front.
            var wantedIds = rows.SelectMany(r => r.CatIds ?? []).Distinct().ToList();
            var subs = await db.Subs.Where(s => wantedIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

            // Validate any referenced bank accounts.
            var wantedAccounts = rows.Select(r => r.BankAccountId)
                .Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
            if (wantedAccounts.Count > 0)
            {
                var known = await db.BankAccounts.Where(a => wantedAccounts.Contains(a.Id))
                    .Select(a => a.Id).ToListAsync();
                var missing = wantedAccounts.Except(known).ToList();
                if (missing.Count > 0)
                    return Results.BadRequest($"Unknown bank account '{missing[0]}'.");
            }

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
                    MainId = r.MainId!,
                    BankAccountId = string.IsNullOrEmpty(r.BankAccountId) ? null : r.BankAccountId,
                    Note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim(),
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

    private static async Task<Dictionary<string, TitleDefaultEntry>> LoadTitleDefaults(AppDbContext db)
    {
        var defs = await db.TitleDefaults.Include(td => td.Categories).AsNoTracking().ToListAsync();
        return defs.ToDictionary(
            td => td.NormalizedTitle,
            td => new TitleDefaultEntry(td.MainId, td.Categories.Select(c => c.Id).ToList()));
    }
}
