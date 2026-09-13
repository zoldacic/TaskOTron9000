using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class BudgetComparisonTests
{
    // Same category shape as ReportBuilderTests, trimmed to what these assertions need.
    private static readonly List<ReportMain> Mains =
    [
        new("work", "Work", ["wr", "wm"]),
        new("home", "Home", ["he", "hc"]),
        new("personal", "Personal", ["ph", "pf"]),
    ];
    private static readonly List<ReportSub> Subs =
        Mains.SelectMany(m => m.SubIds.Select(s => new ReportSub(s, s, m.Id))).ToList();

    private static readonly DateOnly From = new(2026, 9, 1);
    private static readonly DateOnly To = new(2026, 9, 30);

    private static ReportTask T(string due, decimal amount, string main, params string[] cats) =>
        new(DateOnly.Parse(due), amount, main, cats.ToList());

    private static PlannedItem P(decimal amount, string? main, params string[] cats) =>
        new(amount, main, cats.ToList());

    /// <summary>Runs the comparison the way the endpoint does: actuals straight from ReportBuilder.</summary>
    private static CompareResult Run(IEnumerable<PlannedItem> planned, IEnumerable<ReportTask> tasks, string groupBy)
    {
        var actuals = ReportBuilder.Build(tasks, From, To, repSel: null, groupBy, Mains, Subs);
        return BudgetComparison.Build(planned, actuals, groupBy, Mains, Subs);
    }

    private static CompareRow Row(CompareResult r, string id) => r.Rows.Single(x => x.Id == id);

    [Fact]
    public void Planned_and_actual_are_matched_per_main()
    {
        var r = Run(
            [P(-4000m, "home"), P(-2000m, "personal")],
            [T("2026-09-05", -4380m, "home"), T("2026-09-08", -1150m, "personal")],
            "main");

        var home = Row(r, "home");
        Assert.Equal(-4000m, home.Planned);
        Assert.Equal(-4380m, home.Actual);
        Assert.Equal(-380m, home.Diff);            // over the plan → negative

        var personal = Row(r, "personal");
        Assert.Equal(-2000m, personal.Planned);
        Assert.Equal(-1150m, personal.Actual);
        Assert.Equal(850m, personal.Diff);         // under the plan → positive

        Assert.Equal(-6000m, r.Planned);
        Assert.Equal(-5530m, r.Actual);
        Assert.Equal(470m, r.Diff);
    }

    [Fact]
    public void Items_in_the_same_category_are_summed_into_one_row()
    {
        var r = Run([P(-1200m, "home"), P(-800m, "home")], [], "main");

        var home = Row(r, "home");
        Assert.Equal(-2000m, home.Planned);
        Assert.Equal(0m, home.Actual);
        Assert.Equal(2000m, home.Diff);
    }

    [Fact]
    public void A_planned_category_with_no_spending_still_gets_a_row()
    {
        var r = Run([P(-500m, "work")], [], "main");

        var work = Row(r, "work");
        Assert.Equal(-500m, work.Planned);
        Assert.Equal(0m, work.Actual);
        Assert.Equal(500m, work.Diff);
    }

    [Fact]
    public void An_unplanned_category_that_was_spent_still_gets_a_row()
    {
        var r = Run([P(-500m, "work")], [T("2026-09-10", -300m, "home")], "main");

        var home = Row(r, "home");
        Assert.Equal(0m, home.Planned);
        Assert.Equal(-300m, home.Actual);
        Assert.Equal(-300m, home.Diff);
        Assert.Equal(2, r.Rows.Count);
    }

    [Fact]
    public void Rows_follow_category_display_order()
    {
        var r = Run(
            [P(-100m, "personal"), P(-100m, "work"), P(-100m, "home")],
            [], "main");

        Assert.Equal(["work", "home", "personal"], r.Rows.Select(x => x.Id));
    }

    [Fact]
    public void Items_with_no_main_land_in_the_uncategorized_row()
    {
        var r = Run([P(-250m, null)], [], "main");

        var none = Row(r, ReportBuilder.Uncategorized);
        Assert.Equal(-250m, none.Planned);
        Assert.Equal(0m, none.Actual);
        Assert.Equal(ReportBuilder.Uncategorized, r.Rows[^1].Id);   // always last
    }

    [Fact]
    public void Uncategorized_joins_planned_and_actual_on_both_sides()
    {
        // A task with no subs is uncategorized in "sub" mode, like an item with no subs.
        var r = Run([P(-250m, "home")], [T("2026-09-12", -90m, "home")], "sub");

        var none = Row(r, ReportBuilder.Uncategorized);
        Assert.Equal(-250m, none.Planned);
        Assert.Equal(-90m, none.Actual);
        Assert.Equal(160m, none.Diff);
        Assert.Single(r.Rows);
    }

    [Fact]
    public void By_sub_an_item_with_several_subs_counts_once_under_its_first()
    {
        var r = Run([P(-600m, "home", "he", "hc")], [], "sub");

        Assert.Equal(-600m, Row(r, "he").Planned);
        Assert.Single(r.Rows);                     // not also counted under "hc"
        Assert.Equal(-600m, r.Planned);
    }

    [Fact]
    public void By_sub_planned_and_actual_meet_on_the_same_sub()
    {
        var r = Run(
            [P(-4000m, "home", "he"), P(-1000m, "home", "hc")],
            [T("2026-09-03", -4380m, "home", "he"), T("2026-09-04", -200m, "personal", "pf")],
            "sub");

        Assert.Equal(-380m, Row(r, "he").Diff);
        Assert.Equal(1000m, Row(r, "hc").Diff);    // planned, unspent
        Assert.Equal(-200m, Row(r, "pf").Diff);    // spent, unplanned
        Assert.Equal(-5000m, r.Planned);
        Assert.Equal(-4580m, r.Actual);
        Assert.Equal(420m, r.Diff);
    }

    [Fact]
    public void Spending_outside_the_budget_range_is_not_counted()
    {
        var r = Run(
            [P(-1000m, "home")],
            [T("2026-08-31", -700m, "home"), T("2026-10-01", -700m, "home")],
            "main");

        var home = Row(r, "home");
        Assert.Equal(0m, home.Actual);
        Assert.Equal(1000m, home.Diff);
    }

    [Fact]
    public void Planned_income_is_signed_like_a_task_amount()
    {
        var r = Run([P(26000m, "work")], [T("2026-09-25", 26500m, "work")], "main");

        var work = Row(r, "work");
        Assert.Equal(26000m, work.Planned);
        Assert.Equal(26500m, work.Actual);
        Assert.Equal(500m, work.Diff);             // earned more than planned
    }

    [Fact]
    public void An_empty_budget_over_empty_books_has_no_rows()
    {
        var r = Run([], [], "main");

        Assert.Empty(r.Rows);
        Assert.Equal(0m, r.Planned);
        Assert.Equal(0m, r.Actual);
        Assert.Equal(0m, r.Diff);
    }
}
