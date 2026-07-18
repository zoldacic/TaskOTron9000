using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Main> Mains => Set<Main>();
    public DbSet<Sub> Subs => Set<Sub>();
    public DbSet<Todo> Todos => Set<Todo>();
    public DbSet<TitleDefault> TitleDefaults => Set<TitleDefault>();

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

        b.Entity<Todo>(e =>
        {
            e.Property(t => t.Amount).HasColumnType("TEXT"); // preserve decimal precision on SQLite
            e.Property(t => t.DateKind).HasConversion<string>();
            // Todo <-> Sub many-to-many (the prototype's catIds[]).
            // Deleting a sub strips it from every task (join rows cascade automatically).
            e.HasMany(t => t.Categories)
                .WithMany(s => s.Todos)
                .UsingEntity("TodoSub");
        });

        b.Entity<TitleDefault>(e =>
        {
            e.HasKey(td => td.NormalizedTitle);
            // Deleting a sub also strips it from remembered title defaults.
            e.HasMany(td => td.Categories)
                .WithMany(s => s.TitleDefaults)
                .UsingEntity("TitleDefaultSub");
        });
    }
}
