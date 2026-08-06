// Faithful port of the prototype's filtering + sorting (Tasks.dc.html:705-719).

import { Todo } from '../models';
import { diffDays } from './date-util';

export type Filter = 'all' | 'today' | 'upcoming' | 'done' | string; // string = sub-category id

export function matches(t: Todo, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'today')
    return !t.done && !!t.due && t.dateKind !== 'transaction' && diffDays(t.due) <= 0;
  if (filter === 'upcoming')
    return !t.done && !!t.due && t.dateKind !== 'transaction' && diffDays(t.due) > 0;
  if (filter === 'done') return t.done;
  return t.catIds.includes(filter); // sub-category id
}

/** Carries a real due date (not a transaction date), so the start page can place it on a day. */
function dated(t: Todo): boolean {
  return !!t.due && t.dateKind !== 'transaction';
}

/** A task the start page can act on: open and due-dated. */
function actionable(t: Todo): boolean {
  return !t.done && dated(t);
}

/** Open, due-dated and past its due date. */
export function isOverdue(t: Todo): boolean {
  return actionable(t) && diffDays(t.due!) < 0;
}

/** Open, due-dated and due exactly today. */
export function isDueToday(t: Todo): boolean {
  return actionable(t) && diffDays(t.due!) === 0;
}

/** How far ahead the start page looks. Beyond this the Upcoming smart list takes over. */
export const COMING_DAYS = 7;

/**
 * Open, due-dated, and due within the next week — what is about to land. Starts the day after
 * today so it never overlaps "Due today".
 */
export function isComing(t: Todo): boolean {
  if (!actionable(t)) return false;
  const d = diffDays(t.due!);
  return d > 0 && d <= COMING_DAYS;
}

/**
 * Completed today — today's wins, the counterpart of isDueToday. Keyed on the server-stamped
 * completion day, so the due date (or the lack of one) doesn't matter. Tasks completed before
 * the stamp existed have no doneAt and stay out of the list.
 */
export function isDoneToday(t: Todo): boolean {
  return t.done && !!t.doneAt && diffDays(t.doneAt) === 0;
}

/** Completed yesterday — the previous day's wins, on the same stamp as isDoneToday. */
export function isDoneYesterday(t: Todo): boolean {
  return t.done && !!t.doneAt && diffDays(t.doneAt) === -1;
}

export interface AmountTotals { income: number; spend: number; net: number }

// Aggregates the money on a set of tasks. Returns null when none of them carry an amount, so
// callers can hide the summary entirely for non-monetary result sets.
export function amountTotals(list: Todo[]): AmountTotals | null {
  let income = 0, spend = 0, any = false;
  for (const t of list) {
    if (t.amount == null) continue;
    any = true;
    if (t.amount >= 0) income += t.amount; else spend += t.amount;
  }
  return any ? { income, spend, net: income + spend } : null;
}

export function sortTodos(list: Todo[]): Todo[] {
  const key = (t: Todo): [number, number, number] => {
    const act = !!t.due && t.dateKind !== 'transaction';
    return [t.done ? 2 : act ? 0 : 1, act ? diffDays(t.due!) : 1e9, t.id];
  };
  return [...list].sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });
}
