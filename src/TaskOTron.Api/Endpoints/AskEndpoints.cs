using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.EntityFrameworkCore;
using TaskOTron.Api.Data;
using TaskOTron.Api.Dtos;
using TaskOTron.Api.Services;

namespace TaskOTron.Api.Endpoints;

/// <summary>
/// Answers questions about the user's tasks.
///
/// Claude is given tools (see <see cref="AskTools"/>) rather than the whole
/// dataset, so the cost of a question does not grow with the size of the
/// database and totals come from the same code as the Reports view. Only the
/// category tree — small, stable, and needed to phrase any query — goes in the
/// prompt.
///
/// The call lives on the server so the API key never reaches the browser. The
/// loop is written out by hand rather than using the SDK's tool runner because
/// we want the answer token-by-token, and the runner hands back whole messages.
/// </summary>
public static class AskEndpoints
{
    private const string Model = "claude-opus-5";
    /// <summary>Stops a misbehaving conversation from looping on tool calls forever.</summary>
    private const int MaxToolTurns = 8;

    private static readonly string SystemPrompt = string.Join("\n", [
        "You are the assistant built into TASK-O-TRON 9000, a single-user desktop task manager that also",
        "tracks money: bank statements are imported so each transaction becomes a task with an amount, a",
        "date and categories.",
        "",
        "You cannot see the tasks directly — use the tools to look them up, and answer only from what they",
        "return. Call spending_report when the question is about totals; it does the arithmetic exactly.",
        "Call query_tasks when the user wants to see or count individual transactions. Look things up",
        "rather than guessing, and if the tools come back empty, say so instead of inventing rows.",
        "",
        "Amounts are SEK: negative is money out, positive is money in. When you report spending, state it",
        "as a positive amount spent unless the sign itself is the point. Dates are ISO yyyy-MM-dd.",
        "",
        "Keep answers short and direct. Plain prose and small lists; no headers or tables unless the answer",
        "really is tabular. Show the rows behind a total when it helps the user check it.",
        "",
        "Answer in the language the user writes in. The task titles and category names are Swedish; that is",
        "a property of the data, not a cue about which language to reply in. An English question gets an",
        "English answer, with the Swedish category and merchant names quoted as they are.",
    ]);

    public static void MapAskEndpoints(this IEndpointRouteBuilder app)
    {
        // Lets the UI show a setup hint instead of firing a request that can only fail.
        app.MapGet("/api/ask/status", (IConfiguration config) =>
            Results.Ok(new AskStatusDto(ApiKey(config) is not null, Model)));

        // Streams the answer back as newline-delimited JSON events. The client sends
        // the whole conversation each time; the server holds no state.
        app.MapPost("/api/ask", async (AskRequest req, HttpContext ctx, AppDbContext db, IConfiguration config) =>
        {
            var key = ApiKey(config);
            if (key is null)
                return Results.Problem("No Anthropic API key configured on the server.", statusCode: 503);

            var turns = (req.Messages ?? [])
                .Where(m => !string.IsNullOrWhiteSpace(m.Content))
                .ToList();
            if (turns.Count == 0)
                return Results.BadRequest(new { error = "No messages." });

            var context = await BuildContextAsync(db, ctx.RequestAborted);

            ctx.Response.ContentType = "application/x-ndjson; charset=utf-8";
            // Events must reach the browser as they happen, not when a buffer fills.
            ctx.Response.Headers["X-Accel-Buffering"] = "no";
            ctx.Response.Headers.CacheControl = "no-cache";

            var client = new AnthropicClient { ApiKey = key };
            var messages = turns
                .Select(m => new MessageParam
                {
                    Role = m.Role == "assistant" ? Role.Assistant : Role.User,
                    Content = m.Content,
                })
                .ToList();

            try
            {
                await RunLoopAsync(client, db, ctx, messages, context);
            }
            catch (OperationCanceledException)
            {
                // The user navigated away or pressed stop — nothing to report.
            }
            catch (Exception ex) when (!ctx.Response.HasStarted)
            {
                return Results.Problem(ex.Message, statusCode: 502);
            }
            catch (Exception ex)
            {
                await Emit(ctx, new { t = "error", v = ex.Message }, CancellationToken.None);
            }

            return Results.Empty;
        });
    }

    /// <summary>
    /// Requests an answer, runs any tools Claude asks for, and repeats until it
    /// stops asking. Text is forwarded to the client as it is generated.
    /// </summary>
    private static async Task RunLoopAsync(
        AnthropicClient client, AppDbContext db, HttpContext ctx, List<MessageParam> messages, string context)
    {
        var ct = ctx.RequestAborted;
        var tools = AskTools.Definitions();

        for (var turn = 0; turn < MaxToolTurns; turn++)
        {
            var parameters = new MessageCreateParams
            {
                Model = Model,
                MaxTokens = 32000,
                // Instructions and the category tree are identical between questions,
                // so cache them: follow-ups re-read the block instead of re-paying.
                System = new List<TextBlockParam>
                {
                    new() { Text = SystemPrompt },
                    new() { Text = context, CacheControl = new CacheControlEphemeral() },
                },
                // Thinking is on by default on Opus 5; medium effort keeps answers quick
                // without giving up the judgement needed to pick the right query.
                OutputConfig = new OutputConfig { Effort = Effort.Medium },
                Tools = tools,
                Messages = messages,
            };

            var (text, toolUses) = await StreamTurnAsync(client, ctx, parameters, ct);

            if (toolUses.Count == 0)
                return; // Claude answered; the text is already with the client.

            // Echo the assistant turn back, then answer each tool call in one user turn.
            var assistant = new List<ContentBlockParam>();
            if (text.Length > 0) assistant.Add(new TextBlockParam { Text = text.ToString() });
            foreach (var u in toolUses)
                assistant.Add(new ToolUseBlockParam { ID = u.Id, Name = u.Name, Input = u.Input });
            messages.Add(new MessageParam { Role = Role.Assistant, Content = assistant });

            var results = new List<ContentBlockParam>();
            foreach (var u in toolUses)
            {
                var (result, summary) = await AskTools.RunAsync(u.Name, u.Input, db, ct);
                await Emit(ctx, new { t = "tool", v = summary }, ct);
                results.Add(new ToolResultBlockParam { ToolUseID = u.Id, Content = result });
            }
            messages.Add(new MessageParam { Role = Role.User, Content = results });
        }

        await Emit(ctx, new { t = "error", v = $"Gave up after {MaxToolTurns} tool rounds." }, ct);
    }

    private record PendingTool(string Id, string Name, Dictionary<string, JsonElement> Input);

    /// <summary>
    /// Streams one request, forwarding text as it arrives and rebuilding any
    /// tool calls from their JSON deltas.
    /// </summary>
    private static async Task<(StringBuilder Text, List<PendingTool> Tools)> StreamTurnAsync(
        AnthropicClient client, HttpContext ctx, MessageCreateParams parameters, CancellationToken ct)
    {
        var text = new StringBuilder();
        // Tool inputs arrive as a stream of JSON fragments, keyed by content block index.
        var building = new Dictionary<long, (string Id, string Name, StringBuilder Json)>();

        await foreach (var e in client.Messages.CreateStreaming(parameters, ct))
        {
            if (e.TryPickContentBlockStart(out var start))
            {
                if (start.ContentBlock.TryPickToolUse(out var tu))
                    building[start.Index] = (tu.ID, tu.Name, new StringBuilder());
            }
            else if (e.TryPickContentBlockDelta(out var delta))
            {
                if (delta.Delta.TryPickText(out var t))
                {
                    text.Append(t.Text);
                    await Emit(ctx, new { t = "text", v = t.Text }, ct);
                }
                else if (delta.Delta.TryPickInputJson(out var j) && building.TryGetValue(delta.Index, out var acc))
                {
                    acc.Json.Append(j.PartialJson);
                }
            }
        }

        var tools = new List<PendingTool>();
        foreach (var (_, b) in building.OrderBy(kv => kv.Key))
        {
            // A tool called with no arguments streams no JSON at all.
            var json = b.Json.Length > 0 ? b.Json.ToString() : "{}";
            var input = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json) ?? [];
            tools.Add(new PendingTool(b.Id, b.Name, input));
        }
        return (text, tools);
    }

    /// <summary>
    /// The category tree and account list: what Claude needs to name things in a
    /// query. Small and stable, so it rides in the prompt rather than a tool.
    /// </summary>
    private static async Task<string> BuildContextAsync(AppDbContext db, CancellationToken ct)
    {
        var mains = await db.Mains.Include(m => m.Subs).AsNoTracking().ToListAsync(ct);
        var accounts = await db.BankAccounts.AsNoTracking().ToListAsync(ct);
        var count = await db.Todos.CountAsync(ct);
        return AskContextBuilder.BuildCategoryContext(mains, accounts, count, DateOnly.FromDateTime(DateTime.Now));
    }

    private static async Task Emit(HttpContext ctx, object evt, CancellationToken ct)
    {
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(evt) + "\n", Encoding.UTF8, ct);
        await ctx.Response.Body.FlushAsync(ct);
    }

    /// <summary>Env var first (the usual place), then config so `dotnet user-secrets` works.</summary>
    private static string? ApiKey(IConfiguration config)
    {
        var key = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (string.IsNullOrWhiteSpace(key)) key = config["Anthropic:ApiKey"];
        return string.IsNullOrWhiteSpace(key) ? null : key;
    }
}
