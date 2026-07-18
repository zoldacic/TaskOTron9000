namespace TaskOTron.Api.Models;

/// <summary>A sub-category belonging to a <see cref="Main"/>, e.g. Reports under Work.</summary>
public class Sub
{
    // String PK, e.g. "wr". New ones generated backend-side ('s' + timestamp in the prototype).
    public string Id { get; set; } = default!;
    public string MainId { get; set; } = default!;
    public string Name { get; set; } = default!;

    public Main Main { get; set; } = default!;
    public ICollection<Todo> Todos { get; set; } = new List<Todo>();
    public ICollection<TitleDefault> TitleDefaults { get; set; } = new List<TitleDefault>();
}
