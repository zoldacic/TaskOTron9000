// Composable, client-side task querying — companion to the smart-list `matches()` in todo-util.ts.
// Every criterion is "ignore when empty/any", so an empty query matches every task ("All tasks").

import { TaskQuery, Todo } from '../models';

export const NO_ACCOUNT = '__none__';

export function emptyQuery(): TaskQuery {
  return {
    text: '',
    catIds: [],
    dueFrom: null,
    dueTo: null,
    dateKind: 'any',
    amountKind: 'any',
    amountMin: null,
    amountMax: null,
    bankAccountId: null,
  };
}

/** True when the query has no active criteria (equivalent to "All tasks"). */
export function isEmptyQuery(q: TaskQuery): boolean {
  return (
    q.text.trim() === '' &&
    q.catIds.length === 0 &&
    q.dueFrom == null &&
    q.dueTo == null &&
    q.dateKind === 'any' &&
    q.amountKind === 'any' &&
    q.amountMin == null &&
    q.amountMax == null &&
    q.bankAccountId == null
  );
}

export function matchesQuery(t: Todo, q: TaskQuery): boolean {
  // Title text (case-insensitive substring).
  const text = q.text.trim().toLowerCase();
  if (text && !t.title.toLowerCase().includes(text)) return false;

  // Categories: task must carry at least one of the selected sub ids.
  if (q.catIds.length && !q.catIds.some((c) => t.catIds.includes(c))) return false;

  // Due-date range (ISO strings sort lexically). A dateless task can't be in a range.
  if (q.dueFrom != null || q.dueTo != null) {
    if (t.due == null) return false;
    if (q.dueFrom != null && t.due < q.dueFrom) return false;
    if (q.dueTo != null && t.due > q.dueTo) return false;
  }

  // Task type.
  if (q.dateKind !== 'any' && t.dateKind !== q.dateKind) return false;

  // Amount kind.
  if (q.amountKind === 'has' && t.amount == null) return false;
  if (q.amountKind === 'none' && t.amount != null) return false;
  if (q.amountKind === 'income' && !(t.amount != null && t.amount > 0)) return false;
  if (q.amountKind === 'spend' && !(t.amount != null && t.amount < 0)) return false;

  // Amount magnitude bounds (compare on absolute value; a task with no amount is excluded).
  if (q.amountMin != null || q.amountMax != null) {
    if (t.amount == null) return false;
    const mag = Math.abs(t.amount);
    if (q.amountMin != null && mag < q.amountMin) return false;
    if (q.amountMax != null && mag > q.amountMax) return false;
  }

  // Bank account.
  if (q.bankAccountId === NO_ACCOUNT) {
    if (t.bankAccountId != null) return false;
  } else if (q.bankAccountId != null && t.bankAccountId !== q.bankAccountId) {
    return false;
  }

  return true;
}
