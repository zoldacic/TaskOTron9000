namespace TaskOTron.Api.Models;

/// <summary>A top-level ("main") category, e.g. Work / Home / Personal.</summary>
public class Main
{
    // String PK, e.g. "work". New ones are generated backend-side (see CategoryEndpoints),
    // mirroring the prototype's 'm' + timestamp scheme.
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;

    public ICollection<Sub> Subs { get; set; } = new List<Sub>();
}
