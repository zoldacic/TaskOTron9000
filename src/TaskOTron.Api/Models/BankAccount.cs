namespace TaskOTron.Api.Models;

/// <summary>A bank account tasks can be imported/attached to, e.g. "SEB Personal".</summary>
public class BankAccount
{
    // String PK, generated backend-side ('b' + timestamp), mirroring the Main/Sub scheme.
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;

    public ICollection<Todo> Todos { get; set; } = new List<Todo>();
}
