using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class ReportBuilderTests
{
    // Mirrors the seed category structure and the amount-bearing seed todos.
    private static readonly List<ReportMain> Mains =
    [
        new("Work", ["wr", "wm", "we", "wp"]),
        new("Home", ["he", "hc", "hr"]),
        new("Personal", ["ph", "pf", "pl"]),
    ];
    private static readonly List<string> AllSubIds =
        ["wr", "wm", "we", "wp", "he", "hc", "hr", "ph", "pf", "pl"];

    private static ReportTask T(string due, decimal amount, params string[] cats) =>
        new(DateOnly.Parse(due), amount, cats.ToList());

    private static List<ReportTask> SeedTasks() =>
    [
        T("2026-07-22", -120m, "ph"),
        T("2026-07-20", -84.5m, "pf"),
        T("2026-07-17", -76.2m, "he"),
        new(null, -45m, ["hr"]),                 // no due → excluded
        T("2026-07-31", -18.99m, "pl"),
        T("2026-08-03", -320m, "pf"),            // out of July range
        T("2026-07-01", 4200m, "pf"),
        T("2026-07-09", 650m, "pf", "wr"),
        T("2026-07-11", 32.4m, "he"),
        T("2026-07-05", -15.99m, "pl"),
        T("2026-07-08", -52.4m, "he"),
        T("2026-07-03", -39m, "ph"),
    ];

    [Fact]
    public void July_all_categories_totals_match_prototype()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: null, Mains, AllSubIds);

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
            repSel: ["pf"], Mains, AllSubIds);

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
            repSel: [ReportBuilder.Uncategorized], Mains, AllSubIds);

        Assert.Equal(0m, r.MoneyIn);
        Assert.Equal(0m, r.MoneyOut);
        Assert.Empty(r.CategoryBreakdown);
    }

    [Theory]
    [InlineData("2026-01-01", "2026-01-16", "day")]   // span 16
    [InlineData("2026-01-01", "2026-01-17", "week")]  // span 17
    [InlineData("2026-01-01", "2026-04-05", "week")]  // span 95
    [InlineData("2026-01-01", "2026-04-06", "month")] // span 96
    public void Granularity_boundaries(string from, string to, string expected)
    {
        var r = ReportBuilder.Build(SeedTasks(),
            DateOnly.Parse(from), DateOnly.Parse(to), repSel: null, Mains, AllSubIds);
        Assert.Equal(expected, r.Granularity);
    }

    [Fact]
    public void Category_breakdown_aggregates_by_main()
    {
        var r = ReportBuilder.Build(SeedTasks(),
            new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31),
            repSel: null, Mains, AllSubIds);

        var personal = r.CategoryBreakdown.Single(c => c.Name == "Personal");
        // pf: -84.5 + 4200 + 650(also wr) ; pl: -18.99 -15.99 ; ph: -120 -39
        Assert.Equal(4200m + 650m - 84.5m - 18.99m - 15.99m - 120m - 39m, personal.Net);
    }
}
