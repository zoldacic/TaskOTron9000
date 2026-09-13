namespace TaskOTron.Api.Services;

/// <param name="CatIds">The item's sub ids, in display order.</param>
public record PlannedItem(decimal Amount, string? MainId, IReadOnlyList<string> CatIds);

/// <param name="Diff">Actual − Planned: negative = over the plan, positive = under it.</param>
public record CompareRow(string Id, string Name, decimal Planned, decimal Actual, decimal Diff);

public record CompareResult(
    decimal Planned,
    decimal Actual,
    decimal Diff,
    IReadOnlyList<CompareRow> Rows);

/// <summary>
/// Joins a budget's planned amounts with what was actually spent, per category. The actual side is
/// <see cref="ReportBuilder"/>'s own category breakdown, run over the budget's date range — the one
/// place planned and paid money meet, and read-only. <see cref="ReportBuilder"/> knows nothing of
/// budgets, so the spending report is unaffected by anything here.
/// </summary>
public static class BudgetComparison
{
    /// <param name="actuals">
    /// The result of <see cref="ReportBuilder.Build"/> over the budget's range with all categories
    /// selected and the same <paramref name="groupBy"/>.
    /// </param>
    /// <param name="groupBy">"main" or "sub" — the grain both sides are bucketed at.</param>
    public static CompareResult Build(
        IEnumerable<PlannedItem> items,
        ReportResult actuals,
        string groupBy,
        IReadOnlyList<ReportMain> mains,
        IReadOnlyList<ReportSub> subs)
    {
        var bySub = groupBy == "sub";

        // A planned item is keyed exactly the way ReportBuilder keys a task (its CatKey): in "sub"
        // mode the FIRST sub, never every sub — that is what stops an item filed under two subs
        // being counted twice, and keeps the two sides of the join comparable.
        string Key(PlannedItem i) => bySub
            ? (i.CatIds.Count > 0 ? i.CatIds[0] : ReportBuilder.Uncategorized)
            : (!string.IsNullOrEmpty(i.MainId) ? i.MainId! : ReportBuilder.Uncategorized);

        var planned = new Dictionary<string, decimal>();
        foreach (var i in items)
        {
            var k = Key(i);
            planned[k] = planned.GetValueOrDefault(k) + i.Amount;
        }

        var actual = actuals.CategoryBreakdown.ToDictionary(c => c.Id, c => c.Net);
        var names = actuals.CategoryBreakdown.ToDictionary(c => c.Id, c => c.Name);

        // Rows are the union of both sides: a category planned but unspent, and one spent but
        // unplanned, are both worth seeing. Emitted in category display order, uncategorized last.
        var order = bySub ? subs.Select(s => s.Id) : mains.Select(m => m.Id);
        var rows = new List<CompareRow>();
        foreach (var id in order)
        {
            if (!planned.ContainsKey(id) && !actual.ContainsKey(id)) continue;
            var p = planned.GetValueOrDefault(id);
            var a = actual.GetValueOrDefault(id);
            var name = names.GetValueOrDefault(id)
                ?? (bySub ? subs.First(s => s.Id == id).Name : mains.First(m => m.Id == id).Name);
            rows.Add(new CompareRow(id, name, p, a, a - p));
        }

        if (planned.ContainsKey(ReportBuilder.Uncategorized) || actual.ContainsKey(ReportBuilder.Uncategorized))
        {
            var p = planned.GetValueOrDefault(ReportBuilder.Uncategorized);
            var a = actual.GetValueOrDefault(ReportBuilder.Uncategorized);
            rows.Add(new CompareRow(ReportBuilder.Uncategorized, "Uncategorized", p, a, a - p));
        }

        var totalPlanned = rows.Sum(r => r.Planned);
        var totalActual = rows.Sum(r => r.Actual);
        return new CompareResult(totalPlanned, totalActual, totalActual - totalPlanned, rows);
    }
}
