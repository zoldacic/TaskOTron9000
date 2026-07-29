using System.Globalization;
using System.Text;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Services;

/// <summary>
/// Builds the small, stable block of context that rides in the prompt: today's
/// date and the vocabulary Claude needs to phrase a query — the category tree
/// and the bank accounts.
///
/// The tasks themselves are deliberately absent. They are fetched on demand
/// through <see cref="AskTools"/>, so the prompt stays the same size whether
/// there are seventy tasks or seventy thousand, and this block can sit behind a
/// cache breakpoint that follow-up questions only pay to read.
/// </summary>
public static class AskContextBuilder
{
    /// <param name="taskCount">Rough sense of scale, so Claude knows what it is querying against.</param>
    /// <param name="today">The app's "now", so relative questions ("this month") have an anchor.</param>
    public static string BuildCategoryContext(
        IReadOnlyList<Main> mains,
        IReadOnlyList<BankAccount> accounts,
        int taskCount,
        DateOnly today)
    {
        var sb = new StringBuilder();

        sb.Append("Today's date is ").Append(Iso(today)).AppendLine(".");
        sb.Append("There are ").Append(taskCount).AppendLine(" tasks in total; query them with the tools.");
        sb.AppendLine();

        sb.AppendLine("## Category tree (main > subs)");
        sb.AppendLine("Every task has exactly one main category and any number of subcategories,");
        sb.AppendLine("which may belong to a different main. Use these names verbatim in tool calls.");
        foreach (var m in mains.OrderBy(m => m.Name, StringComparer.OrdinalIgnoreCase))
        {
            var subs = string.Join(", ", m.Subs
                .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
                .Select(s => s.Name));
            sb.Append("- ").Append(m.Name).Append(": ")
              .AppendLine(subs.Length > 0 ? subs : "(no subcategories)");
        }

        if (accounts.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("## Bank accounts");
            foreach (var a in accounts.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase))
                sb.Append("- ").AppendLine(a.Name);
        }

        return sb.ToString();
    }

    private static string Iso(DateOnly d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}
