using System.Globalization;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Services;

namespace TaskOTron.Api.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /api/report?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=main|sub&categories=personal,home,__none__
        // `groupBy` chooses the selection/breakdown grain (default "main"); `categories`
        // then carries main ids ("main") or sub ids ("sub"). Omitting `categories` selects
        // all (repSel = null); an empty value selects none.
        app.MapGet("/api/report", async (HttpContext ctx, AppDbContext db, string? from, string? to) =>
        {
            var repStart = ParseOr(from, new DateOnly(2026, 7, 1));
            var repEnd = ParseOr(to, new DateOnly(2026, 7, 31));
            var groupBy = ctx.Request.Query.TryGetValue("groupBy", out var g) && g.ToString() == "sub"
                ? "sub" : "main";

            IReadOnlyCollection<string>? repSel = null;
            if (ctx.Request.Query.TryGetValue("categories", out var raw))
            {
                repSel = raw.ToString()
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }

            // Insertion order (no OrderBy) mirrors the prototype's mains array order.
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

            var r = ReportBuilder.Build(tasks, repStart, repEnd, repSel, groupBy, reportMains, reportSubs);

            return Results.Ok(new ReportDto(
                r.MoneyIn, r.MoneyOut, r.Net, r.Granularity,
                r.Buckets.Select(b => new BucketDto(b.Label, b.Net, b.Parts.ToList())).ToList(),
                r.DailyBuckets.Select(b => new BucketDto(b.Label, b.Net, b.Parts.ToList())).ToList(),
                r.CategoryBreakdown.Select(c => new CategoryNetDto(c.Name, c.Net)).ToList()));
        });
    }

    private static DateOnly ParseOr(string? iso, DateOnly fallback) =>
        DateOnly.TryParseExact(iso, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : fallback;
}
