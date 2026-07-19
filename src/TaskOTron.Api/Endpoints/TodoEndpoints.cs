using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Models;

namespace TaskOTron.Api.Endpoints;

public static class TodoEndpoints
{
    public static void MapTodoEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/todos");

        g.MapGet("", async (AppDbContext db) =>
        {
            var todos = await db.Todos.Include(t => t.Categories).AsNoTracking().ToListAsync();
            return Results.Ok(todos.Select(t => t.ToDto()));
        });

        g.MapGet("/{id:int}", async (int id, AppDbContext db) =>
        {
            var t = await db.Todos.Include(x => x.Categories).FirstOrDefaultAsync(x => x.Id == id);
            return t is null ? Results.NotFound() : Results.Ok(t.ToDto());
        });

        g.MapPost("", async (TodoWriteDto dto, AppDbContext db) =>
        {
            var title = dto.Title?.Trim();
            if (string.IsNullOrEmpty(title))
                return Results.BadRequest("Title is required.");
            if (!await BankAccountValid(db, dto.BankAccountId))
                return Results.BadRequest($"Unknown bank account '{dto.BankAccountId}'.");

            var t = new Todo
            {
                Title = title,
                Done = false,
                Due = Mapping.ParseDate(dto.Due),
                Amount = dto.Amount,
                DateKind = dto.DateKind,
                BankAccountId = dto.BankAccountId,
                Categories = await LoadSubs(db, dto.CatIds),
            };
            db.Todos.Add(t);
            await db.SaveChangesAsync();
            return Results.Created($"/api/todos/{t.Id}", t.ToDto());
        });

        g.MapPut("/{id:int}", async (int id, TodoWriteDto dto, AppDbContext db) =>
        {
            var t = await db.Todos.Include(x => x.Categories).FirstOrDefaultAsync(x => x.Id == id);
            if (t is null) return Results.NotFound();

            var title = dto.Title?.Trim();
            if (string.IsNullOrEmpty(title))
                return Results.BadRequest("Title is required.");
            if (!await BankAccountValid(db, dto.BankAccountId))
                return Results.BadRequest($"Unknown bank account '{dto.BankAccountId}'.");

            t.Title = title;
            t.Due = Mapping.ParseDate(dto.Due);
            t.Amount = dto.Amount;
            t.DateKind = dto.DateKind;
            t.BankAccountId = dto.BankAccountId;
            t.Categories.Clear();
            foreach (var s in await LoadSubs(db, dto.CatIds)) t.Categories.Add(s);
            // Done is intentionally preserved (matches the prototype's edit path).

            await db.SaveChangesAsync();
            return Results.Ok(t.ToDto());
        });

        g.MapPatch("/{id:int}/toggle", async (int id, AppDbContext db) =>
        {
            var t = await db.Todos.Include(x => x.Categories).FirstOrDefaultAsync(x => x.Id == id);
            if (t is null) return Results.NotFound();
            t.Done = !t.Done;
            await db.SaveChangesAsync();
            return Results.Ok(t.ToDto());
        });

        g.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
        {
            var t = await db.Todos.FirstOrDefaultAsync(x => x.Id == id);
            if (t is null) return Results.NotFound();
            db.Todos.Remove(t);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }

    private static async Task<List<Sub>> LoadSubs(AppDbContext db, List<string>? ids)
    {
        if (ids is null || ids.Count == 0) return [];
        return await db.Subs.Where(s => ids.Contains(s.Id)).ToListAsync();
    }

    private static async Task<bool> BankAccountValid(AppDbContext db, string? id)
    {
        if (string.IsNullOrEmpty(id)) return true; // null = no account
        return await db.BankAccounts.AnyAsync(a => a.Id == id);
    }
}
