namespace TaskOTron.Api.Models;

/// <summary>One planned line in a <see cref="Budget"/>. Has no date of its own — the budget's
/// range is the window.</summary>
public class BudgetItem
{
    // Int PK, autoincrement, like Todo.
    public int Id { get; set; }

    public string BudgetId { get; set; } = default!;
    public Budget Budget { get; set; } = default!;

    public string Title { get; set; } = default!;

    // Signed like Todo.Amount: negative = planned spend, positive = planned income.
    public decimal Amount { get; set; }

    // Optional pricing. When both are set the server recomputes Amount as Quantity * UnitPrice
    // (rounded to 2dp), so the stored amount can never drift from the pricing that produced it.
    // UnitPrice carries the sign.
    public decimal? Quantity { get; set; }
    public decimal? UnitPrice { get; set; }

    // The main category — optional here, unlike Todo.MainId, and cleared (not blocked) if the
    // main is deleted: a plan must never stand in the way of managing categories.
    public string? MainId { get; set; }
    public Main? Main { get; set; }

    // Many-to-many with Sub, like Todo.Categories. Deleting a sub strips it from the item.
    public ICollection<Sub> Categories { get; set; } = new List<Sub>();

    // Free-text note. null/blank = no note.
    public string? Note { get; set; }

    // Display order within the budget; new items are appended.
    public int SortOrder { get; set; }
}
