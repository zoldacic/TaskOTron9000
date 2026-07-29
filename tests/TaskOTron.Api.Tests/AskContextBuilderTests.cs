using TaskOTron.Api.Models;
using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class AskContextBuilderTests
{
    private static readonly DateOnly Today = new(2026, 7, 28);

    private static List<Main> Categories()
    {
        var mat = new Main { Id = "m1", Name = "Mat" };
        mat.Subs =
        [
            new Sub { Id = "s2", MainId = "m1", Name = "Snabbmat", Main = mat },
            new Sub { Id = "s1", MainId = "m1", Name = "Matvaror", Main = mat },
        ];
        return [mat, new Main { Id = "m2", Name = "Övrigt" }];
    }

    [Fact]
    public void States_todays_date_and_the_task_count()
    {
        var text = AskContextBuilder.BuildCategoryContext(Categories(), [], 73, Today);

        Assert.Contains("Today's date is 2026-07-28.", text);
        Assert.Contains("There are 73 tasks in total", text);
    }

    [Fact]
    public void Lists_subs_alphabetically_under_their_main()
    {
        var text = AskContextBuilder.BuildCategoryContext(Categories(), [], 0, Today);

        Assert.Contains("- Mat: Matvaror, Snabbmat", text);
    }

    [Fact]
    public void Marks_a_main_that_has_no_subs()
    {
        var text = AskContextBuilder.BuildCategoryContext(Categories(), [], 0, Today);

        Assert.Contains("- Övrigt: (no subcategories)", text);
    }

    [Fact]
    public void Lists_bank_accounts_when_there_are_any()
    {
        var accounts = new List<BankAccount> { new() { Id = "b1", Name = "SEB Main" } };

        var text = AskContextBuilder.BuildCategoryContext(Categories(), accounts, 0, Today);

        Assert.Contains("## Bank accounts", text);
        Assert.Contains("- SEB Main", text);
    }

    [Fact]
    public void Omits_the_accounts_section_entirely_when_there_are_none()
    {
        var text = AskContextBuilder.BuildCategoryContext(Categories(), [], 0, Today);

        Assert.DoesNotContain("## Bank accounts", text);
    }

    [Fact]
    public void Does_not_carry_the_tasks_themselves()
    {
        // The whole point of the tool-based design: the prompt stays the same size
        // however many tasks exist.
        var small = AskContextBuilder.BuildCategoryContext(Categories(), [], 10, Today);
        var large = AskContextBuilder.BuildCategoryContext(Categories(), [], 100_000, Today);

        Assert.Equal(small.Length, large.Length - ("100000".Length - "10".Length));
    }
}
