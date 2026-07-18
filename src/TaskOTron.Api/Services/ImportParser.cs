using System.Globalization;
using System.Text.RegularExpressions;

namespace TaskOTron.Api.Services;

/// <summary>One parsed bank-import row. <c>Date</c> is ISO yyyy-MM-dd or null.</summary>
public record ParsedImportRow(
    int Key,
    string Title,
    string? Date,
    decimal? Amount,
    bool Ok,
    List<string> CatIds);

/// <summary>
/// Faithful C# port of the prototype's detectDate / detectAmount / parseImport
/// (Tasks.dc.html:815-847).
/// </summary>
public static partial class ImportParser
{
    [GeneratedRegex(@"^(\d{4})-(\d{1,2})-(\d{1,2})$")]
    private static partial Regex IsoDate();

    [GeneratedRegex(@"^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$")]
    private static partial Regex SlashDotDate();

    // Number shapes accepted before the "money-ish" gate.
    [GeneratedRegex(@"^[+-]?\d{1,3}(,\d{3})*(\.\d+)?$")]
    private static partial Regex GroupedNumber();

    [GeneratedRegex(@"^[+-]?\d+(\.\d+)?$")]
    private static partial Regex PlainNumber();

    // Split each line on tab, comma, or 2+ spaces.
    [GeneratedRegex(@"\t|,|\s{2,}")]
    private static partial Regex FieldSplit();

    /// <summary>Returns ISO yyyy-MM-dd, or null if the token is not a recognized date.</summary>
    public static string? DetectDate(string tok)
    {
        var m = IsoDate().Match(tok);
        if (m.Success)
            return $"{m.Groups[1].Value}-{Pad(m.Groups[2].Value)}-{Pad(m.Groups[3].Value)}";

        m = SlashDotDate().Match(tok);
        if (m.Success)
        {
            // Day-first for the slash/dot form: group1 = day, group2 = month, group3 = year.
            var y = m.Groups[3].Value.Length == 2 ? "20" + m.Groups[3].Value : m.Groups[3].Value;
            return $"{y}-{Pad(m.Groups[2].Value)}-{Pad(m.Groups[1].Value)}";
        }
        return null;
    }

    /// <summary>Returns the parsed amount, or null if the token is not "money-ish".</summary>
    public static decimal? DetectAmount(string tok)
    {
        var cleaned = tok.Replace("$", "").Replace("€", "").Replace("£", "");
        if (GroupedNumber().IsMatch(cleaned) || PlainNumber().IsMatch(cleaned))
        {
            var moneyish = cleaned.StartsWith('+') || cleaned.StartsWith('-')
                || Regex.IsMatch(cleaned, @"\.\d+$")
                || tok.Contains('$') || tok.Contains('€') || tok.Contains('£');
            if (moneyish)
                return decimal.Parse(cleaned.Replace(",", ""), CultureInfo.InvariantCulture);
        }
        return null;
    }

    /// <summary>
    /// Parses raw pasted text into rows. <paramref name="titleDefaults"/> maps normalized
    /// (lowercased, trimmed) titles to sub-category ids, used to pre-fill a row's categories.
    /// </summary>
    public static List<ParsedImportRow> Parse(
        string? text,
        IReadOnlyDictionary<string, List<string>> titleDefaults)
    {
        var lines = (text ?? "")
            .Split('\n')
            .Select(l => l.Trim('\r', ' ', '\t'))
            .Where(l => l.Length > 0)
            .ToList();

        var rows = new List<ParsedImportRow>(lines.Count);
        for (var i = 0; i < lines.Count; i++)
        {
            var parts = FieldSplit().Split(lines[i])
                .Select(p => p.Trim())
                .Where(p => p.Length > 0)
                .ToList();

            string? date = null;
            decimal? amount = null;
            var rest = new List<string>();
            foreach (var p in parts)
            {
                var iso = DetectDate(p);
                var amt = DetectAmount(p);
                if (iso is not null && date is null) date = iso;
                else if (amt is not null && amount is null) amount = amt;
                else rest.Add(p);
            }

            var title = rest.Count > 0 ? string.Join(" ", rest) : "Untitled row";
            var norm = title.Trim().ToLowerInvariant();
            var catIds = titleDefaults.TryGetValue(norm, out var def) ? new List<string>(def) : new List<string>();

            rows.Add(new ParsedImportRow(i, title, date, amount, amount is not null, catIds));
        }
        return rows;
    }

    private static string Pad(string numeric) => int.Parse(numeric).ToString("D2", CultureInfo.InvariantCulture);
}
