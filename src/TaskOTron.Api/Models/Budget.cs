namespace TaskOTron.Api.Models;

/// <summary>
/// A named spending plan over a date range. Deliberately a separate table from <see cref="Todo"/>:
/// budget items are money you *intend* to spend, so they can never reach the spending report,
/// the smart lists, saved queries or import — only the read-only planned-vs-actual comparison.
/// </summary>
public class Budget
{
    // String PK, backend-generated ('bg' + timestamp), mirroring the BankAccount/SavedQuery scheme.
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;

    // Inclusive ISO yyyy-MM-dd range the plan covers; also the window the comparison sums actuals over.
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }

    public ICollection<BudgetItem> Items { get; set; } = new List<BudgetItem>();
}
