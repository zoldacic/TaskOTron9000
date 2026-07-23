namespace TaskOTron.Api.Services;

public record ReportTask(DateOnly? Due, decimal? Amount, string? MainId, IReadOnlyList<string> CatIds);

/// <summary>A main category with the ids of its subs, in display order.</summary>
public record ReportMain(string Id, string Name, IReadOnlyList<string> SubIds);

/// <summary>A sub category, in display order.</summary>
public record ReportSub(string Id, string Name, string MainId);

/// <param name="Parts">Per-category net for this bucket, aligned index-for-index with
/// <see cref="ReportResult.CategoryBreakdown"/> so the frontend can color segments to match.</param>
public record ReportBucket(string Label, decimal Net, IReadOnlyList<decimal> Parts);
public record ReportCategory(string Name, decimal Net);

public record ReportResult(
    decimal MoneyIn,
    decimal MoneyOut,
    decimal Net,
    string Granularity,               // "day" | "week" | "month" — describes Buckets
    IReadOnlyList<ReportBucket> Buckets,      // auto-granularity series for the bar chart
    IReadOnlyList<ReportBucket> DailyBuckets, // always daily; drives the line/balance chart
    IReadOnlyList<ReportCategory> CategoryBreakdown);

/// <summary>
/// Faithful C# port of the report section of the prototype's renderVals
/// (Tasks.dc.html:1013-1064). Returns numbers only; bar sizing/colors stay in the frontend.
/// </summary>
public static class ReportBuilder
{
    public const string Uncategorized = "__none__";
    private static readonly string[] Months =
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    /// <param name="repSel">
    /// Selected ids (may include "__none__"). Null = all. When <paramref name="groupBy"/>
    /// is "main" these are main ids; when "sub" they are sub ids.
    /// </param>
    /// <param name="groupBy">"main" filters/breaks down by main category; "sub" by sub category.</param>
    public static ReportResult Build(
        IEnumerable<ReportTask> tasks,
        DateOnly repStart,
        DateOnly repEnd,
        IReadOnlyCollection<string>? repSel,
        string groupBy,
        IReadOnlyList<ReportMain> mains,
        IReadOnlyList<ReportSub> subs)
    {
        var bySub = groupBy == "sub";
        var universe = bySub ? subs.Select(s => s.Id) : mains.Select(m => m.Id);
        var repSet = repSel is null
            ? new HashSet<string>(universe) { Uncategorized }
            : new HashSet<string>(repSel);

        // A task is included when its selection key matches the chosen set. In "sub"
        // mode the key is any of its subs; in "main" mode its single main. Tasks with
        // no key (no subs / no main) fall under the "__none__" bucket.
        bool Included(ReportTask t) => bySub
            ? (t.CatIds.Count > 0 ? t.CatIds.Any(c => repSet.Contains(c)) : repSet.Contains(Uncategorized))
            : (!string.IsNullOrEmpty(t.MainId) ? repSet.Contains(t.MainId) : repSet.Contains(Uncategorized));

        var repTasks = tasks.Where(t =>
                t.Amount is not null
                && t.Due is DateOnly d && d >= repStart && d <= repEnd
                && Included(t))
            .Select(t => (Due: t.Due!.Value, Amount: t.Amount!.Value, t.MainId, t.CatIds))
            .ToList();

        var moneyIn = repTasks.Where(t => t.Amount > 0).Sum(t => t.Amount);
        var moneyOut = repTasks.Where(t => t.Amount < 0).Sum(t => t.Amount);
        var net = moneyIn + moneyOut;

        // ---- category breakdown: one bar per selected item, following the group-by
        // grain. Each task contributes to exactly one bucket (no double-counting): its
        // single main, or — in "sub" mode — the first of its subs that is selected.
        // Buckets are emitted in category display order.
        // The key that maps a task to its single breakdown bucket, matching the grain.
        string CatKey(string? mainId, IReadOnlyList<string> catIds) => bySub
            ? (catIds.FirstOrDefault(c => repSet.Contains(c)) ?? Uncategorized)
            : (!string.IsNullOrEmpty(mainId) ? mainId! : Uncategorized);

        var catAgg = new List<ReportCategory>();
        var catKeys = new List<string>(); // key parallel to catAgg, used to index bucket parts
        if (bySub)
        {
            var sums = new Dictionary<string, decimal>();
            decimal uncatSum = 0m;
            var anyUncat = false;
            foreach (var t in repTasks)
            {
                var sub = t.CatIds.FirstOrDefault(c => repSet.Contains(c));
                if (sub is null) { uncatSum += t.Amount; anyUncat = true; }
                else sums[sub] = sums.GetValueOrDefault(sub) + t.Amount;
            }
            foreach (var s in subs)
                if (sums.TryGetValue(s.Id, out var v))
                { catAgg.Add(new ReportCategory(s.Name, v)); catKeys.Add(s.Id); }
            if (anyUncat)
            { catAgg.Add(new ReportCategory("Uncategorized", uncatSum)); catKeys.Add(Uncategorized); }
        }
        else
        {
            foreach (var m in mains)
            {
                var items = repTasks.Where(t => t.MainId == m.Id).ToList();
                if (items.Count > 0)
                { catAgg.Add(new ReportCategory(m.Name, items.Sum(t => t.Amount))); catKeys.Add(m.Id); }
            }
            // Defensive: legacy tasks with no main (should not occur post-backfill).
            var uncat = repTasks.Where(t => string.IsNullOrEmpty(t.MainId)).ToList();
            if (uncat.Count > 0)
            { catAgg.Add(new ReportCategory("Uncategorized", uncat.Sum(t => t.Amount))); catKeys.Add(Uncategorized); }
        }

        var catIndex = new Dictionary<string, int>();
        for (var i = 0; i < catKeys.Count; i++) catIndex[catKeys[i]] = i;

        // ---- time buckets ----
        // The bar chart reads Buckets at an auto-selected granularity (coarser buckets
        // stay readable over long ranges); the line/balance chart reads DailyBuckets so
        // it accumulates one point per day rather than interpolating across a week/month.
        // Favour finer auto buckets: weeks cover up to ~18 months, months only beyond that.
        var spanDays = (repEnd.DayNumber - repStart.DayNumber) + 1;
        var gran = spanDays <= 16 ? "day" : spanDays <= 550 ? "week" : "month";

        // Build the time series at a given granularity: each slot carries its net and the
        // per-category parts (aligned to catAgg order) so the chart can color per category.
        List<ReportBucket> BuildBuckets(string g)
        {
            var slots = new List<(string Id, string Label, decimal Net)>();
            if (g == "day")
            {
                for (var i = 0; i < Math.Max(spanDays, 1); i++)
                {
                    var dd = repStart.AddDays(i);
                    slots.Add((Iso(dd), $"{Months[dd.Month - 1]} {dd.Day}", 0m));
                }
            }
            else if (g == "week")
            {
                var n = Math.Max(1, (int)Math.Ceiling(spanDays / 7.0));
                for (var i = 0; i < n; i++)
                {
                    var dd = repStart.AddDays(i * 7);
                    slots.Add(("w" + i, $"{Months[dd.Month - 1]} {dd.Day}", 0m));
                }
            }
            else
            {
                int y = repStart.Year, mo = repStart.Month - 1; // mo is 0-based like the prototype
                while (y < repEnd.Year || (y == repEnd.Year && mo <= repEnd.Month - 1))
                {
                    slots.Add(($"{y}-{mo}", Months[mo], 0m));
                    mo++;
                    if (mo > 11) { mo = 0; y++; }
                }
            }

            var idx = new Dictionary<string, int>();
            for (var i = 0; i < slots.Count; i++) idx[slots[i].Id] = i;

            string BKey(DateOnly dd) => g switch
            {
                "day" => Iso(dd),
                "week" => "w" + ((dd.DayNumber - repStart.DayNumber) / 7),
                _ => $"{dd.Year}-{dd.Month - 1}",
            };

            var parts = new decimal[slots.Count][];
            for (var i = 0; i < slots.Count; i++) parts[i] = new decimal[catAgg.Count];

            foreach (var t in repTasks)
            {
                if (idx.TryGetValue(BKey(t.Due), out var bi))
                {
                    slots[bi] = slots[bi] with { Net = slots[bi].Net + t.Amount };
                    parts[bi][catIndex[CatKey(t.MainId, t.CatIds)]] += t.Amount;
                }
            }

            return slots.Select((b, i) => new ReportBucket(b.Label, b.Net, parts[i])).ToList();
        }

        var bucketOut = BuildBuckets(gran);
        var dailyOut = gran == "day" ? bucketOut : BuildBuckets("day");
        return new ReportResult(moneyIn, moneyOut, net, gran, bucketOut, dailyOut, catAgg);
    }

    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
}
