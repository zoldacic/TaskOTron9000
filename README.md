# Handoff: TASK-O-TRON — Todo app with categories, bank import & spending report

## Overview
A desktop task manager styled as a dark, "Windows 11" app. Beyond a normal to-do list it tracks **money amounts** per task, **imports bank statements** (each transaction becomes a task), and produces a **spending report** with a time-series chart and per-category breakdown. Tasks are organized under a two-level category tree (main → sub) and grouped by smart lists (Today / Upcoming / Completed / All).

## Screenshots
Reference renders of each view are in `screenshots/`:
- `01-tasks.png` — Tasks view (list layout)
- `02-categories.png` — Manage categories view
- `03-import-empty.png` — Import bank file view (before parsing)
- `04-import-parsed.png` — Import view with a parsed preview
- `05-report.png` — Spending report view

## About the design files
The file in this bundle — `Tasks.dc.html` — is a **design reference created in HTML**. It is a working prototype showing the intended look and behavior; it is **not production code to copy directly**. It is authored in a proprietary component format ("DC"): a `<x-dc>` HTML template with `{{ bindings }}` plus a `class Component` logic block near the bottom of the file. Read it for layout, styling, copy and logic — but **recreate it in your target codebase's own environment** (React, Vue, Svelte, SwiftUI, etc.) using that codebase's established patterns, state, and component libraries. If no environment exists yet, pick the most appropriate framework and build it there.

The logic block at the bottom of `Tasks.dc.html` is plain JavaScript and is the **source of truth for all behavior** — filtering, sorting, date logic, parsing, report math. Port it faithfully.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy and interactions are all present. Recreate the UI to match, using your codebase's component library where equivalents exist. Exact tokens are listed under **Design Tokens**.

---

## Design tokens

The app overrides the Modernist design-system stylesheet (`styles.css`) with a dark theme. Use these exact values.

**Colors**
- Background `--color-bg` = `#0a0c12`
- Surface (title bar, sidebar, cards) `--color-surface` = `#141826`
- Text `--color-text` = `#e8ebf5`
- Divider `--color-divider` = `color-mix(in srgb, #93a4cc 24%, transparent)` (a faint cool-gray line)
- Accent (red) `--color-accent` = `#ff3b1e`
- Positive / income green = `#37e07a`
- "Today" warning amber = `#ffb020`
- Overdue = accent red
- Faint grid overlay on task scroll area = `color-mix(in srgb, #93a4cc 5%, transparent)`

Tinted fills throughout use `color-mix(in srgb, var(--color-text) N%, transparent)` for subtle surfaces/hovers (N ≈ 3–14) and `color-mix(in srgb, var(--color-accent) 14%, transparent)` for active nav/filter rows.

**Typography**
- Headings: `--font-heading` (Archivo from the design system) — weight 800, uppercase, letter-spacing ~0.005–0.05em for titles.
- Body: `--font-body` (Archivo).
- Mono: `--font-mono` = "Space Mono" (Google Font, weights 400/700) — used for meta text, dates, amounts, counts, section kickers.
- Section kickers: 10px, uppercase, letter-spacing 0.14em, mono, muted (`--color-text` at 50%).
- Task title 15px/1.3; amounts 14px mono 700; stat-card figures 26px mono 700.

**Spacing** — uses the design system `--space-*` scale (multiples of a base unit). Zero border radius everywhere (`--radius-md` = 0). Rules between major sections are **2px solid** dividers; row separators are **1px**.

**Elevation / effects** — accent elements carry a subtle neon glow, e.g. `box-shadow: 0 0 20px -6px var(--color-accent)` on the primary button and checked checkboxes; the "system online" status dot pulses (green, `omBlink` keyframe).

---

## Screens / views

The app is a single window: a **40px title bar** on top, then a **248px left sidebar** + a **main content area**. The sidebar switches between four views via `state.view`: `tasks`, `categories`, `import`, `reports`.

### Title bar (persistent)
- 40px tall, surface background, 2px bottom divider.
- Left: 16px accent square logo (glow), app name (`appName` prop, default "TASK-O-TRON 9000", uppercase 13px heading), then mono status text: pulsing green dot + `{pending count} PENDING · SYSTEM ONLINE`.
- Right: Windows-style Minimize / Maximize / Close buttons (46px wide each). Close hovers to accent-red fill. These are decorative.

### Sidebar (persistent)
Four sections separated by 2px rules:
1. **Nav buttons**: Tasks, Manage categories, Import bank file, Spending report. Active button = accent text + `inset 3px 0 0` accent left-bar + faint accent fill. Heading font, 800, uppercase, 13px.
2. **Lists** (smart filters): All tasks, Today, Upcoming, Completed — each with a colored square dot, label, and a mono count badge. Clicking sets `filter` and switches to the tasks view.
3. **Categories tree**: each main category as a bold label with its sub-categories listed beneath as filter buttons (name + task count). Clicking filters tasks by that sub-category.

### 1. Tasks view
- **Header**: big uppercase title + a mono subtitle (both change per active filter — see copy list below). Right side: a segmented **List / Grouped** layout toggle and a primary **New task** button (+ icon). Below: a **quick-add** input ("Log a task before it logs you…") + Add button; Enter also submits.
- **List layout**: flat, sorted list of task rows. Each row:
  - Left: 22px square **checkbox** (accent fill + glow + check icon when done).
  - Title (15px; strikethrough + muted when done).
  - Meta line: optional **due badge** (mono, uppercase) + category **tags** (`.tag .tag-neutral`, mono 10px uppercase).
  - Right: optional **amount** (mono 700; green if ≥0, red if <0), an **edit** icon button, a **delete** icon button (hover → red).
  - The main title/meta area is itself a button that opens the edit dialog.
  - Row background tints faintly on hover; 1px bottom divider. Scroll area has a faint 26px grid background.
- **Grouped layout**: same rows, grouped under each main category (plus a "No category" group), each group with a 2px-underlined header + count.
- **Empty states**: centered icon + witty title/body that vary per filter (see copy).

### 2. Categories (Manage categories) view
Two columns split by a 2px rule:
- **Left (300px) — Main categories**: list of mains (bold name, "N subs" count, rename + delete icon buttons). Selected main gets an accent border + fill. Below: "New main category…" input + Add.
- **Right — Sub categories** of the selected main: kicker "Sub categories of {main name}" (main name in accent). Each sub row: 8px accent square, name, "N tasks", rename + delete. Empty → "No sub categories yet — add one below." Below: "New sub category…" input + Add (max-width 420px).
- Deleting a main deletes its subs and strips those cat ids from all tasks; deleting a sub strips it from tasks. Renames go through a small modal.

### 3. Import bank file view
Two-column grid:
- **Left — Paste transactions**: a mono `<textarea>` (300px tall) placeholder `2026-07-15    ACME CORP PAYROLL    +4200.00`. Buttons: **Parse rows** (primary), **Load sample** (secondary), **Clear** (ghost). Helper text explains auto-detection.
- **Right — Preview**: before parsing, a dashed empty box. After parsing, a bordered table with header `Title | Date | Amount` (grid columns `1fr 92px 96px`). Each row shows title (ellipsized), date (mono, `—` if none), amount (green/red, or muted "no amount"). Rows with no detected amount render at 0.45 opacity (not importable). Under each row: a dashed **"+ categories" / "Edit categories"** button, the assigned category tags, and a **★ saved** flag (accent star) when this title has a remembered default. Footer: "{ok} / {total} rows ready" + **Import as tasks** (primary, disabled if 0 ok).
- Imported rows become tasks with `dateKind: 'transaction'`.

### 4. Spending report view
Scrolling column:
- **Range controls** (2px underline): From / To native date inputs (mono) + quick buttons **This month**, **Last 30 days**, **Year**.
- **Category selection** (2px underline): kicker + **All** / **None** ghost buttons. Rows per main category (84px label) with a wrapping set of toggle chips per sub, plus an "Other → Uncategorized" chip. Selected chip = accent fill.
- **Stat cards**: 3-up grid (2px gap over divider background) — **Money in** (green `+$…`), **Money out** (red `−$…`), **Net change** (green or red).
- **Net over time** chart: a row of bars, one per time bucket. Granularity auto-picks day/week/month by range span. Each bucket has an up (green, positive) and down (red, negative) bar around a center 2px axis, with a mono label beneath. Header shows "Net over time · {daily|weekly|monthly}".
- **Net by category**: horizontal diverging bars — 110px right-aligned name, a track with a center axis, a bar left (green, positive) or right (red, negative), and the mono net figure.
- **Empty state** when no data in the window.

---

## Dialogs / modals

All modals use `.dialog-backdrop` + `.dialog` (top elevation, 1px divider border), fade-in backdrop (`omFade` .12s) and pop-in panel (`omPop` .16s), click-outside to close, inner click stops propagation.

### Task edit dialog (`state.dialog`)
Title "New task" / "Edit task". Fields:
- **Task** text input.
- **Date kind** segmented control: **Do it by** (clock icon) vs **Transaction** (receipt icon). The field label switches between "Do-it date" and "Transaction date".
- **Date presets**: Today / Tomorrow / Next week / Clear buttons + a native date input + a human label ("No date — living dangerously" when empty).
- **Amount**: text input, `inputmode=decimal`, hint "optional · negative = money out".
- **Categories**: per main category, a row of toggle chips (accent fill + glow when on).
- **Actions**: "Delete task" (ghost, only when editing) on the left; Cancel + Save task on the right. Save disabled if title empty.

### Import row category editor (`state.importCat`)
Title "Assign categories", subtitle = the row title. Same category-chip grid. Two checkboxes:
- "Apply to all **N** rows titled '{title}'".
- "Remember as default for this title in future imports".
Cancel / Apply.

### Category rename dialog (`state.catDialog`)
Simple Name input + Cancel / Save. Title reflects main vs sub.

---

## Interactions & behavior (port exactly from the JS)

**Date model.** "Now" is fixed at `2026-07-17` in the prototype (`const NOW`). Dates are ISO `YYYY-MM-DD` strings. Two **date kinds** per task:
- `due` ("Do it by") — can be overdue, participates in Today/Upcoming smart lists.
- `transaction` — a fixed historical date; **never overdue**, **excluded** from Today/Upcoming lists (so old bank data doesn't clutter the actionable view). Rendered with a muted "Txn {date}" badge.

**Due labels** (`dueLabel`): past → "Mon D"; 0 → "Today"; 1 → "Tomorrow"; 2–6 → weekday name; else "Mon D". Due tone → color: overdue = red (badge shows "… · overdue"), today = amber, else muted. Transaction badge is always muted and prefixed "Txn ".

**Smart-list membership** (`matches`):
- `all`: every task.
- `today`: not done, has due, not transaction, `diffDays <= 0`.
- `upcoming`: not done, has due, not transaction, `diffDays > 0`.
- `done`: completed.
- otherwise the filter is a sub-category id → tasks whose `catIds` include it.

**Sort** (`sortTodos`): incomplete-actionable first (by soonest due), then non-actionable, then done; ties by id.

**Quick add**: creates a `due`-kind task with no date; if a category filter is active, the new task inherits that category.

**Amounts**: optional signed float. `null` = no amount. Positive = income (green, `+$`), negative = spend (red, `−$` using the U+2212 minus). Formatting via `fmtMoney` (signed) and `fmtAbs` (unsigned).

**Import parsing** (`parseImport`): split text into non-empty trimmed lines; split each line on tab / comma / 2+ spaces. For each token, try `detectDate` then `detectAmount`; first date and first amount win, everything else joins into the title (fallback "Untitled row"). A row is `ok` (importable) only if an amount was detected.
- `detectDate` accepts `YYYY-M-D` and `M/D/YY(YY)` / `M.D.YY(YY)` (note: day-first for the slash/dot form), normalizes to ISO.
- `detectAmount` strips `$ € £` and commas; accepts a number only if it looks money-ish (has a sign, a decimal, or a currency symbol).
- On parse, if a row's lowercased title matches a remembered default, its categories are pre-filled.

**Category defaults** (`state.titleDefaults`): map of lowercased title → array of sub ids. Editing a row's categories can "Apply to all" same-title rows and/or "Remember" (writes/removes the default). Pre-seeded in the prototype: `whole foods market → [Errands]`, `city power & light → [Finance]`, `acme corp payroll → [Finance]`. Persist these across sessions in the real app (they are in-memory only in the prototype).

**Commit import** (`commitImport`): all `ok` rows become tasks with `dateKind: 'transaction'`, their detected date + amount + assigned categories; then jumps to the Tasks view / All filter and clears the importer.

**Report math** (see `renderVals`): a task counts if it has an amount, its due date is within [repStart, repEnd], and its category (or "uncategorized") is in the selection set (`repSel === null` means all). Money in = sum of positives, out = sum of negatives, net = in + out. Time buckets auto-granularity: span ≤ 16 days → daily, ≤ 95 → weekly, else monthly. Category breakdown aggregates net per main category (+ "Uncategorized"), bars scaled to the max absolute net.

**Deleting categories** cascades to task `catIds` and resets the active filter/selected main as needed (see `removeMain` / `removeSub`).

---

## State management

Everything lives in one component state object (`class Component`). Key fields:
- `view` — `tasks | categories | import | reports`.
- `layout` — `list | grouped`.
- `filter` — `all | today | upcoming | done | {subId}`.
- `quickAdd` — quick-add input text.
- `dialog` — task editor draft `{ id|null, title, due, catIds[], amountStr, dateKind }` or `null`.
- `catDialog` — rename draft `{ kind:'main'|'sub', id, value }` or `null`.
- `selectedMain`, `newMain`, `newSub` — categories view.
- `importText`, `importRows` (`null` until parsed; else `[{key,title,date,amount,ok,catIds}]`), `importCat` (row editor draft).
- `titleDefaults` — remembered per-title category assignments (**persist this**).
- `repStart`, `repEnd`, `repSel` (`null` = all selected).
- `mains` `[{id,name}]`, `subs` `[{id,mainId,name}]`.
- `todos` `[{id,title,done,due,catIds[],amount,dateKind}]`, `nextId`.

**Data-fetching**: the prototype is fully in-memory with seed data. In the real app, back `todos`, `mains`, `subs`, and `titleDefaults` with persistent storage / an API. There is no network code to port.

**Configurable props** (surfaced as tweaks in the prototype): `appName` (string), `firstScreen` (`tasks|categories|import|reports`), `defaultLayout` (`list|grouped`).

---

## Copy (exact strings worth preserving)

Filter titles / subtitles:
- All tasks — "Everything on your plate (and then some)"
- Today — "Due today + everything you're avoiding"
- Upcoming — "A.k.a. future-you's problem"
- Completed — "Trophies for the shelf"
- A category — subtitle "{Main} · sector"

Empty states:
- Default — "Inbox zero, you absolute legend" / "Nothing queued. The machines are idle and slightly bored."
- Today — "All clear for today" / "Zero tasks due. Go outside. Touch grass. We'll wait."
- Completed — "Nothing completed. Yet." / "Bold strategy. We're rooting for you."
- Upcoming — "The future is empty" / "No upcoming tasks. Ominous, but relaxing."
- Report no-data — "No money in this window" / "Widen the dates, select more categories, or import a bank file to see the damage."

Inputs: quick-add "Log a task before it logs you…"; task title "What must be conquered?"; amount "e.g. -84.50".

---

## Assets
- **Icons**: inline SVG in the Lucide style (checkbox, folder, upload, bar-chart, calendar, clock, receipt, pencil, trash, plus, X, minimize, maximize, star). Use the [Lucide](https://lucide.dev) icon set in your codebase.
- **Fonts**: Archivo (design-system heading/body, via `styles.css`) and Space Mono (Google Fonts, weights 400/700).
- **Design system**: the "Modernist" stylesheet `styles.css` provides base component classes (`.btn`, `.btn-primary/secondary/ghost/icon`, `.tag`, `.field`, `.input`, `.seg`, `.dialog*`) and the `--space-*` / `--radius-*` / ramp variables. The app then dark-themes it with the `:root` overrides listed under Design Tokens. Recreate these as your own themed components; no image assets are used.

## Files
- `Tasks.dc.html` — the complete design + logic reference. Template markup is between `<x-dc>` and `</x-dc>`; the behavior is the `class Component extends DCLogic` block near the bottom. Read both.
