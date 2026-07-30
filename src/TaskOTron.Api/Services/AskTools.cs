using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Services;

/// <summary>
/// The tools Claude can call to look at the user's tasks.
///
/// Two of them, deliberately: one to find tasks, one to add them up. Totals come
/// from <see cref="ReportBuilder"/> — the same code behind the Reports view — so a
/// number Claude quotes and a number the user can see in the UI come from one
/// place. Tasks are queried on demand rather than pasted into the prompt, so the
/// cost of a question no longer grows with the size of the database.
/// </summary>
public static class AskTools
{
    /// <summary>Rows returned by a single query_tasks call unless it asks for fewer.</summary>
    private const int DefaultLimit = 50;
    private const int MaxLimit = 200;
    /// <summary>Newest first — the order that made sense before sorting was an option.</summary>
    private const string DefaultSort = "date_desc";

    private static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static List<ToolUnion> Definitions() =>
    [
        new Tool
        {
            Name = "query_tasks",
            Description = string.Join(" ", [
                "Find tasks matching filters. Every filter is optional; with none, this returns the most",
                "recent tasks. Returns the matching row count and totals computed over ALL matches, plus",
                "up to `limit` rows — so the totals stay exact even when the rows are cut off. Use this to",
                "look at individual transactions; use spending_report when you only need totals per",
                "category. For \"biggest\" or \"smallest\" questions set `sort_by` and a small `limit` rather",
                "than fetching everything and ranking it yourself — only the rows this returns are",
                "guaranteed to be the top ones.",
            ]),
            InputSchema = Schema(
                new Dictionary<string, object>
                {
                    ["from"] = Prop("string", "Earliest date, inclusive, as yyyy-MM-dd."),
                    ["to"] = Prop("string", "Latest date, inclusive, as yyyy-MM-dd."),
                    ["main"] = Prop("string", "Main category name, e.g. \"Mat\". Case-insensitive."),
                    ["sub"] = Prop("string", "Subcategory name, e.g. \"Matvaror\". Case-insensitive."),
                    ["text"] = Prop("string", "Case-insensitive substring of the title or note, e.g. \"OKQ8\"."),
                    ["account"] = Prop("string", "Bank account name. Case-insensitive."),
                    ["done"] = Prop("boolean", "true for completed tasks only, false for open ones only."),
                    ["has_subcategories"] = Prop("boolean", "false finds tasks with no subcategory — the ones needing sorting."),
                    ["min_amount"] = Prop("number", "Only tasks with an amount at least this. Remember money out is negative."),
                    ["max_amount"] = Prop("number", "Only tasks with an amount at most this."),
                    ["sort_by"] = Enum_(
                        "Order of the returned rows. \"largest_spend\" puts the biggest money out first, "
                        + "\"largest_income\" the biggest money in, \"largest_absolute\" the biggest amount in "
                        + "either direction. Tasks with no amount come last on those three. "
                        + $"Defaults to \"{DefaultSort}\" (newest first).",
                        ["date_desc", "date_asc", "largest_spend", "largest_income", "largest_absolute"]),
                    ["limit"] = Prop("integer", $"Rows to return, 1-{MaxLimit}. Defaults to {DefaultLimit}."),
                },
                required: []),
        },
        new Tool
        {
            Name = "spending_report",
            Description = string.Join(" ", [
                "Exact money-in, money-out, net and per-category totals over a date range, from the same",
                "code that produces the app's Spending report. Prefer this over adding up query_tasks rows",
                "yourself whenever the question is about totals. `money_in` and `money_out` are both",
                "positive magnitudes; `net` and the per-category figures are signed, so a negative there",
                "means more went out than came in.",
            ]),
            InputSchema = Schema(
                new Dictionary<string, object>
                {
                    ["from"] = Prop("string", "Start of the range, inclusive, as yyyy-MM-dd."),
                    ["to"] = Prop("string", "End of the range, inclusive, as yyyy-MM-dd."),
                    ["group_by"] = Enum_("Break the totals down by main category or by subcategory.", ["main", "sub"]),
                    ["categories"] = new Dictionary<string, object>
                    {
                        ["type"] = "array",
                        ["items"] = new Dictionary<string, object> { ["type"] = "string" },
                        ["description"] = "Category names to include. Omit for all.",
                    },
                },
                required: ["from", "to"]),
        },
    ];

    /// <summary>Runs one tool call. Returns the JSON result and a short line describing it for the UI.</summary>
    public static async Task<(string Result, string Summary)> RunAsync(
        string name, IReadOnlyDictionary<string, JsonElement> input, AppDbContext db, CancellationToken ct)
    {
        try
        {
            return name switch
            {
                "query_tasks" => await QueryTasksAsync(input, db, ct),
                "spending_report" => await SpendingReportAsync(input, db, ct),
                _ => (Error($"Unknown tool '{name}'."), name),
            };
        }
        catch (Exception ex)
        {
            // Hand the failure back to Claude so it can adjust rather than stalling.
            return (Error(ex.Message), name);
        }
    }

    // ---- query_tasks ----

    private static async Task<(string, string)> QueryTasksAsync(
        IReadOnlyDictionary<string, JsonElement> input, AppDbContext db, CancellationToken ct)
    {
        var all = await LoadTasksAsync(db, ct);
        IEnumerable<Todo> q = all;

        var from = Date(input, "from");
        var to = Date(input, "to");
        if (from is { } f) q = q.Where(t => t.Due is { } d && d >= f);
        if (to is { } t2) q = q.Where(t => t.Due is { } d && d <= t2);

        if (Str(input, "main") is { } main)
            q = q.Where(t => Eq(t.Main?.Name, main));
        if (Str(input, "sub") is { } sub)
            q = q.Where(t => t.Categories.Any(c => Eq(c.Name, sub)));
        if (Str(input, "account") is { } acct)
            q = q.Where(t => Eq(t.BankAccount?.Name, acct));
        if (Str(input, "text") is { } text)
            q = q.Where(t => Has(t.Title, text) || Has(t.Note, text));
        if (Bool(input, "done") is { } done)
            q = q.Where(t => t.Done == done);
        if (Bool(input, "has_subcategories") is { } hasSubs)
            q = q.Where(t => t.Categories.Count > 0 == hasSubs);
        if (Num(input, "min_amount") is { } min)
            q = q.Where(t => t.Amount is { } a && a >= min);
        if (Num(input, "max_amount") is { } max)
            q = q.Where(t => t.Amount is { } a && a <= max);

        var sort = Str(input, "sort_by") ?? DefaultSort;
        var matches = Sorted(q, sort).ToList();
        var limit = Math.Clamp(Int(input, "limit") ?? DefaultLimit, 1, MaxLimit);

        // Totals cover every match, not just the rows we hand back.
        var amounts = matches.Where(t => t.Amount is not null).Select(t => t.Amount!.Value).ToList();
        var result = new
        {
            count = matches.Count,
            returned = Math.Min(limit, matches.Count),
            truncated = matches.Count > limit,
            totals = new
            {
                money_in = amounts.Where(a => a > 0).Sum(),
                money_out = Math.Abs(amounts.Where(a => a < 0).Sum()),
                net = amounts.Sum(),
            },
            tasks = matches.Take(limit).Select(Row).ToList(),
        };

        return (JsonSerializer.Serialize(result, Json), Describe("query_tasks", input, $"{matches.Count} matched"));
    }

    /// <summary>
    /// Applies the requested order. Sorts are named by intent rather than by sign,
    /// because "biggest purchase" means the *most negative* amount and asking the
    /// caller to reason about that is a reliable way to get it backwards. Tasks with
    /// no amount sort last on every amount-based order — they can't be ranked by one.
    /// </summary>
    private static IEnumerable<Todo> Sorted(IEnumerable<Todo> q, string sort) => sort switch
    {
        "date_asc" => q.OrderBy(t => t.Due ?? DateOnly.MaxValue).ThenBy(t => t.Id),
        "largest_spend" => q.OrderBy(t => t.Amount is null).ThenBy(t => t.Amount ?? 0),
        "largest_income" => q.OrderBy(t => t.Amount is null).ThenByDescending(t => t.Amount ?? 0),
        "largest_absolute" => q.OrderBy(t => t.Amount is null).ThenByDescending(t => Math.Abs(t.Amount ?? 0)),
        // Anything unrecognised falls back to the default rather than erroring —
        // a bad sort name shouldn't cost a whole tool round trip.
        _ => q.OrderByDescending(t => t.Due ?? DateOnly.MinValue).ThenByDescending(t => t.Id),
    };

    private static object Row(Todo t) => new
    {
        date = t.Due?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        title = t.Title,
        amount = t.Amount,
        main = t.Main?.Name,
        subs = t.Categories.Select(c => c.Name).OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList(),
        account = t.BankAccount?.Name,
        done = t.Done,
        note = string.IsNullOrWhiteSpace(t.Note) ? null : t.Note.Trim(),
    };

    // ---- spending_report ----

    private static async Task<(string, string)> SpendingReportAsync(
        IReadOnlyDictionary<string, JsonElement> input, AppDbContext db, CancellationToken ct)
    {
        if (Date(input, "from") is not { } from || Date(input, "to") is not { } to)
            return (Error("Both 'from' and 'to' are required, as yyyy-MM-dd."), "spending_report");

        var groupBy = Str(input, "group_by") == "sub" ? "sub" : "main";
        var todos = await LoadTasksAsync(db, ct);
        var mainEntities = await db.Mains.Include(m => m.Subs).AsNoTracking().ToListAsync(ct);

        var mains = mainEntities
            .Select(m => new ReportMain(m.Id, m.Name, m.Subs.Select(s => s.Id).ToList()))
            .ToList();
        var subs = mainEntities
            .SelectMany(m => m.Subs.Select(s => new ReportSub(s.Id, s.Name, m.Id)))
            .ToList();

        // Category names come from Claude; the report works in ids.
        IReadOnlyCollection<string>? selection = null;
        if (input.TryGetValue("categories", out var raw) && raw.ValueKind == JsonValueKind.Array)
        {
            var wanted = raw.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String)
                .Select(e => e.GetString()!)
                .ToList();
            var ids = groupBy == "sub"
                ? subs.Where(s => wanted.Any(w => Eq(s.Name, w))).Select(s => s.Id)
                : mains.Where(m => wanted.Any(w => Eq(m.Name, w))).Select(m => m.Id);
            var known = ids.ToList();
            if (known.Count == 0)
                return (Error($"None of those category names exist at the '{groupBy}' level."), "spending_report");
            selection = known;
        }

        var tasks = todos.Select(t => new ReportTask(
            t.Due, t.Amount, t.MainId, t.Categories.Select(c => c.Id).ToList()));
        var report = ReportBuilder.Build(tasks, from, to, selection, groupBy, mains, subs);

        var result = new
        {
            from = from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            to = to.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            grouped_by = groupBy,
            money_in = report.MoneyIn,
            // ReportBuilder keeps money out negative (the app renders it that way);
            // report the magnitude here so a field called money_out cannot be misread.
            money_out = Math.Abs(report.MoneyOut),
            net = report.Net,
            // Net per category; negative means more went out than came in.
            categories = report.CategoryBreakdown
                .Where(c => c.Net != 0)
                .OrderBy(c => c.Net)
                .Select(c => new { name = c.Name, net = c.Net })
                .ToList(),
        };

        return (JsonSerializer.Serialize(result, Json), Describe("spending_report", input, null));
    }

    // ---- shared ----

    private static Task<List<Todo>> LoadTasksAsync(AppDbContext db, CancellationToken ct) =>
        db.Todos
            .Include(t => t.Main)
            .Include(t => t.BankAccount)
            .Include(t => t.Categories)
            .AsNoTracking()
            .ToListAsync(ct);

    private static string Error(string message) =>
        JsonSerializer.Serialize(new { error = message }, Json);

    /// <summary>A short "what just happened" line for the UI, e.g. query_tasks · Mat · 12 matched.</summary>
    private static string Describe(string tool, IReadOnlyDictionary<string, JsonElement> input, string? outcome)
    {
        var bits = new List<string> { tool };
        foreach (var key in new[] { "main", "sub", "text", "account" })
            if (Str(input, key) is { } v) bits.Add(v);
        var from = Str(input, "from");
        var to = Str(input, "to");
        if (from is not null || to is not null) bits.Add($"{from ?? "…"} → {to ?? "…"}");
        // Worth surfacing: it changes which rows the answer is based on.
        if (Str(input, "sort_by") is { } s && s != DefaultSort) bits.Add(s);
        if (outcome is not null) bits.Add(outcome);
        return string.Join(" · ", bits);
    }

    private static bool Eq(string? a, string? b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
    private static bool Has(string? haystack, string needle) =>
        haystack is not null && haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);

    private static string? Str(IReadOnlyDictionary<string, JsonElement> i, string k) =>
        i.TryGetValue(k, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString())
            ? v.GetString()!.Trim() : null;

    private static bool? Bool(IReadOnlyDictionary<string, JsonElement> i, string k) =>
        i.TryGetValue(k, out var v) && v.ValueKind is JsonValueKind.True or JsonValueKind.False ? v.GetBoolean() : null;

    private static decimal? Num(IReadOnlyDictionary<string, JsonElement> i, string k) =>
        i.TryGetValue(k, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;

    private static int? Int(IReadOnlyDictionary<string, JsonElement> i, string k) =>
        i.TryGetValue(k, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;

    private static DateOnly? Date(IReadOnlyDictionary<string, JsonElement> i, string k) =>
        Str(i, k) is { } s && DateOnly.TryParse(s, CultureInfo.InvariantCulture, out var d) ? d : null;

    // ---- schema helpers ----

    private static InputSchema Schema(Dictionary<string, object> properties, List<string> required) =>
        new()
        {
            Properties = properties.ToDictionary(
                p => p.Key,
                p => JsonSerializer.SerializeToElement(p.Value)),
            Required = required,
        };

    private static Dictionary<string, object> Prop(string type, string description) =>
        new() { ["type"] = type, ["description"] = description };

    private static Dictionary<string, object> Enum_(string description, string[] values) =>
        new() { ["type"] = "string", ["description"] = description, ["enum"] = values };
}
