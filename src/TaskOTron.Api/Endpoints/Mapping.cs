using System.Globalization;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

internal static class Mapping
{
    public static TodoDto ToDto(this Todo t) => new(
        t.Id,
        t.Title,
        t.Done,
        t.Due?.ToString("yyyy-MM-dd"),
        t.Amount,
        t.DateKind,
        t.MainId,
        t.Categories.Select(c => c.Id).OrderBy(x => x).ToList(),
        t.BankAccountId,
        t.Note,
        t.DoneAt?.ToString("yyyy-MM-dd"));

    public static BudgetItemDto ToDto(this BudgetItem i) => new(
        i.Id,
        i.Title,
        i.Amount,
        i.Quantity,
        i.UnitPrice,
        i.MainId,
        i.Categories.Select(c => c.Id).OrderBy(x => x).ToList(),
        i.Note,
        i.SortOrder);

    public static BudgetDto ToDto(this Budget b) => new(
        b.Id,
        b.Name,
        b.From.ToString("yyyy-MM-dd"),
        b.To.ToString("yyyy-MM-dd"),
        b.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ToDto()).ToList());

    /// <summary>Parse an ISO yyyy-MM-dd string to DateOnly; blank/null → null.</summary>
    public static DateOnly? ParseDate(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso)) return null;
        return DateOnly.TryParseExact(iso, "yyyy-MM-dd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var d)
            ? d
            : throw new BadHttpRequestException($"Invalid date '{iso}', expected yyyy-MM-dd.");
    }
}
