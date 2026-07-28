---
name: verify-ui
description: Verify a UI or visual change in the running TASK-O-TRON 9000 app (Angular :4200 + .NET :5249) by driving Chrome via the chrome-devtools MCP server. Use this whenever you've edited frontend code — styles, templates, components, i18n — and want to confirm it actually renders/behaves as intended, or when the user asks to "check", "see", "look at", "confirm", or "verify" how something looks or works in the app. Reach for it even when the user just says "does it work?" after a UI edit. It encodes the project-specific traps (the backend won't survive a background shell) that otherwise waste a lot of time.
---

# Verify UI changes in TASK-O-TRON 9000

The point of this skill is to *see the change working in the real app*, not just trust that the code looks right. Angular's dev server hot-reloads on save, so verifying a frontend edit is usually fast.

> Scope: this is the quick look — open the page, confirm it renders the way you meant. When the change has *behavior* that has to be proven (interactions, filtering, state, anything touching data) or the suites need running too, use the **test-and-verify** skill instead; it covers the same Chrome tooling plus the zoneless-render, device-emulation and real-database pitfalls in more depth.

## The golden rules (read these first)

1. **Drive Chrome through the `mcp__chrome-devtools__*` tools.** They're configured in the repo's `.mcp.json`. If those tools aren't in your session, the MCP server hasn't been approved/started yet — say so and ask the user to restart Claude Code rather than silently skipping verification. **Never claim a change is verified when you couldn't actually open the page.**

2. **Prefer reading the DOM over screenshots.** `take_snapshot` (accessibility tree) and `evaluate_script` (computed styles, live values) are faster and far more precise than an image — a computed `padding-right` is ground truth in a way "looks about right" isn't. `take_screenshot` is available and worth using when the question is genuinely visual (overlap, alignment, something clipped), but reach for it second.

3. **Frontend changes hot-reload — don't rebuild.** Editing anything under `web/src` triggers `ng serve` to recompile and the browser to live-reload. After an edit, just re-navigate or re-snapshot. No `ng build`, no server restart.

4. **The app is probably already running.** The user typically runs both processes in their own terminal, so ports 4200/5249 are already in use. Check before launching anything (see below). If it's *not* running, defer to the **start-app** skill rather than reinventing the launch.

5. **Don't restart the backend from a tool shell for a UI check.** A backend started via a background Bash/PowerShell task gets reaped (exit 127) shortly after it starts serving — it won't stay up. For a pure frontend/visual verification you don't need to touch the backend at all. If a change genuinely requires a backend restart, ask the user to restart it in their own terminal (see "When the change is backend-affecting").

## Step 1 — Make sure the app is up

Check the ports before doing anything:

```bash
curl -s -o /dev/null -w "frontend %{http_code}\n" http://localhost:4200; curl -s -o /dev/null -w "backend %{http_code}\n" http://localhost:5249/api/todos
```

- Both `200` → you're ready, go to Step 2.
- Frontend down → run the **start-app** skill (or ask the user to `ng serve`).
- Backend down but you're only checking a visual/layout change → that's fine, proceed; the page still renders.

## Step 2 — Open the page in Chrome

The MCP server launches and manages its own Chrome instance with a throwaway profile, so the first navigation may take a few seconds while Chrome starts.

```
list_pages                                              # reuse a tab if one is already open
new_page      { "url": "http://localhost:4200/import" } # or navigate_page on an existing tab
```

Known routes: `/tasks` (default — `/` redirects here), `/categories`, `/import`, `/reports`, plus dialogs that open over the current view (task, category-rename, import-cat, import-split, confirm, save-query).

Because the profile is throwaway, anything the app persists in `localStorage` (language choice, layout toggle) starts at its default each session — set it explicitly if your check depends on it.

## Step 3 — Verify by reading the DOM, not by looking

Pick the check that matches what you changed:

**Layout / structure / text present** — `take_snapshot` returns the accessibility tree plus the `uid`s you need to interact with elements.

**A CSS / style change** (spacing, color, position, a moved arrow, a font) — read the *computed* style with `evaluate_script`. This is the ground truth the user sees:

```js
() => {
  const el = document.querySelector('select.input');
  const cs = getComputedStyle(el);
  return { backgroundPosition: cs.backgroundPosition, paddingRight: cs.paddingRight };
}
```

`evaluate_script` takes a function; return a JSON-serializable value. It's also the best way to check things the a11y tree won't show you — element counts, `getBoundingClientRect()` for overlap, whether a class is applied.

**Interactive behavior** (a button opens a dialog, a field updates state) — drive it with `click` / `fill` / `fill_form` using `uid`s from the snapshot, then re-snapshot to confirm the result. Reproducing the state may take a few steps (e.g., click "Load sample", then "Parse rows", then open a row's dialog).

**Console / network errors** — after exercising the change, check `list_console_messages` and `list_network_requests` for failed calls. A silent JS error can make a change *look* broken when the code is fine, or vice-versa.

## Step 4 — Report what you actually observed

State the observed value, not just "done": e.g. "computed `background-position` is now `calc(100% - 14px)`, so the arrow sits 14px in from the edge" beats "fixed the arrow." If something's off, read more DOM/console before re-editing — guessing wastes a hot-reload cycle.

## When the change is backend-affecting

Some UI depends on backend behavior (an endpoint's response, a new field, seeded data). The frontend hot-reloads, but backend code does **not** — and you can't reliably keep a backend alive from a tool shell.

- If you edited backend C#, verify it **compiles** (`dotnet build src/TaskOTron.Api`) — but note this fails with a file-lock error (`MSB3027`) while the app is running; that's the running exe being locked, not a code error. Look for `CS####` errors specifically.
- To actually see the new behavior in the UI, the running backend must be restarted with the new build — **ask the user to do that in their terminal.** Don't fight the exit-127 reaping.
- Pitfall: `dotnet run --no-build` can reuse a **stale DLL** compiled mid-edit (e.g. an EF model/snapshot mismatch throwing `PendingModelChangesWarning` on startup). If you must build, do a fresh `dotnet build` first so the DLL matches current source.

## i18n reminder

If your change adds visible text, it must go through `store.t('key')` with the key defined in **both** `web/src/app/core/i18n/en.ts` and `sv.ts` — never hardcode strings. When verifying, the page renders in the currently selected language; confirm the key resolves (you'll see the real text, not the raw `some.key`).

## Attaching to your own Chrome instead

The default throwaway profile is usually what you want. If you'd rather have the agent drive the Chrome window you already have the app open in, start Chrome with remote debugging:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug-profile"
```

then add `"--browser-url", "http://127.0.0.1:9222"` to the server's `args` in `.mcp.json`. Note this drives your real tabs — the agent can navigate away from whatever you were looking at.
