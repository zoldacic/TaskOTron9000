using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class ReportBuilderTests
{
    // Mirrors the seed category structure and the amount-bearing seed todos.
    private static readonly List<ReportMain> Mains =
    [
        new("work", "Work", ["wr", "wm", "we", "wp"]),
        new("home", "Home", ["he", "hc", "hr"]),
        new("personal", "Personal", ["ph", "pf", "pl"]),
    ];
    private static readonly List<string> AllSubIds =
        ["wr", "wm", "we", "wp", "he", "hc", "hr", "ph", "pf", "pl"];
    // Sub display order mirrors the mains' sub order; names = ids here (breakdown-by-sub
    // tests only assert on ids/totals, so a name-as-id stand-in is sufficient).
    private static readonly List<ReportSub> Subs =
        Mains.SelectMany(m => m.SubIds.Select(s => new ReportSub(s, s, m.Id))).ToList();

    // main = each task's required category (matches the DbInitializer seed);
    // cats = its subs (may span other mains).
    private static ReportTask T(string due, decimal amount, string main, params string[] cats) =>
        new(DateOnly.Parse(due), amount, main, cats.ToList());

    private static List<ReportTask> SeedTasks() =>
    [
        T("2026-07-22", -120m, "personal", "ph"),
        T("2026-07-20", -84.5m, "personal", "pf"),
        T("2026-07-17", -76.2m, "home", "he"),
        new(null, -45m, "home", ["hr"]),           // no due → excluded
        T("2026-07-31", -18.99m, "personal", "pl"),
        T("2026-08-03", -320m, "personal", "pf"),  // out of July range
        T("2026-07-01", 4200m, "personal", "pf"),
        T("2026-07-09", 650m, "personal", "pf", "wr"),
        T("2026-07-11", 32.4m, "home", "he"),
        T("2026-07-05", -15.99m, "personal", "pl"),
        T("2026-07-08", -52.4m, "home", "he"),
        T("2026-07-03", -39m, "personal", "ph"),
    ];

    [Fact]
    public void July_all_categories_totals_match_prototype()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: null, groupBy: "main", Mains, Subs);

        Assert.Equal(4882.4m, r.MoneyIn);
        Assert.Equal(-407.08m, r.MoneyOut);
        Assert.Equal(4475.32m, r.Net);
        Assert.Equal("week", r.Granularity);       // 31-day span → weekly
        Assert.Equal(5, r.Buckets.Count);          // ceil(31/7)
    }

    [Fact]
    public void Selecting_only_finance_filters_tasks()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: ["pf"], groupBy: "sub", Mains, Subs);

        // Salary +4200, Freelance +650 (has pf), Pay electricity -84.5.
        Assert.Equal(4850m, r.MoneyIn);
        Assert.Equal(-84.5m, r.MoneyOut);
        Assert.Equal(4765.5m, r.Net);
    }

    [Fact]
    public void Selecting_only_uncategorized_yields_nothing_for_seed()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: [ReportBuilder.Uncategorized], groupBy: "sub", Mains, Subs);

        Assert.Equal(0m, r.MoneyIn);
        Assert.Equal(0m, r.MoneyOut);
        Assert.Empty(r.CategoryBreakdown);
    }

    [Theory]
    [InlineData("2026-01-01", "2026-01-16", "day")]   // span 16
    [InlineData("2026-01-01", "2026-01-17", "week")]  // span 17
    [InlineData("2026-01-01", "2026-12-31", "week")]  // a full year → weekly, not monthly
    [InlineData("2026-01-01", "2027-07-04", "week")]  // span 550
    [InlineData("2026-01-01", "2027-07-05", "month")] // span 551
    public void Granularity_boundaries(string from, string to, string expected)
    {
        var r = ReportBuilder.Build(SeedTasks(),
            DateOnly.Parse(from), DateOnly.Parse(to), repSel: null, groupBy: "main", Mains, Subs);
        Assert.Equal(expected, r.Granularity);
    }

    [Fact]
    public void Category_breakdown_aggregates_by_main()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: null, groupBy: "main", Mains, Subs);

        var personal = r.CategoryBreakdown.Single(c => c.Name == "Personal");
        // All in-range tasks whose main is "personal" (the freelance +650 counts here
        // only, not under Work, even though it carries a "wr" sub).
        Assert.Equal(4200m + 650m - 84.5m - 18.99m - 15.99m - 120m - 39m, personal.Net);

        // Work has no amount-bearing July task as its main → no breakdown row.
        Assert.DoesNotContain(r.CategoryBreakdown, c => c.Name == "Work");
    }

    [Fact]
    public void Sub_breakdown_emits_one_row_per_selected_sub()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: ["pf", "pl"], groupBy: "sub", Mains, Subs);

        // pf: salary +4200, freelance +650 (first selected sub of {pf,wr} is pf), electricity -84.5.
        // pl: two small buys. Each task counts once, so pf and pl are distinct bars.
        Assert.Equal(2, r.CategoryBreakdown.Count);
        Assert.Equal(4200m + 650m - 84.5m, r.CategoryBreakdown.Single(c => c.Name == "pf").Net);
        Assert.Equal(-15.99m - 18.99m, r.CategoryBreakdown.Single(c => c.Name == "pl").Net);
        // Emitted in sub display order: pf before pl.
        Assert.Equal("pf", r.CategoryBreakdown[0].Name);
    }
}
