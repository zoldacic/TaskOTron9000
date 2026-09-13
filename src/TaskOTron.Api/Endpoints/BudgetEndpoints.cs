using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;
using TaskOTron.Api.Services;

namespace TaskOTron.Api.Endpoints;

public static class BudgetEndpoints
{
    public static void MapBudgetEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/budgets");

        // Newest plan first. PlannedTotal is the signed sum of the items.
        g.MapGet("", async (AppDbContext db) =>
        {
            var budgets = await db.Budgets.OrderByDescending(b => b.From).ThenBy(b => b.Name)
                .AsNoTracking()
                .Select(b => new BudgetSummaryDto(
                    b.Id, b.Name,
                    b.From.ToString("yyyy-MM-dd"), b.To.ToString("yyyy-MM-dd"),
                    b.Items.Count,
                    b.Items.Sum(i => (decimal?)i.Amount) ?? 0m))
                .ToListAsync();
            return Results.Ok(budgets);
        });

        g.MapGet("/{id}", async (string id, AppDbContext db) =>
        {
            var b = await db.Budgets
                .Include(x => x.Items).ThenInclude(i => i.Categories)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);
            return b is null ? Results.NotFound() : Results.Ok(b.ToDto());
        });

        g.MapPost("", async (BudgetWriteDto dto, AppDbContext db) =>
        {
            if (Validate(dto, out var name, out var from, out var to) is string err)
                return Results.BadRequest(err);
            // Names are not unique: two plans may legitimately share one (different ranges).
            var id = await UniqueId(db, "bg", async gid => await db.Budgets.AnyAsync(b => b.Id == gid));
            var b = new Budget { Id = id, Name = name, From = from, To = to };
            db.Budgets.Add(b);
            await db.SaveChangesAsync();
            return Results.Created($"/api/budgets/{b.Id}", b.ToDto());
        });

        g.MapPut("/{id}", async (string id, BudgetWriteDto dto, AppDbContext db) =>
        {
            var b = await db.Budgets.Include(x => x.Items).ThenInclude(i => i.Categories)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (b is null) return Results.NotFound();
            if (Validate(dto, out var name, out var from, out var to) is string err)
                return Results.BadRequest(err);

            b.Name = name;
            b.From = from;
            b.To = to;
            await db.SaveChangesAsync();
            return Results.Ok(b.ToDto());
        });

        // Deleting a budget takes its items with it (cascade); nothing else references them.
        g.MapDelete("/{id}", async (string id, AppDbContext db) =>
        {
            var b = await db.Budgets.FindAsync(id);
            if (b is null) return Results.NotFound();
            db.Budgets.Remove(b);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- items ----

        g.MapPost("/{id}/items", async (string id, BudgetItemWriteDto dto, AppDbContext db) =>
        {
            if (!await db.Budgets.AnyAsync(b => b.Id == id)) return Results.NotFound();
            if (await ValidateItem(db, dto) is string err) return Results.BadRequest(err);

            var maxOrder = await db.BudgetItems.Where(i => i.BudgetId == id)
                .MaxAsync(i => (int?)i.SortOrder) ?? -1;
            var item = new BudgetItem
            {
                BudgetId = id,
                Title = dto.Title.Trim(),
                Amount = ResolveAmount(dto),
                Quantity = dto.Quantity,
                UnitPrice = dto.UnitPrice,
                MainId = string.IsNullOrEmpty(dto.MainId) ? null : dto.MainId,
                Note = NormalizeNote(dto.Note),
                Categories = await LoadSubs(db, dto.CatIds),
                SortOrder = maxOrder + 1,
            };
            db.BudgetItems.Add(item);
            await db.SaveChangesAsync();
            return Results.Created($"/api/budgets/{id}/items/{item.Id}", item.ToDto());
        });

        g.MapPut("/{id}/items/{itemId:int}", async (string id, int itemId, BudgetItemWriteDto dto, AppDbContext db) =>
        {
            var item = await db.BudgetItems.Include(i => i.Categories)
                .FirstOrDefaultAsync(i => i.Id == itemId && i.BudgetId == id);
            if (item is null) return Results.NotFound();
            if (await ValidateItem(db, dto) is string err) return Results.BadRequest(err);

            item.Title = dto.Title.Trim();
            item.Amount = ResolveAmount(dto);
            item.Quantity = dto.Quantity;
            item.UnitPrice = dto.UnitPrice;
            item.MainId = string.IsNullOrEmpty(dto.MainId) ? null : dto.MainId;
            item.Note = NormalizeNote(dto.Note);
            item.Categories.Clear();
            foreach (var s in await LoadSubs(db, dto.CatIds)) item.Categories.Add(s);

            await db.SaveChangesAsync();
            return Results.Ok(item.ToDto());
        });

        g.MapDelete("/{id}/items/{itemId:int}", async (string id, int itemId, AppDbContext db) =>
        {
            var item = await db.BudgetItems.FirstOrDefaultAsync(i => i.Id == itemId && i.BudgetId == id);
            if (item is null) return Results.NotFound();
            db.BudgetItems.Remove(item);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- planned vs actual ----
        // GET /api/budgets/{id}/comparison?groupBy=main|sub
        // The actual side comes from ReportBuilder over the budget's range with every category
        // selected — the same numbers the spending report shows, read here and never written.
        g.MapGet("/{id}/comparison", async (HttpContext ctx, string id, AppDbContext db) =>
        {
            var budget = await db.Budgets
                .Include(b => b.Items).ThenInclude(i => i.Categories)
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == id);
            if (budget is null) return Results.NotFound();

            var groupBy = ctx.Request.Query.TryGetValue("groupBy", out var gb) && gb.ToString() == "sub"
                ? "sub" : "main";

            // Insertion order (no OrderBy) mirrors the report endpoint's category ordering.
            var mains = await db.Mains.AsNoTracking().ToListAsync();
            var subs = await db.Subs.AsNoTracking().ToListAsync();
            var todos = await db.Todos.Include(t => t.Categories).AsNoTracking().ToListAsync();

            var reportMains = mains
                .Select(m => new ReportMain(m.Id, m.Name, subs.Where(s => s.MainId == m.Id).Select(s => s.Id).ToList()))
                .ToList();
            var reportSubs = subs.Select(s => new ReportSub(s.Id, s.Name, s.MainId)).ToList();
            var tasks = todos
                .Select(t => new ReportTask(t.Due, t.Amount, t.MainId, t.Categories.Select(c => c.Id).ToList()))
                .ToList();

            var actuals = ReportBuilder.Build(
                tasks, budget.From, budget.To, repSel: null, groupBy, reportMains, reportSubs);

            var planned = budget.Items
                .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
                .Select(i => new PlannedItem(i.Amount, i.MainId, i.Categories.Select(c => c.Id).ToList()))
                .ToList();

            var r = BudgetComparison.Build(planned, actuals, groupBy, reportMains, reportSubs);

            return Results.Ok(new BudgetCompareDto(
                groupBy, r.Planned, r.Actual, r.Diff,
                r.Rows.Select(x => new BudgetCompareRowDto(x.Id, x.Name, x.Planned, x.Actual, x.Diff)).ToList()));
        });
    }

    /// <summary>Name + range checks shared by create and update. Returns an error, or null when valid.</summary>
    private static string? Validate(BudgetWriteDto dto, out string name, out DateOnly from, out DateOnly to)
    {
        name = dto.Name?.Trim() ?? "";
        from = default;
        to = default;
        if (string.IsNullOrEmpty(name)) return "Name is required.";
        var f = Mapping.ParseDate(dto.From);
        var t = Mapping.ParseDate(dto.To);
        if (f is null || t is null) return "A from and to date are required.";
        if (f > t) return "The from date must not be after the to date.";
        from = f.Value;
        to = t.Value;
        return null;
    }

    private static async Task<string?> ValidateItem(AppDbContext db, BudgetItemWriteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) return "Title is required.";
        if (!HasPricing(dto) && dto.Amount is null)
            return "An amount, or a quantity and unit price, is required.";
        if (!string.IsNullOrEmpty(dto.MainId) && !await db.Mains.AnyAsync(m => m.Id == dto.MainId))
            return $"Unknown main category '{dto.MainId}'.";
        if (dto.CatIds is { Count: > 0 })
        {
            var known = await db.Subs.Where(s => dto.CatIds.Contains(s.Id)).Select(s => s.Id).ToListAsync();
            var unknown = dto.CatIds.Except(known).ToList();
            if (unknown.Count > 0) return $"Unknown sub category '{unknown[0]}'.";
        }
        return null;
    }

    private static bool HasPricing(BudgetItemWriteDto dto) => dto.Quantity is not null && dto.UnitPrice is not null;

    /// <summary>Quantity x unit price wins when both are given, so the stored amount can never
    /// drift from the pricing that produced it; otherwise the posted amount is used.</summary>
    private static decimal ResolveAmount(BudgetItemWriteDto dto) =>
        HasPricing(dto)
            ? Math.Round(dto.Quantity!.Value * dto.UnitPrice!.Value, 2, MidpointRounding.AwayFromZero)
            : dto.Amount!.Value;

    /// <summary>Trim a note; blank/whitespace becomes null ("no note"), as on tasks.</summary>
    private static string? NormalizeNote(string? note)
    {
        var trimmed = note?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static async Task<List<Sub>> LoadSubs(AppDbContext db, List<string>? ids)
    {
        if (ids is null || ids.Count == 0) return [];
        return await db.Subs.Where(s => ids.Contains(s.Id)).ToListAsync();
    }

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
