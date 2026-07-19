namespace TaskOTron.Api.Models;

/// <summary>A named, reusable task query. The criteria are stored as a JSON blob
/// (the serialized <c>TaskQueryDto</c>) so the shape can evolve without schema churn.</summary>
public class SavedQuery
{
    // String PK, generated backend-side ('q' + timestamp), mirroring the Main/Sub/BankAccount scheme.
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string CriteriaJson { get; set; } = default!;
}
