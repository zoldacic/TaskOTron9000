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
        t.Categories.Select(c => c.Id).OrderBy(x => x).ToList());

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
