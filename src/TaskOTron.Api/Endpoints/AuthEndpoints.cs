using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TaskOTron.Api.Services;

namespace TaskOTron.Api.Endpoints;

public record LoginRequest(string Username, string Password);
public record AuthStatusDto(bool Authenticated, bool IsLocal, string? Username);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth");

        // Always reachable (never gated) — the frontend calls this first to decide whether to
        // show the login screen at all, so it must not itself require login.
        g.MapGet("/status", (HttpContext ctx) =>
        {
            var isLocal = NetworkUtil.IsLocalRequest(ctx);
            var authenticated = ctx.User.Identity?.IsAuthenticated ?? false;
            return Results.Ok(new AuthStatusDto(authenticated, isLocal, authenticated ? ctx.User.Identity!.Name : null));
        });

        g.MapPost("/login", async (LoginRequest req, HttpContext ctx, IConfiguration config) =>
        {
            var configuredUser = config["Auth:Username"];
            var configuredHash = config["Auth:PasswordHash"];
            if (string.IsNullOrEmpty(configuredUser) || string.IsNullOrEmpty(configuredHash))
                return Results.Problem("No login is configured on the server yet.", statusCode: 500);

            var ok = string.Equals(req.Username, configuredUser, StringComparison.Ordinal)
                && PasswordHasher.Verify(req.Password ?? "", configuredHash);
            if (!ok)
            {
                // Same response either way — don't reveal whether the username was right.
                return Results.Unauthorized();
            }

            var claims = new[] { new Claim(ClaimTypes.Name, configuredUser) };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = true });
            return Results.Ok(new AuthStatusDto(true, NetworkUtil.IsLocalRequest(ctx), configuredUser));
        });

        g.MapPost("/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });
    }
}
