namespace TaskOTron.Api.Models;

/// <summary>A task. Replaces the prototype's in-memory todo objects.</summary>
public class Todo
{
    // Int PK, autoincrement — replaces the prototype's nextId counter.
    public int Id { get; set; }
    public string Title { get; set; } = default!;
    public bool Done { get; set; }

    // ISO yyyy-MM-dd, nullable. Stored as TEXT by SQLite; sorts lexically like the prototype's strings.
    public DateOnly? Due { get; set; }

    // null = "no amount". Positive = income, negative = spend.
    public decimal? Amount { get; set; }

    public DateKind DateKind { get; set; } = DateKind.Due;

    // Many-to-many with Sub (the prototype's catIds[]).
    public ICollection<Sub> Categories { get; set; } = new List<Sub>();
}
