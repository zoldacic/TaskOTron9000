namespace TaskOTron.Api.Services;

public record ReportTask(DateOnly? Due, decimal? Amount, IReadOnlyList<string> CatIds);

/// <summary>A main category with the ids of its subs, in display order.</summary>
public record ReportMain(string Name, IReadOnlyList<string> SubIds);

public record ReportBucket(string Label, decimal Net);
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

    /// <param name="repSel">Selected sub ids (may include "__none__"). Null = all categories.</param>
    public static ReportResult Build(
        IEnumerable<ReportTask> tasks,
        DateOnly repStart,
        DateOnly repEnd,
        IReadOnlyCollection<string>? repSel,
        IReadOnlyList<ReportMain> mains,
        IReadOnlyList<string> allSubIds)
    {
        var repSet = repSel is null
            ? new HashSet<string>(allSubIds) { Uncategorized }
            : new HashSet<string>(repSel);

        var repTasks = tasks.Where(t =>
                t.Amount is not null
                && t.Due is DateOnly d && d >= repStart && d <= repEnd
                && (t.CatIds.Count > 0
                    ? t.CatIds.Any(c => repSet.Contains(c))
                    : repSet.Contains(Uncategorized)))
            .Select(t => (Due: t.Due!.Value, Amount: t.Amount!.Value, t.CatIds))
            .ToList();

        var moneyIn = repTasks.Where(t => t.Amount > 0).Sum(t => t.Amount);
        var moneyOut = repTasks.Where(t => t.Amount < 0).Sum(t => t.Amount);
        var net = moneyIn + moneyOut;

        // ---- category breakdown: per main (+ Uncategorized) ----
        var catAgg = new List<ReportCategory>();
        foreach (var m in mains)
        {
            var subIds = new HashSet<string>(m.SubIds);
            var items = repTasks.Where(t => t.CatIds.Any(c => subIds.Contains(c))).ToList();
            if (items.Count > 0)
                catAgg.Add(new ReportCategory(m.Name, items.Sum(t => t.Amount)));
        }
        var uncat = repTasks.Where(t => t.CatIds.Count == 0).ToList();
        if (uncat.Count > 0)
            catAgg.Add(new ReportCategory("Uncategorized", uncat.Sum(t => t.Amount)));

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

        foreach (var t in repTasks)
        {
            var k = BKey(t.Due);
            if (index.TryGetValue(k, out var idx))
                buckets[idx] = buckets[idx] with { Net = buckets[idx].Net + t.Amount };
        }

        var bucketOut = buckets.Select(b => new ReportBucket(b.Label, b.Net)).ToList();
        return new ReportResult(moneyIn, moneyOut, net, gran, bucketOut, catAgg);
    }

    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd");
}
