using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Data;

/// <summary>
/// Seeds a fresh database with the exact prototype data (Tasks.dc.html:639-698) so a
/// clean install matches the reference screenshots.
/// </summary>
public static class DbInitializer
{
    public static void Seed(AppDbContext db)
    {
        if (db.Mains.Any()) return; // already seeded

        var mains = new List<Main>
        {
            new() { Id = "work", Name = "Work" },
            new() { Id = "home", Name = "Home" },
            new() { Id = "personal", Name = "Personal" },
        };
        db.Mains.AddRange(mains);

        var subs = new List<Sub>
        {
            new() { Id = "wr", MainId = "work", Name = "Reports" },
            new() { Id = "wm", MainId = "work", Name = "Meetings" },
            new() { Id = "we", MainId = "work", Name = "Email" },
            new() { Id = "wp", MainId = "work", Name = "Planning" },
            new() { Id = "he", MainId = "home", Name = "Errands" },
            new() { Id = "hc", MainId = "home", Name = "Cleaning" },
            new() { Id = "hr", MainId = "home", Name = "Repairs" },
            new() { Id = "ph", MainId = "personal", Name = "Health" },
            new() { Id = "pf", MainId = "personal", Name = "Finance" },
            new() { Id = "pl", MainId = "personal", Name = "Learning" },
        };
        db.Subs.AddRange(subs);
        db.SaveChanges();

        Sub S(string id) => subs.First(x => x.Id == id);
        DateOnly D(string iso) => DateOnly.Parse(iso);

        // Each seeded task's main matches its first listed sub's main, so a fresh DB
        // satisfies the "exactly one main" rule and matches the reference screenshots.
        var todos = new List<Todo>
        {
            new() { Title = "Finish Q3 revenue report", Done = false, Due = D("2026-07-17"), Amount = null, DateKind = DateKind.Due, MainId = "work", Categories = [S("wr")] },
            new() { Title = "Review team OKRs", Done = false, Due = D("2026-07-18"), Amount = null, DateKind = DateKind.Due, MainId = "work", Categories = [S("wp"), S("wm")] },
            new() { Title = "Reply to vendor contract email", Done = false, Due = D("2026-07-16"), Amount = null, DateKind = DateKind.Due, MainId = "work", Categories = [S("we")] },
            new() { Title = "Book dentist appointment", Done = false, Due = D("2026-07-22"), Amount = -120m, DateKind = DateKind.Due, MainId = "personal", Categories = [S("ph")] },
            new() { Title = "Pay electricity bill", Done = false, Due = D("2026-07-20"), Amount = -84.5m, DateKind = DateKind.Due, MainId = "personal", Categories = [S("pf")] },
            new() { Title = "Weekly grocery run", Done = false, Due = D("2026-07-17"), Amount = -76.2m, DateKind = DateKind.Due, MainId = "home", Categories = [S("he")] },
            new() { Title = "Fix leaking kitchen tap", Done = false, Due = null, Amount = -45m, DateKind = DateKind.Due, MainId = "home", Categories = [S("hr")] },
            new() { Title = "Read \"Designing Data-Intensive Applications\"", Done = false, Due = D("2026-07-31"), Amount = -18.99m, DateKind = DateKind.Due, MainId = "personal", Categories = [S("pl")] },
            new() { Title = "Deep clean the garage", Done = true, Due = D("2026-07-14"), Amount = null, DateKind = DateKind.Due, MainId = "home", Categories = [S("hc")] },
            new() { Title = "Prepare slides for all-hands", Done = false, Due = D("2026-07-19"), Amount = null, DateKind = DateKind.Due, MainId = "work", Categories = [S("wm"), S("wp")] },
            new() { Title = "Renew car insurance", Done = false, Due = D("2026-08-03"), Amount = -320m, DateKind = DateKind.Due, MainId = "personal", Categories = [S("pf")] },
            new() { Title = "Morning run", Done = true, Due = D("2026-07-17"), Amount = null, DateKind = DateKind.Due, MainId = "personal", Categories = [S("ph")] },
            new() { Title = "Salary deposit", Done = true, Due = D("2026-07-01"), Amount = 4200m, DateKind = DateKind.Transaction, MainId = "personal", Categories = [S("pf")] },
            new() { Title = "Freelance invoice paid", Done = true, Due = D("2026-07-09"), Amount = 650m, DateKind = DateKind.Transaction, MainId = "personal", Categories = [S("pf"), S("wr")] },
            new() { Title = "Store refund", Done = true, Due = D("2026-07-11"), Amount = 32.4m, DateKind = DateKind.Transaction, MainId = "home", Categories = [S("he")] },
            new() { Title = "Netflix subscription", Done = true, Due = D("2026-07-05"), Amount = -15.99m, DateKind = DateKind.Transaction, MainId = "personal", Categories = [S("pl")] },
            new() { Title = "Fuel top-up", Done = true, Due = D("2026-07-08"), Amount = -52.4m, DateKind = DateKind.Transaction, MainId = "home", Categories = [S("he")] },
            new() { Title = "Gym membership", Done = true, Due = D("2026-07-03"), Amount = -39m, DateKind = DateKind.Transaction, MainId = "personal", Categories = [S("ph")] },
        };
        db.Todos.AddRange(todos);

        var titleDefaults = new List<TitleDefault>
        {
            new() { NormalizedTitle = "whole foods market", Categories = [S("he")] },
            new() { NormalizedTitle = "city power & light", Categories = [S("pf")] },
            new() { NormalizedTitle = "acme corp payroll", Categories = [S("pf")] },
        };
        db.TitleDefaults.AddRange(titleDefaults);

        db.SaveChanges();
    }
}
