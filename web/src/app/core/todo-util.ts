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

/** A task the start page can act on: open, and dated with a real due date (not a transaction date). */
function actionable(t: Todo): boolean {
  return !t.done && !!t.due && t.dateKind !== 'transaction';
}

/** Open, due-dated and past its due date. */
export function isOverdue(t: Todo): boolean {
  return actionable(t) && diffDays(t.due!) < 0;
}

/** Open, due-dated and due exactly today. */
export function isDueToday(t: Todo): boolean {
  return actionable(t) && diffDays(t.due!) === 0;
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
