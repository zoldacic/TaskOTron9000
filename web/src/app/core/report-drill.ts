// Which tasks sit behind one bar of the report's "net by category" chart.
//
// This mirrors ReportBuilder.Build (src/TaskOTron.Api/Services/ReportBuilder.cs:58-113) exactly —
// the same inclusion rules and the same one-bucket-per-task attribution — so the drill-down list
// always sums to the net the bar shows. Keep the two in sync.

import { Todo } from '../models';

/** The pseudo-id the report uses for tasks with no main (or no selected sub). */
export const UNCATEGORIZED = '__none__';

export interface DrillOpts {
  /** Inclusive ISO yyyy-MM-dd range, the report's date window. */
  start: string;
  end: string;
  /** Selection/breakdown grain, matching the report's groupBy. */
  mode: 'main' | 'sub';
  /** Selected ids in that grain; null = all. */
  sel: string[] | null;
  /** Every selectable id in the grain: all main ids, or all sub ids. */
  universe: string[];
}

/**
 * The tasks aggregated into the breakdown row `catId` (a main id, a sub id, or UNCATEGORIZED),
 * newest first.
 *
 * Like the server, this keys on `due` regardless of `dateKind` and ignores `done`: the report
 * counts transactions and due-dated tasks, open and completed, alike.
 */
export function drillCategory(todos: Todo[], catId: string, o: DrillOpts): Todo[] {
  const bySub = o.mode === 'sub';
  const sel = new Set(o.sel ?? [...o.universe, UNCATEGORIZED]);

  // A task is included when its selection key matches the chosen set. In "sub" mode the key is
  // any of its subs; in "main" mode its single main. Tasks with no key fall under UNCATEGORIZED.
  const included = (t: Todo): boolean => bySub
    ? (t.catIds.length > 0 ? t.catIds.some((c) => sel.has(c)) : sel.has(UNCATEGORIZED))
    : (t.mainId ? sel.has(t.mainId) : sel.has(UNCATEGORIZED));

  // The single bucket a task contributes to — its main, or the first of its subs that is
  // selected. No task is counted twice, so the rows here partition the report's tasks.
  const catKey = (t: Todo): string => bySub
    ? (t.catIds.find((c) => sel.has(c)) ?? UNCATEGORIZED)
    : (t.mainId || UNCATEGORIZED);

  return todos
    .filter((t) =>
      t.amount != null
      && !!t.due && t.due >= o.start && t.due <= o.end // ISO dates compare lexicographically
      && included(t)
      && catKey(t) === catId)
    .sort((a, b) => (a.due! < b.due! ? 1 : a.due! > b.due! ? -1 : b.id - a.id));
}
