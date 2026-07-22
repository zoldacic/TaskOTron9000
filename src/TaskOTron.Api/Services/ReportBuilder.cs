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
    string Granularity,               // "day" | "week" | "month"
    IReadOnlyList<ReportBucket> Buckets,
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

        // ---- time buckets with auto-granularity ----
        var spanDays = (repEnd.DayNumber - repStart.DayNumber) + 1;
        var gran = spanDays <= 16 ? "day" : spanDays <= 95 ? "week" : "month";

        var buckets = new List<(string Id, string Label, decimal Net)>();
        if (gran == "day")
        {
            for (var i = 0; i < Math.Max(spanDays, 1); i++)
            {
                var dd = repStart.AddDays(i);
                buckets.Add((Iso(dd), dd.Day.ToString(), 0m));
            }
        }
        else if (gran == "week")
        {
            var n = Math.Max(1, (int)Math.Ceiling(spanDays / 7.0));
            for (var i = 0; i < n; i++)
            {
                var dd = repStart.AddDays(i * 7);
                buckets.Add(("w" + i, $"{Months[dd.Month - 1]} {dd.Day}", 0m));
            }
        }
        else
        {
            int y = repStart.Year, mo = repStart.Month - 1; // mo is 0-based like the prototype
            while (y < repEnd.Year || (y == repEnd.Year && mo <= repEnd.Month - 1))
            {
                buckets.Add(($"{y}-{mo}", Months[mo], 0m));
                mo++;
                if (mo > 11) { mo = 0; y++; }
            }
        }

        var index = new Dictionary<string, int>();
        for (var i = 0; i < buckets.Count; i++) index[buckets[i].Id] = i;

        string BKey(DateOnly dd) => gran switch
        {
            "day" => Iso(dd),
            "week" => "w" + ((dd.DayNumber - repStart.DayNumber) / 7),
            _ => $"{dd.Year}-{dd.Month - 1}",
        };

        // parts[bucket][category] — per-category net within each time bucket, so the
        // time chart can stack a colored segment per category aligned to catAgg order.
        var parts = new decimal[buckets.Count][];
        for (var i = 0; i < buckets.Count; i++) parts[i] = new decimal[catAgg.Count];

        foreach (var t in repTasks)
        {
            var k = BKey(t.Due);
            if (index.TryGetValue(k, out var idx))
            {
                buckets[idx] = buckets[idx] with { Net = buckets[idx].Net + t.Amount };
                parts[idx][catIndex[CatKey(t.MainId, t.CatIds)]] += t.Amount;
            }
        }

        var bucketOut = buckets.Select((b, i) => new ReportBucket(b.Label, b.Net, parts[i])).ToList();
        return new ReportResult(moneyIn, moneyOut, net, gran, bucketOut, catAgg);
    }

    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
}
