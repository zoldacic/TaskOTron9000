namespace TaskOTron.Api.Models;

/// <summary>A task. Replaces the prototype's in-memory todo objects.</summary>
public class Todo
{
    // Int PK, autoincrement — replaces the prototype's nextId counter.
    public int Id { get; set; }
    public string Title { get; set; } = default!;
    public bool Done { get; set; }

    // Free-text note attached to the task. null/blank = no note.
    public string? Note { get; set; }

    // ISO yyyy-MM-dd, nullable. Stored as TEXT by SQLite; sorts lexically like the prototype's strings.
    public DateOnly? Due { get; set; }

    // null = "no amount". Positive = income, negative = spend.
    public decimal? Amount { get; set; }

    public DateKind DateKind { get; set; } = DateKind.Due;

    // The bank account this task belongs to (set on import). null = none.
    public string? BankAccountId { get; set; }
    public BankAccount? BankAccount { get; set; }

    // The required single "main" category. Exactly one per task (business rule);
    // independent of the sub-categories below, which may span other mains.
    public string MainId { get; set; } = default!;
    public Main Main { get; set; } = default!;

    // Many-to-many with Sub (the prototype's catIds[]). Zero-to-many, and a sub
    // may belong to a different main than MainId.
    public ICollection<Sub> Categories { get; set; } = new List<Sub>();
}
