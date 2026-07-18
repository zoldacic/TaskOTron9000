namespace TaskOTron.Api.Models;

/// <summary>
/// Remembered category assignment keyed by lowercased, trimmed transaction title.
/// Used to pre-fill categories when parsing bank imports. Persisted across sessions
/// (the prototype kept these in memory only).
/// </summary>
public class TitleDefault
{
    // PK = normalized (lowercased, trimmed) title, e.g. "whole foods market".
    public string NormalizedTitle { get; set; } = default!;

    public ICollection<Sub> Categories { get; set; } = new List<Sub>();
}
