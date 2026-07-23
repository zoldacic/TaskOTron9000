using TaskOTron.Api.Services;
using Xunit;

namespace TaskOTron.Api.Tests;

public class ImportParserTests
{
    private static readonly Dictionary<string, TitleDefaultEntry> NoDefaults = new();

    [Theory]
    [InlineData("2026-07-15", "2026-07-15")]
    [InlineData("2026-7-5", "2026-07-05")]      // ISO with single-digit month/day → zero-padded
    [InlineData("15/07/2026", "2026-07-15")]    // slash form is day-first
    [InlineData("15.07.26", "2026-07-15")]      // dot form, 2-digit year → 20xx
    [InlineData("notadate", null)]
    [InlineData("13/13/2026", "2026-13-13")]    // no calendar validation (matches prototype)
    public void DetectDate_matches_prototype(string tok, string? expected)
    {
        Assert.Equal(expected, ImportParser.DetectDate(tok));
    }

    [Theory]
    [InlineData("+4200.00", 4200.00)]
    [InlineData("-76.20", -76.20)]
    [InlineData("$84.50", 84.50)]       // currency symbol makes it money-ish
    [InlineData("1,234.56", 1234.56)]   // grouped thousands
    [InlineData("-100", -100)]          // leading sign makes it money-ish
    public void DetectAmount_accepts_money_ish(string tok, double expected)
    {
        Assert.Equal((decimal)expected, ImportParser.DetectAmount(tok));
    }

    [Theory]
    [InlineData("100")]     // no sign, no decimal, no symbol → rejected
    [InlineData("2026")]    // bare integer → rejected
    [InlineData("abc")]
    public void DetectAmount_rejects_non_money(string tok)
    {
        Assert.Null(ImportParser.DetectAmount(tok));
    }

    [Fact]
    public void Parse_sample_import_yields_eight_importable_rows()
    {
        // The prototype's loadSampleImport sample (Tasks.dc.html:855-866), tab-separated.
        var sample = string.Join('\n',
            "2026-07-15\tACME CORP PAYROLL\t+4200.00",
            "2026-07-14\tWHOLE FOODS MARKET\t-76.20",
            "2026-07-13\tSHELL FUEL 22817\t-52.40",
            "2026-07-12\tNETFLIX.COM\t-15.99",
            "2026-07-11\tTRANSFER FROM SAVINGS\t+500.00",
            "2026-07-10\tCITY POWER & LIGHT\t-84.50",
            "2026-07-08\tSTARBUCKS #4471\t-6.75",
            "2026-07-06\tAPARTMENT RENT\t-1650.00");

        var rows = ImportParser.Parse(sample, NoDefaults);

        Assert.Equal(8, rows.Count);
        Assert.All(rows, r => Assert.True(r.Ok));
        Assert.Equal("ACME CORP PAYROLL", rows[0].Title);
        Assert.Equal("2026-07-15", rows[0].Date);
        Assert.Equal(4200.00m, rows[0].Amount);
        Assert.Equal(-84.50m, rows[5].Amount);
        Assert.Equal("CITY POWER & LIGHT", rows[5].Title);
    }

    [Fact]
    public void Parse_prefills_main_and_categories_from_title_defaults()
    {
        var defaults = new Dictionary<string, TitleDefaultEntry>
        {
            ["whole foods market"] = new("home", ["he"]),
        };
        var rows = ImportParser.Parse("2026-07-14\tWHOLE FOODS MARKET\t-76.20", defaults);

        Assert.Single(rows);
        Assert.Equal("home", rows[0].MainId);
        Assert.Equal(["he"], rows[0].CatIds);
    }

    [Fact]
    public void Parse_prefills_from_a_merchant_substring_regardless_of_trailing_date()
    {
        // Real ICA rows carry a per-transaction date, so a full-title key would never repeat.
        // A remembered "ica" substring must fill each dated row.
        var defaults = new Dictionary<string, TitleDefaultEntry>
        {
            ["ica"] = new("food", ["mat"]),
        };
        var rows = ImportParser.Parse(
            "2026-07-15\tMAXI ICA STO/26-07-15\t-100.00\n2026-01-30\tMAXI ICA STO/26-01-30\t-50.00",
            defaults);

        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal("food", r.MainId));
        Assert.All(rows, r => Assert.Equal(["mat"], r.CatIds));
    }

    [Fact]
    public void Parse_uses_the_longest_matching_substring_when_several_apply()
    {
        var defaults = new Dictionary<string, TitleDefaultEntry>
        {
            ["ica"] = new("home", ["groceries"]),
            ["maxi ica"] = new("food", ["mat"]),
        };
        var rows = ImportParser.Parse("2026-07-15\tMAXI ICA STO/26-07-15\t-100.00", defaults);

        Assert.Single(rows);
        Assert.Equal("food", rows[0].MainId);   // "maxi ica" is more specific than "ica"
        Assert.Equal(["mat"], rows[0].CatIds);
    }

    [Fact]
    public void Parse_without_a_matching_default_leaves_main_null()
    {
        var rows = ImportParser.Parse("2026-07-14\tWHOLE FOODS MARKET\t-76.20", NoDefaults);

        Assert.Single(rows);
        Assert.Null(rows[0].MainId);
        Assert.Empty(rows[0].CatIds);
    }

    [Fact]
    public void Parse_row_without_title_falls_back_to_untitled()
    {
        var rows = ImportParser.Parse("2026-07-14\t-76.20", NoDefaults);
        Assert.Equal("Untitled row", rows[0].Title);
    }

    [Fact]
    public void Parse_row_without_amount_is_not_importable()
    {
        var rows = ImportParser.Parse("2026-07-14\tSOME NOTE", NoDefaults);
        Assert.False(rows[0].Ok);
        Assert.Null(rows[0].Amount);
    }
}
