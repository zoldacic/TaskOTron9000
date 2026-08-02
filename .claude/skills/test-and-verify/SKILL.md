---
name: test-and-verify
description: Prove a TASK-O-TRON 9000 change actually works — run the automated suites (Vitest via `ng test`, xUnit via `dotnet test`, `ng build`) and then exercise the change in the real app by driving Chrome through the chrome-devtools MCP server. Use this after implementing any feature or fix, and whenever the user says "run the tests", "verify it", "check it works", "does it work?", "make sure I didn't break anything", or asks for proof before committing. Reach for it even when the change looks obviously correct — it encodes the traps that make verification silently lie to you (zoneless Angular renders after your read, the single-spec vitest command doesn't work, the real user database is one endpoint away).
---

# Test and verify a change in TASK-O-TRON 9000

Two halves, both needed. The suites catch regressions in the ported prototype logic; Chrome catches
everything the suites can't see — a template that doesn't bind, a filter that never re-renders, a
translation key that resolves to itself. Passing tests plus "the code looks right" is not verification.

Report what you **observed** (`computed border-left is 2px rgb(255,176,32)`, `filter returned 2 of 3
rows`), not that you're confident. A verification that can't produce an observed value didn't happen.

## 1. Run the suites

Frontend, from `web/`:

```bash
npx ng test
```

The whole suite is ~9s (6 files / 36 tests as of this writing), so **default to running all of it** —
narrowing rarely pays.

Do **not** use `npx vitest run <path-to-spec>` to run one spec. It fails with
`ReferenceError: describe is not defined`: the globals come from the `@angular/build:unit-test`
builder config, not a standalone vitest config, so vitest invoked directly has no
`describe`/`it`/`expect`. When you do want a single spec, filter through the builder instead:

```bash
npx ng test --include=src/app/core/bank-import.spec.ts
```

If you added a spec and want to confirm it actually ran (a new file in the wrong place silently
contributes zero tests), check the names rather than the count:

```bash
npx ng test --reporters=verbose
```

Backend, from the repo root — only when you touched C#:

```bash
dotnet test
```

31 xUnit tests covering `ImportParser` and `ReportBuilder`, ~30s cold. This works fine with the app
running; the `MSB3027` file-lock failure that verify-ui warns about comes from `dotnet build` on the
running project, not from the test project.

Then the production build, which is the only thing that typechecks templates and enforces the CSS
budgets:

```bash
npx ng build
```

Two things to look for in its output:

- **Template type errors** surface here and nowhere else. `ng test` will not catch a bad binding.
- **`anyComponentStyle` budget warnings** (4.00 kB per component). `report-view.component.ts`
  already breaches it by ~1 kB — that one is pre-existing and not yours. A warning for a file *you*
  edited means your CSS pushed it over. Prefer reusing the global classes in `web/src/styles.css`
  (`.tag` + a variant, `.btn-icon`, `.seg`) over adding local rules; that usually gets you back under
  while also making the change look native to the design system.

PowerShell note: piping a native command through `2>&1` makes PowerShell wrap the first stderr line
in a `NativeCommandError` banner. It looks alarming and means nothing — read past it to the summary.
`npx ng test 2>&1 | Select-String -Pattern "Test Files|Tests |error"` is a good way to keep the
output small.

## 2. Get the app up

```bash
curl -sk -o /dev/null -w "frontend %{http_code}\n" https://localhost:4200; curl -s -o /dev/null -w "backend %{http_code}\n" http://localhost:5249/api/todos
```

Both `200` → go to step 3. Otherwise use the **start-app** skill rather than improvising the launch
(Node isn't on the tool shells' PATH by default, and the backend must be up before `ng serve` proxies
to it). Starting both via the PowerShell tool with `run_in_background` does work and they stay up for
the session. If the backend does die mid-verification, don't fight it — ask the user to run
`dotnet run --project src/TaskOTron.Api` in their own terminal.

Frontend edits hot-reload. After an edit, wait ~700ms and re-read the DOM; never rebuild or restart
for a `web/src` change. Backend C# does *not* hot-reload — a restart is needed to see new API
behavior.

## 3. Protect the real database first

`src/TaskOTron.Api/taskotron.db` holds the user's **real imported tasks** and does not reseed. Before
driving anything, know which of the actions you're about to take write to it.

Most flows have a read-only half you can lean on: `POST /api/import/parse` only parses text and reads
title defaults, while `POST /api/import/commit` inserts tasks. So the entire import preview — parsing,
filtering, sorting, categorising, splitting, deleting rows — can be exercised without writing a byte,
as long as you never click the final Import button.

Take a count before and after, and state it in your report:

```bash
$r = Invoke-RestMethod http://localhost:5249/api/todos; "todos: $($r.Count)"
```

When a check genuinely requires writing (you're verifying a save path), do it, then revert it through
the API and re-check the count. Never leave test data behind.

Reading a few real rows is also the cheapest way to build realistic input — e.g. to test duplicate
detection, echo back the title/date/amount of tasks that already exist.

## 4. Drive Chrome

The `mcp__chrome-devtools__*` tools are deferred; load what you need in **one** call:

```
ToolSearch "select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__new_page,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_snapshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__click,mcp__chrome-devtools__fill,mcp__chrome-devtools__list_console_messages"
```

Add `emulate` / `take_screenshot` / `resize_page` when the check is about breakpoints or looks. Then
`new_page` at the route: `/tasks` (default), `/categories`, `/import`, `/reports`.

If those tools aren't available at all, the MCP server hasn't started — say so and ask the user to
restart Claude Code. Don't quietly downgrade to "the code looks correct."

### The trap that will fool you: this app is zoneless

Angular is running zoneless, so a click schedules a render — it does not perform one. Clicking and
reading the DOM in the same synchronous `evaluate_script` returns the **pre-render** state, which
looks exactly like a broken feature. Make the function `async` and yield between acting and reading:

```js
async () => {
  const tick = (ms = 60) => new Promise(r => setTimeout(r, ms));
  const seg = [...document.querySelectorAll('.filters .seg')][1];
  const click = async (label) => {
    [...seg.querySelectorAll('button')].find(b => b.textContent.trim() === label).click();
    await tick();
  };
  const titles = () => [...document.querySelectorAll('.trow .t-title')].map(t => t.textContent.trim());
  const out = {};
  await click('Duplicates'); out.onlyDuplicates = titles();
  await click('New only');   out.newOnly = titles();
  await click('All');        out.all = titles();
  return out;                // one call, three states, one JSON object
}
```

That shape — act, yield, read, accumulate into one returned object — is the workhorse here. It beats
snapshot/click/snapshot round trips on both speed and precision, and returning several states at once
makes an off-by-one filter obvious. Use ~400ms after anything that hits the API (parse, load, save).

### Reading, not looking

Prefer ground truth over impressions:

- **Structure / text present** → `take_snapshot` (also gives the `uid`s for `click`/`fill`).
- **Styles** → `getComputedStyle` in `evaluate_script`. `borderLeftColor` returning
  `rgb(255, 176, 32)` proves `--color-amber` landed; a screenshot only suggests it.
- **Layout / overlap / alignment** → `getBoundingClientRect()`. When you add a grid column, assert
  that `.thead` and `.cells` have identical `gridTemplateColumns`, that the new control sits inside
  its container's right edge, and that `document.body.scrollWidth <= clientWidth` (no sideways
  scroll). Misaligned headers and a hairline horizontal scrollbar are both invisible in a screenshot
  at a glance.
- **Genuinely visual questions** → `take_screenshot`, second. It works through chrome-devtools (the
  in-app browser's screenshot hangs on this app), and it's the right call for "does this badge read
  as a warning" — just don't use it to answer questions a computed value answers better.
- **Console / network** → finish with `list_console_messages` (types `["error","warn"]`). A silent JS
  error makes a working change look broken and vice versa.

### Inputs Angular is listening to

Setting `.value` on an input isn't enough — the signal binding listens for events. Dispatch one:

```js
const ta = document.querySelector('textarea.paste');
ta.value = '2026-06-30\tBAHNHOF\t-359.00';
ta.dispatchEvent(new Event('input', { bubbles: true }));
```

This is also the only practical way to enter tab-separated import text, which `fill` can't type.

### Responsive checks

`resize_page` cannot go below ~500px on Windows (the window has an OS minimum; `innerWidth` stays
501), and CSS `zoom` does **not** re-evaluate media queries — it squeezes the grid while the wide rule
still applies, which is worse than not testing. Use device emulation, which does drive media queries:

```
emulate  viewport: "390x844x2,mobile,touch"     # hits the ≤420px rules
emulate  viewport: "1280x900x1"                 # back to desktop
```

Changing emulation can reset page state, so re-establish whatever you had parsed or typed afterwards.

### i18n

Every user-facing string goes through `store.t()` with keys in both `en.ts` and `sv.ts`. Verify both:
click the EN/SV control in the title bar, re-render, and read the strings back. You're checking that
real text appears — a raw `import.duplicate` on screen means the key is missing. The chrome-devtools
profile is throwaway, so anything the app persists in `localStorage` (language, layout, remembered
import category) starts at its default every session; set it explicitly if your check depends on it.

## 5. Report

Lead with the observed values, and be explicit about what you did **not** verify — an unverified
corner stated plainly is far more useful than a blanket "verified". A good report closes the loop on
data safety too: "73 todos before and after, nothing committed."

For a quick "how does this look" with no behavior to prove, the lighter **verify-ui** skill is enough.
Come here when something has to be shown to actually work.
