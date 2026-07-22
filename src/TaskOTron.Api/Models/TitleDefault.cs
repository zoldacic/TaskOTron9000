namespace TaskOTron.Api.Models;

/// <summary>
/// Remembered category assignment keyed by a lowercased, trimmed merchant substring.
/// Pre-fills categories when a parsed bank-import title *contains* the key, so one
/// remembered "ica" covers every dated ICA row. Persisted across sessions
/// (the prototype kept these in memory only).
/// </summary>
public class TitleDefault
{
    // PK = normalized (lowercased, trimmed) merchant substring, e.g. "ica".
    // Kept as the "NormalizedTitle" column name to avoid a schema migration.
    public string NormalizedTitle { get; set; } = default!;

    // Remembered required single main category (nullable: older rows / cleared mains).
    public string? MainId { get; set; }
    public Main? Main { get; set; }

    public ICollection<Sub> Categories { get; set; } = new List<Sub>();
}
