using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

public static class BankAccountEndpoints
{
    public static void MapBankAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/bank-accounts");

        g.MapGet("", async (AppDbContext db) =>
        {
            var accounts = await db.BankAccounts.OrderBy(a => a.Name).AsNoTracking()
                .Select(a => new BankAccountDto(a.Id, a.Name, a.Todos.Count)).ToListAsync();
            return Results.Ok(accounts);
        });

        g.MapPost("", async (BankAccountWriteDto dto, AppDbContext db) =>
        {
            var name = dto.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Name is required.");
            if (await db.BankAccounts.AnyAsync(a => a.Name == name))
                return Results.Conflict($"A bank account named '{name}' already exists.");
            var id = await UniqueId(db, "b", async gid => await db.BankAccounts.AnyAsync(a => a.Id == gid));
            var a = new BankAccount { Id = id, Name = name };
            db.BankAccounts.Add(a);
            await db.SaveChangesAsync();
            return Results.Created($"/api/bank-accounts/{a.Id}", new BankAccountDto(a.Id, a.Name, 0));
        });

        // A bank account can only be deleted when no saved task uses it.
        g.MapDelete("/{id}", async (string id, AppDbContext db) =>
        {
            var a = await db.BankAccounts.FindAsync(id);
            if (a is null) return Results.NotFound();
            var used = await db.Todos.CountAsync(t => t.BankAccountId == id);
            if (used > 0)
                return Results.Conflict($"Can't delete — {used} task{(used == 1 ? "" : "s")} still use this account.");
            db.BankAccounts.Remove(a);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    // Backend-generated string id, mirroring the 'm'/'s' + timestamp scheme in CategoryEndpoints.
    private static async Task<string> UniqueId(AppDbContext db, string prefix, Func<string, Task<bool>> exists)
    {
        var baseTs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        for (var bump = 0; ; bump++)
        {
            var id = prefix + (baseTs + bump);
            if (!await exists(id)) return id;
        }
    }
}
