import { drillCategory, DrillOpts, UNCATEGORIZED } from './report-drill';
import { Todo } from '../models';

let nextId = 1;
function todo(p: Partial<Todo>): Todo {
  return {
    id: nextId++, title: 't', done: false, due: null, amount: null, dateKind: 'transaction',
    mainId: 'personal', catIds: [], bankAccountId: null, note: null, doneAt: null, ...p,
  };
}

// The same fixture as the server's ReportBuilderTests seed, so the two implementations can be
// compared directly (tests/TaskOTron.Api.Tests/ReportBuilderTests.cs:27-41).
const T = (due: string | null, amount: number, main: string, ...cats: string[]) =>
  todo({ due, amount, mainId: main, catIds: cats });

function seed(): Todo[] {
  nextId = 1;
  return [
    T('2026-07-22', -120, 'personal', 'ph'),
    T('2026-07-20', -84.5, 'personal', 'pf'),
    T('2026-07-17', -76.2, 'home', 'he'),
    T(null, -45, 'home', 'hr'), // no due → excluded
    T('2026-07-31', -18.99, 'personal', 'pl'),
    T('2026-08-03', -320, 'personal', 'pf'), // out of July range
    T('2026-07-01', 4200, 'personal', 'pf'),
    T('2026-07-09', 650, 'personal', 'pf', 'wr'),
    T('2026-07-11', 32.4, 'home', 'he'),
    T('2026-07-05', -15.99, 'personal', 'pl'),
    T('2026-07-08', -52.4, 'home', 'he'),
    T('2026-07-03', -39, 'personal', 'ph'),
  ];
}

const MAINS = ['work', 'home', 'personal'];
const SUBS = ['wr', 'wm', 'we', 'wp', 'he', 'hc', 'hr', 'ph', 'pf', 'pl'];

const opts = (p: Partial<DrillOpts> = {}): DrillOpts => ({
  start: '2026-07-01', end: '2026-07-31', mode: 'main', sel: null, universe: MAINS, ...p,
});
const bySub = (p: Partial<DrillOpts> = {}): DrillOpts =>
  opts({ mode: 'sub', universe: SUBS, ...p });

const sum = (list: Todo[]) => list.reduce((s, t) => s + (t.amount ?? 0), 0);

describe('drillCategory — main grain', () => {
  it('returns the tasks whose main is the bar, and they sum to the bar net', () => {
    const rows = drillCategory(seed(), 'personal', opts());

    expect(rows.length).toBe(7);
    // Matches Category_breakdown_aggregates_by_main: the freelance +650 counts under Personal
    // only, not under Work, even though it carries a "wr" sub.
    expect(sum(rows)).toBeCloseTo(4200 + 650 - 84.5 - 18.99 - 15.99 - 120 - 39, 10);

    expect(sum(drillCategory(seed(), 'home', opts()))).toBeCloseTo(-76.2 + 32.4 - 52.4, 10);
    // Work is nobody's main here, so it has no bar and no rows.
    expect(drillCategory(seed(), 'work', opts())).toEqual([]);
  });

  it('sorts newest first', () => {
    const rows = drillCategory(seed(), 'personal', opts());
    expect(rows.map((t) => t.due)).toEqual([
      '2026-07-31', '2026-07-22', '2026-07-20', '2026-07-09', '2026-07-05', '2026-07-03', '2026-07-01',
    ]);
  });

  it('excludes tasks with no amount, no due date, or a due date outside the range', () => {
    const rows = drillCategory([
      T('2026-07-10', 0, 'home'), // an amount of 0 is still an amount
      todo({ due: '2026-07-10', amount: null, mainId: 'home' }),
      T(null, -45, 'home'),
      T('2026-06-30', -10, 'home'),
      T('2026-08-01', -10, 'home'),
    ], 'home', opts());

    expect(rows.map((t) => t.amount)).toEqual([0]);
  });

  it('is inclusive at both ends of the range', () => {
    const list = [T('2026-07-01', -1, 'home'), T('2026-07-31', -2, 'home')];
    expect(drillCategory(list, 'home', opts()).length).toBe(2);
  });

  it('ignores done and dateKind, like the report itself', () => {
    const list = [
      todo({ due: '2026-07-10', amount: -5, mainId: 'home', done: true, doneAt: '2026-07-10' }),
      todo({ due: '2026-07-11', amount: -6, mainId: 'home', dateKind: 'due' }),
    ];
    expect(drillCategory(list, 'home', opts()).length).toBe(2);
  });

  it('honours the selection: an unselected main contributes nothing', () => {
    expect(drillCategory(seed(), 'personal', opts({ sel: ['home'] }))).toEqual([]);
    expect(drillCategory(seed(), 'home', opts({ sel: ['home'] })).length).toBe(3);
  });

  it('buckets tasks with no main under __none__', () => {
    const list = [T('2026-07-04', -60, ''), T('2026-07-05', -1, 'home')];
    const rows = drillCategory(list, UNCATEGORIZED, opts());
    expect(rows.map((t) => t.amount)).toEqual([-60]);
  });
});

describe('drillCategory — sub grain', () => {
  it('attributes a task to the first of its subs that is selected', () => {
    // pf: salary +4200, freelance +650 (first selected sub of {pf,wr} is pf), electricity -84.5.
    const pf = drillCategory(seed(), 'pf', bySub({ sel: ['pf', 'pl'] }));
    expect(sum(pf)).toBeCloseTo(4200 + 650 - 84.5, 10);
    expect(pf.length).toBe(3);

    const pl = drillCategory(seed(), 'pl', bySub({ sel: ['pf', 'pl'] }));
    expect(sum(pl)).toBeCloseTo(-15.99 - 18.99, 10);

    // With only "wr" selected, the same freelance task lands under wr instead — and it is the
    // only task that qualifies at all.
    const wr = drillCategory(seed(), 'wr', bySub({ sel: ['wr'] }));
    expect(wr.map((t) => t.amount)).toEqual([650]);
    expect(drillCategory(seed(), 'pf', bySub({ sel: ['wr'] }))).toEqual([]);
  });

  it('partitions the tasks — every task lands in exactly one bar', () => {
    const all = seed();
    const buckets = [...SUBS, UNCATEGORIZED]
      .flatMap((id) => drillCategory(all, id, bySub()));
    const inRange = all.filter((t) => t.amount != null && t.due
      && t.due >= '2026-07-01' && t.due <= '2026-07-31');

    expect(buckets.length).toBe(inRange.length);
    expect(new Set(buckets.map((t) => t.id)).size).toBe(inRange.length);
    expect(sum(buckets)).toBeCloseTo(sum(inRange), 10);
  });

  it('buckets tasks with no subs, and tasks whose subs are all unselected, under __none__', () => {
    const noSubs = T('2026-07-04', -60, 'home');
    const rows = drillCategory([noSubs], UNCATEGORIZED, bySub());
    expect(rows.map((t) => t.amount)).toEqual([-60]);

    // A task whose only sub is unselected is filtered out entirely — it is not __none__.
    expect(drillCategory(seed(), UNCATEGORIZED, bySub({ sel: ['pf'] }))).toEqual([]);
  });
});
