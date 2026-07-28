/**
 * Spots import preview rows that would re-create a task already saved.
 *
 * Presentation-only (like the smart lists): the client already holds every task,
 * so the warning is derived here rather than asked of the server.
 */

import { ImportRow, Todo } from '../models';

/**
 * Identity used to compare a row with a saved task: title + amount + date.
 * Titles are compared case-insensitively with collapsed whitespace, amounts to
 * the cent, dates as their ISO strings.
 */
export function dupSignature(title: string, amount: number | null, date: string | null): string {
  const t = title.trim().replace(/\s+/g, ' ').toLowerCase();
  return `${t}|${amount == null ? '' : amount.toFixed(2)}|${date ?? ''}`;
}

/** Keys of the preview rows whose title, amount and date all match an existing task. */
export function duplicateRowKeys(rows: readonly ImportRow[], todos: readonly Todo[]): Set<number> {
  const saved = new Set(todos.map((t) => dupSignature(t.title, t.amount, t.due)));
  const keys = new Set<number>();
  for (const r of rows) {
    if (saved.has(dupSignature(r.title, r.amount, r.date))) keys.add(r.key);
  }
  return keys;
}
