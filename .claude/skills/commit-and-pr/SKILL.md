---
name: commit-and-pr
description: Commit the current change on a fresh branch, open a GitHub pull request, and optionally merge it into main for TASK-O-TRON 9000. Use when the user says to commit, push, open/make a PR, merge it, or "ship it" after a change is done. Covers this repo's branch/footer conventions and the Windows `gh` invocation quirk.
---

# Commit & open a PR for TASK-O-TRON 9000

The repo is on GitHub (`zoldacic/TaskOTron9000`), default branch **`main`**. Never
commit straight to `main` — branch first, then open a PR.

## The one non-obvious trap

`gh` is **not on PATH** in tool shells. It lives at
`C:\Program Files\GitHub CLI\gh.exe` and must be invoked through the PowerShell
call operator (`&`). Plain `gh …` fails with "not recognized" / exit 127.

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr create ...
```

## Steps

### 1. Sync and branch

```powershell
git pull --ff-only
git checkout -b <short-kebab-branch>   # e.g. fix-donut-center-overlap
```

Pick a branch name that describes the change (`<type>-<what>`). If already on a
feature branch for this work, skip the checkout.

### 2. Stage and commit

Stage only the files you changed (not `git add -A` blindly). Write the message to
a file in the scratchpad and pass it with `-F`:

```powershell
git add web/src/app/...    # the actual files
git commit -F "<scratchpad>\commit-msg.txt"
```

```text
<imperative subject line, ~50 chars>

<body: what was wrong and what the change does, wrapped ~72 cols>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Every commit must end with the `Co-Authored-By: Claude Opus 5` trailer.**

Don't pass a multi-line message inline. A single-quoted here-string (`git commit
-m @'…'@`) looks like it should work — `$` and backticks do stay literal — but a
**double quote anywhere in the body** breaks the parse: PowerShell stops treating
the here-string as one argument and git reports `error: pathspec '<your words>'
did not match any file(s)`. Since commit bodies quote identifiers and messages
constantly, use `-F` every time rather than deciding case by case.

### 3. Push and open the PR

Same rule as the commit message — write the body to a scratchpad file and pass it
with `--body-file`, not `--body @'…'@`:

```powershell
git push -u origin <branch>
& "C:\Program Files\GitHub CLI\gh.exe" pr create --title "<title>" --body-file "<scratchpad>\pr-body.md"
```

```markdown
## What
<what was broken / the goal>

## Change
<the fix, referencing files>

## Verification
<what you observed in the live app — see the verify-ui skill>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Every PR body must end with the `🤖 Generated with [Claude Code]` line.**

`gh pr create` prints the new PR URL on success — report it to the user as a
markdown link.

### 4. Merge (only when the user asked for it)

"Ship it" / "merge it" / an already-approved PR is the go-ahead. If the user only
asked to commit or open a PR, stop at step 3 and report the PR link — never merge
speculatively.

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr merge <n> --merge --delete-branch
git checkout main; if ($?) { git pull }
```

- `--merge` (merge commit) is what this repo uses; `--squash` only on request.
- `--delete-branch` drops the remote branch **and the local feature branch**, and
  `gh` fast-forwards the local `main` too — so the `git pull` usually reports
  "Already up to date".
- `git checkout main && git pull` is a **bash-ism**; `&&` is a parser error in
  PowerShell 5.1. Chain with `; if ($?) { … }`.
- Report the fast-forward range (e.g. `4c06ada..6bd8f65`) along with the merge.

Then clean up the branch refs:

```powershell
git branch -a       # <branch> should be gone, locally and under remotes/origin
git fetch --prune   # delete remote-tracking refs whose remote branch is gone
```

- Do **not** run `git branch -d <branch>` as a routine follow-up — `gh` already
  deleted it, so the command just fails with
  `error: branch '<branch>' not found`. Keep it as a fallback for the rare case
  `git branch -a` still lists the branch, e.g. the PR was merged from GitHub's
  web UI instead of via `gh`.
- Stale `remotes/origin/<merged-branch>` refs **do** linger locally; nothing in
  the merge prunes them, and they pile up over many PRs (ten dead refs in one
  sweep here). `git fetch --prune` is what clears them.

The standalone **merge-to-main** skill covers this same flow for when a PR
already exists from an earlier session.

## Notes / gotchas

- `git push` writes an informational "remote: …" banner to **stderr**. In
  PowerShell that surfaces as a red `NativeCommandError` even though the push
  succeeded — check for the `[new branch]` / `pull/<n>` lines, don't treat the
  banner as a failure. (Avoid `2>&1` on native commands here for the same reason.)
- Verify the change in the running app **before** committing (see the
  **verify-ui** skill) so the PR's Verification section reflects reality.
