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
