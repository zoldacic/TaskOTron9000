---
name: verify-ui
description: Verify a UI or visual change in the running TASK-O-TRON 9000 app (Angular :4200 + .NET :5249) by driving the in-app browser. Use this whenever you've edited frontend code — styles, templates, components, i18n — and want to confirm it actually renders/behaves as intended, or when the user asks to "check", "see", "look at", "confirm", or "verify" how something looks or works in the app. Reach for it even when the user just says "does it work?" after a UI edit. It encodes the project-specific traps (screenshots hang, the backend won't survive a background shell) that otherwise waste a lot of time.
---

# Verify UI changes in TASK-O-TRON 9000

The point of this skill is to *see the change working in the real app*, not just trust that the code looks right. Angular's dev server hot-reloads on save, so verifying a frontend edit is usually fast — but this app has two traps that will burn time if you don't know them (screenshots hang; a backend started in a tool shell dies). This skill routes around both.

## The golden rules (read these first)

1. **Never use the browser `screenshot` action against this app.** The renderer hangs on capture and the tool times out. To "see" the page, read its DOM instead — `read_page` (accessibility tree), `get_page_text` (visible text), and `javascript_tool` (computed styles, live values). These are faster and more precise than a screenshot anyway.

2. **Frontend changes hot-reload — don't rebuild.** Editing anything under `web/src` triggers `ng serve` to recompile and the browser to live-reload. After an edit, just re-navigate or re-read the page. No `ng build`, no server restart.

3. **The app is probably already running.** The user typically runs both processes in their own terminal, so ports 4200/5249 are already in use. Check before launching anything (see below). If it's *not* running, defer to the **start-app** skill rather than reinventing the launch.

4. **Don't restart the backend from a tool shell for a UI check.** A backend started via a background Bash/PowerShell task gets reaped (exit 127) shortly after it starts serving — it won't stay up. For a pure frontend/visual verification you don't need to touch the backend at all. If a change genuinely requires a backend restart, ask the user to restart it in their own terminal (see "When the change is backend-affecting").

## Step 1 — Make sure the app is up

Check the ports before doing anything:

```bash
curl -s -o /dev/null -w "frontend %{http_code}\n" http://localhost:4200; curl -s -o /dev/null -w "backend %{http_code}\n" http://localhost:5249/api/todos
```

- Both `200` → you're ready, go to Step 2.
- Frontend down → run the **start-app** skill (or ask the user to `ng serve`).
- Backend down but you're only checking a visual/layout change → that's fine, proceed; the page still renders.

## Step 2 — Open the page in the in-app browser

Use the in-app browser (`mcp__Claude_Browser__*`), not Chrome. Open a preview if one isn't already open, then navigate to the specific view your change affects:

```
preview_start { "url": "http://localhost:4200" }
navigate     { "url": "http://localhost:4200/import" }   # or the relevant route
```

Known routes: `/tasks` (default — `/` redirects here), `/categories`, `/import`, `/reports`, plus dialogs that open over the current view (task, category-rename, import-cat, import-split, confirm, save-query).

## Step 3 — Verify by reading the DOM, not by looking

Pick the check that matches what you changed:

**Layout / structure / text present** — `read_page` (filter `interactive` for controls, `all` for everything) or `get_page_text`. Use `find` to locate an element and get its `ref_N`.

**A CSS / style change** (spacing, color, position, a moved arrow, a font) — read the *computed* style with `javascript_tool`. This is the ground truth the user sees. Example that verified a dropdown-arrow inset:

```js
(() => {
  const el = document.querySelector('select.input');
  const cs = getComputedStyle(el);
  return { backgroundPosition: cs.backgroundPosition, paddingRight: cs.paddingRight };
})();
```

**Interactive behavior** (a button opens a dialog, a field updates state) — drive it with `computer` (click via `ref` or coordinate) and `form_input`, then re-read the DOM to confirm the result. Reproducing the state may take a few clicks (e.g., paste sample import rows, then open a row's dialog).

**Console / network errors** — after exercising the change, check `read_console_messages` (`onlyErrors: true`) and `read_network_requests` for failed calls. A silent JS error can make a change *look* broken when the code is fine, or vice-versa.

## Step 4 — Report what you actually observed

State the observed value, not just "done": e.g. "computed `background-position` is now `calc(100% - 14px)`, so the arrow sits 14px in from the edge" beats "fixed the arrow." If something's off, read more DOM/console before re-editing — guessing wastes a hot-reload cycle.

## When the change is backend-affecting

Some UI depends on backend behavior (an endpoint's response, a new field, seeded data). The frontend hot-reloads, but backend code does **not** — and you can't reliably keep a backend alive from a tool shell.

- If you edited backend C#, verify it **compiles** (`dotnet build src/TaskOTron.Api`) — but note this fails with a file-lock error (`MSB3027`) while the app is running; that's the running exe being locked, not a code error. Look for `CS####` errors specifically.
- To actually see the new behavior in the UI, the running backend must be restarted with the new build — **ask the user to do that in their terminal.** Don't fight the exit-127 reaping.
- Pitfall: `dotnet run --no-build` can reuse a **stale DLL** compiled mid-edit (e.g. an EF model/snapshot mismatch throwing `PendingModelChangesWarning` on startup). If you must build, do a fresh `dotnet build` first so the DLL matches current source.

## i18n reminder

If your change adds visible text, it must go through `store.t('key')` with the key defined in **both** `web/src/app/core/i18n/en.ts` and `sv.ts` — never hardcode strings. When verifying, the page renders in the currently selected language; confirm the key resolves (you'll see the real text, not the raw `some.key`).
