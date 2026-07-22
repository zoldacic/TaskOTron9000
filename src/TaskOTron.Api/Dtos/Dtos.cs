using TaskOTron.Api.Models;

namespace TaskOTron.Api.Dtos;

// ---- Tasks ----
public record TodoDto(
    int Id,
    string Title,
    bool Done,
    string? Due,           // ISO yyyy-MM-dd
    decimal? Amount,
    DateKind DateKind,
    string MainId,         // required single main category
    List<string> CatIds,
    string? BankAccountId,
    string? Note);

public record TodoWriteDto(
    string Title,
    string? Due,
    decimal? Amount,
    DateKind DateKind = DateKind.Due,
    string? MainId = null, // required; validated in the endpoint
    List<string>? CatIds = null,
    string? BankAccountId = null,
    string? Note = null);

public record BulkDeleteDto(List<int> Ids);

// ---- Categories ----
public record MainDto(string Id, string Name);
public record SubDto(string Id, string MainId, string Name, int TaskCount);
public record CategoriesDto(List<MainDto> Mains, List<SubDto> Subs);

public record MainWriteDto(string Name);
public record SubWriteDto(string MainId, string Name);
public record CategoryRenameDto(string Name);

// ---- Bank accounts ----
public record BankAccountDto(string Id, string Name, int TaskCount);
public record BankAccountWriteDto(string Name);

// ---- Saved queries ----
// Composable task-query criteria. All fields are "ignore when empty/any":
// Text blank, CatIds empty, null dates, DateKind/AmountKind "any", null amount bounds,
// null BankAccountId. BankAccountId "__none__" matches tasks with no account.
public record TaskQueryDto(
    string Text,
    List<string> CatIds,
    string? DueFrom,        // inclusive ISO yyyy-MM-dd
    string? DueTo,          // inclusive ISO yyyy-MM-dd
    string DateKind,        // "any" | "due" | "transaction"
    string AmountKind,      // "any" | "has" | "none" | "income" | "spend"
    decimal? AmountMin,     // bound on absolute amount
    decimal? AmountMax,     // bound on absolute amount
    string? BankAccountId); // specific id, "__none__", or null

public record SavedQueryDto(string Id, string Name, TaskQueryDto Query);
public record SavedQueryWriteDto(string Name, TaskQueryDto Query);

// ---- Title defaults ----
public record TitleDefaultDto(string NormalizedTitle, List<string> CatIds, string? MainId);
public record TitleDefaultWriteDto(string Match, List<string> CatIds, string? MainId = null);

// ---- Import ----
public record ImportParseRequest(string Text);
public record ImportRowDto(int Key, string Title, string? Date, decimal? Amount, bool Ok, List<string> CatIds, string? MainId);
public record ImportCommitRow(string Title, string? Date, decimal? Amount, List<string>? CatIds, string? MainId = null, string? BankAccountId = null, string? Note = null);
public record ImportCommitRequest(List<ImportCommitRow> Rows);

// ---- Reports ----
public record BucketDto(string Label, decimal Net, List<decimal> Parts);
public record CategoryNetDto(string Name, decimal Net);
public record ReportDto(
    decimal MoneyIn,
    decimal MoneyOut,
    decimal Net,
    string Granularity,
    List<BucketDto> Buckets,
    List<CategoryNetDto> CategoryBreakdown);
