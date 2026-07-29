using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Models;
using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

/// <summary>
/// Exercises the tools Claude calls, against a real (in-memory) database — the
/// filtering and the totals are what the answers are built on, so they are worth
/// pinning down.
/// </summary>
public class AskToolsTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly AppDbContext _db;

    public AskToolsTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options);
        _db.Database.EnsureCreated();
        Seed();
    }

    public void Dispose()
    {
        _db.Dispose();
        _conn.Dispose();
        GC.SuppressFinalize(this);
    }

    private void Seed()
    {
        var mat = new Main { Id = "m1", Name = "Mat" };
        var fordon = new Main { Id = "m2", Name = "Fordon" };
        var matvaror = new Sub { Id = "s1", MainId = "m1", Name = "Matvaror" };
        var snabbmat = new Sub { Id = "s2", MainId = "m1", Name = "Snabbmat" };
        var tankning = new Sub { Id = "s3", MainId = "m2", Name = "Tankning" };
        var seb = new BankAccount { Id = "b1", Name = "SEB Main" };
        _db.AddRange(mat, fordon, matvaror, snabbmat, tankning, seb);

        _db.AddRange(
            Task("Stora Coop", "2026-06-05", -500m, mat, seb, matvaror),
            Task("Ica Kvantum", "2026-06-20", -300m, mat, seb, matvaror),
            Task("Max Burgers", "2026-06-21", -150m, mat, seb, snabbmat),
            Task("OKQ8 Skellefteå", "2026-06-22", -1000m, fordon, seb, tankning),
            Task("Lön", "2026-06-25", 25000m, mat, seb),          // income, deliberately in Mat
            Task("Stora Coop", "2026-07-02", -250m, mat, seb, matvaror), // outside June
            Task("Okategoriserad", "2026-06-10", -42m, fordon, seb));    // no subcategory
        _db.SaveChanges();
    }

    private static Todo Task(string title, string due, decimal amount, Main main, BankAccount acct, params Sub[] subs) =>
        new()
        {
            Title = title,
            Due = DateOnly.Parse(due),
            Amount = amount,
            DateKind = DateKind.Transaction,
            MainId = main.Id,
            BankAccountId = acct.Id,
            Categories = subs.ToList(),
        };

    private async Task<JsonElement> Run(string tool, string inputJson)
    {
        var input = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(inputJson)!;
        var (result, _) = await AskTools.RunAsync(tool, input, _db, CancellationToken.None);
        return JsonDocument.Parse(result).RootElement.Clone();
    }

    // ---- query_tasks ----

    [Fact]
    public async Task Query_filters_by_date_range_and_category()
    {
        var r = await Run("query_tasks", """{"from":"2026-06-01","to":"2026-06-30","main":"Mat"}""");

        Assert.Equal(4, r.GetProperty("count").GetInt32()); // 3 spends + the income row
        var titles = r.GetProperty("tasks").EnumerateArray().Select(t => t.GetProperty("title").GetString()).ToList();
        Assert.DoesNotContain("OKQ8 Skellefteå", titles);
        Assert.DoesNotContain("Stora Coop 2026-07-02", titles);
    }

    [Fact]
    public async Task Query_returns_newest_first()
    {
        var r = await Run("query_tasks", """{"main":"Mat"}""");

        var dates = r.GetProperty("tasks").EnumerateArray()
            .Select(t => t.GetProperty("date").GetString()).ToList();
        Assert.Equal(dates.OrderByDescending(d => d).ToList(), dates);
    }

    [Fact]
    public async Task Query_matches_title_text_case_insensitively()
    {
        var r = await Run("query_tasks", """{"text":"okq8"}""");

        Assert.Equal(1, r.GetProperty("count").GetInt32());
        Assert.Equal("OKQ8 Skellefteå", r.GetProperty("tasks")[0].GetProperty("title").GetString());
    }

    [Fact]
    public async Task Query_finds_tasks_with_no_subcategory()
    {
        var r = await Run("query_tasks", """{"has_subcategories":false}""");

        Assert.Equal(2, r.GetProperty("count").GetInt32()); // the uncategorised one and Lön
        var titles = r.GetProperty("tasks").EnumerateArray().Select(t => t.GetProperty("title").GetString()).ToList();
        Assert.Contains("Okategoriserad", titles);
    }

    [Fact]
    public async Task Query_totals_cover_every_match_even_when_rows_are_truncated()
    {
        var r = await Run("query_tasks", """{"from":"2026-06-01","to":"2026-06-30","main":"Mat","limit":1}""");

        Assert.Equal(4, r.GetProperty("count").GetInt32());
        Assert.Equal(1, r.GetProperty("returned").GetInt32());
        Assert.True(r.GetProperty("truncated").GetBoolean());
        // Totals still describe all four rows: 25000 in, 950 out.
        Assert.Equal(25000m, r.GetProperty("totals").GetProperty("money_in").GetDecimal());
        Assert.Equal(950m, r.GetProperty("totals").GetProperty("money_out").GetDecimal());
    }

    // ---- spending_report ----

    [Fact]
    public async Task Report_totals_money_in_and_out_over_the_range()
    {
        var r = await Run("spending_report", """{"from":"2026-06-01","to":"2026-06-30"}""");

        Assert.Equal(25000m, r.GetProperty("money_in").GetDecimal());
        Assert.Equal(1992m, r.GetProperty("money_out").GetDecimal()); // 500+300+150+1000+42
        Assert.Equal(23008m, r.GetProperty("net").GetDecimal());
    }

    [Fact]
    public async Task Report_can_break_down_by_subcategory()
    {
        var r = await Run("spending_report", """{"from":"2026-06-01","to":"2026-06-30","group_by":"sub"}""");

        var byName = r.GetProperty("categories").EnumerateArray()
            .ToDictionary(c => c.GetProperty("name").GetString()!, c => c.GetProperty("net").GetDecimal());
        Assert.Equal(-800m, byName["Matvaror"]);
        Assert.Equal(-1000m, byName["Tankning"]);
    }

    [Fact]
    public async Task Report_narrowed_to_one_category_excludes_the_others()
    {
        var r = await Run("spending_report",
            """{"from":"2026-06-01","to":"2026-06-30","group_by":"sub","categories":["Tankning"]}""");

        Assert.Equal(1000m, r.GetProperty("money_out").GetDecimal());
        Assert.Equal(0m, r.GetProperty("money_in").GetDecimal());
    }

    [Fact]
    public async Task Report_reports_an_unknown_category_rather_than_silently_returning_everything()
    {
        var r = await Run("spending_report",
            """{"from":"2026-06-01","to":"2026-06-30","categories":["Nonexistent"]}""");

        Assert.True(r.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task Report_requires_a_date_range()
    {
        var r = await Run("spending_report", """{"group_by":"main"}""");

        Assert.True(r.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task Unknown_tool_comes_back_as_an_error_not_an_exception()
    {
        var r = await Run("nope", "{}");

        Assert.True(r.TryGetProperty("error", out _));
    }
}
