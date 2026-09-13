using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Main> Mains => Set<Main>();
    public DbSet<Sub> Subs => Set<Sub>();
    public DbSet<Todo> Todos => Set<Todo>();
    public DbSet<TitleDefault> TitleDefaults => Set<TitleDefault>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<SavedQuery> SavedQueries => Set<SavedQuery>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<BudgetItem> BudgetItems => Set<BudgetItem>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Main>(e =>
        {
            e.Property(m => m.Id).ValueGeneratedNever();
        });

        b.Entity<Sub>(e =>
        {
            e.Property(s => s.Id).ValueGeneratedNever();
            // Deleting a main deletes its subs (removeMain in the prototype).
            e.HasOne(s => s.Main)
                .WithMany(m => m.Subs)
                .HasForeignKey(s => s.MainId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<BankAccount>(e =>
        {
            e.Property(a => a.Id).ValueGeneratedNever();
        });

        b.Entity<SavedQuery>(e =>
        {
            e.Property(q => q.Id).ValueGeneratedNever();
        });

        b.Entity<Todo>(e =>
        {
            e.Property(t => t.Amount).HasColumnType("TEXT"); // preserve decimal precision on SQLite
            e.Property(t => t.DateKind).HasConversion<string>();
            // A task's bank account. Restrict delete so an account in use can't be removed
            // (the API guards this too, returning a friendly 409).
            e.HasOne(t => t.BankAccount)
                .WithMany(a => a.Todos)
                .HasForeignKey(t => t.BankAccountId)
                .OnDelete(DeleteBehavior.Restrict);
            // The required single main category. Restrict delete so a main in use
            // as a task's category can't be removed (the API guards this too, 409).
            e.HasOne(t => t.Main)
                .WithMany()
                .HasForeignKey(t => t.MainId)
                .OnDelete(DeleteBehavior.Restrict);
            // Todo <-> Sub many-to-many (the prototype's catIds[]).
            // Deleting a sub strips it from every task (join rows cascade automatically).
            e.HasMany(t => t.Categories)
                .WithMany(s => s.Todos)
                .UsingEntity("TodoSub");
        });

        b.Entity<Budget>(e =>
        {
            e.Property(bu => bu.Id).ValueGeneratedNever();
        });

        b.Entity<BudgetItem>(e =>
        {
            // Preserve decimal precision on SQLite, like Todo.Amount.
            e.Property(i => i.Amount).HasColumnType("TEXT");
            e.Property(i => i.Quantity).HasColumnType("TEXT");
            e.Property(i => i.UnitPrice).HasColumnType("TEXT");
            // Deleting a budget deletes its items.
            e.HasOne(i => i.Budget)
                .WithMany(bu => bu.Items)
                .HasForeignKey(i => i.BudgetId)
                .OnDelete(DeleteBehavior.Cascade);
            // Deliberately SetNull, unlike Todo.Main (Restrict): a plan must not block category
            // management — deleting a main just leaves the item uncategorized.
            e.HasOne(i => i.Main)
                .WithMany()
                .HasForeignKey(i => i.MainId)
                .OnDelete(DeleteBehavior.SetNull);
            // Deleting a sub strips it from every budget item (join rows cascade automatically).
            e.HasMany(i => i.Categories)
                .WithMany(s => s.BudgetItems)
                .UsingEntity("BudgetItemSub");
        });

        b.Entity<TitleDefault>(e =>
        {
            e.HasKey(td => td.NormalizedTitle);
            // Remembered main category. SetNull so deleting a main just clears the
            // remembered default rather than blocking the delete.
            e.HasOne(td => td.Main)
                .WithMany()
                .HasForeignKey(td => td.MainId)
                .OnDelete(DeleteBehavior.SetNull);
            // Deleting a sub also strips it from remembered title defaults.
            e.HasMany(td => td.Categories)
                .WithMany(s => s.TitleDefaults)
                .UsingEntity("TitleDefaultSub");
        });
    }
}
