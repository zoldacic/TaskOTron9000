---
name: merge-to-main
description: Merge the current branch's pull request into main, delete the branch, then sync the local main branch. Use when the user says to merge the PR / branch, "merge it", or land the change after a PR has been approved for TASK-O-TRON 9000.
---

# Merge a branch to main for TASK-O-TRON 9000

Runs after a PR exists (see the **commit-and-pr** skill). This lands it on
**`main`** and brings the local checkout up to date.

## The `gh` invocation trap

`gh` is **not on PATH** in tool shells — it lives at
`C:\Program Files\GitHub CLI\gh.exe` and must be called through the PowerShell
call operator (`&`). Plain `gh …` fails with "not recognized" / exit 127.

## Steps

### 1. Merge the PR and delete the remote branch

Use the PR number (or let `gh` infer it from the current branch by omitting it):

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr merge <n> --merge --delete-branch
```

- `--merge` creates a merge commit; the repo has been using this (a
  fast-forward on `main` when the branch is up to date). Use `--squash` only if
  the user asks for it.
- `--delete-branch` removes the remote branch after merging. `gh` also fetches
  and fast-forwards the **local** `main` as part of this command, so the next
  step is often already a no-op.

### 2. Check out main and pull

```powershell
git checkout main; if ($?) { git pull }
```

Note: `git checkout main && git pull` is a **bash-ism** — `&&` is a parser error
in this repo's PowerShell 5.1. Chain with `; if ($?) { … }` instead. Expect
"Already on 'main'" / "Already up to date" because step 1 already synced it.

### 3. (optional) Prune the local branch

The merged feature branch still exists locally. If the user wants it gone:

```powershell
git branch -d <branch>
```

## Notes

- Report the merge result: which commits landed and the fast-forward range
  (e.g. `4c06ada..6bd8f65`).
- Don't merge without confirmation — treat "merge it" / an approved PR as the
  go-ahead, but never merge speculatively.
