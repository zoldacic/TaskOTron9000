import {
  amountTotals, isDoneToday, isDoneYesterday, isDueToday, isOverdue, matches, sortTodos,
} from './todo-util';
import { addDays, startOfToday, toISO } from './date-util';
import { Todo } from '../models';

const iso = (offset: number) => toISO(addDays(startOfToday(), offset));

function todo(p: Partial<Todo>): Todo {
  return {
    id: 1, title: 't', done: false, due: null, amount: null, dateKind: 'due', mainId: 'work', catIds: [],
    bankAccountId: null, note: null, doneAt: null, ...p,
  };
}

describe('matches', () => {
  it('all matches everything', () => {
    expect(matches(todo({ done: true }), 'all')).toBe(true);
  });

  it('today: not done, due today/past, and NOT a transaction', () => {
    expect(matches(todo({ due: iso(0) }), 'today')).toBe(true);
    expect(matches(todo({ due: iso(-2) }), 'today')).toBe(true);
    expect(matches(todo({ due: iso(0), done: true }), 'today')).toBe(false);
    expect(matches(todo({ due: iso(0), dateKind: 'transaction' }), 'today')).toBe(false);
  });

  it('upcoming: future, not transaction', () => {
    expect(matches(todo({ due: iso(3) }), 'upcoming')).toBe(true);
    expect(matches(todo({ due: iso(3), dateKind: 'transaction' }), 'upcoming')).toBe(false);
    expect(matches(todo({ due: iso(0) }), 'upcoming')).toBe(false);
  });

  it('done and sub-category filters', () => {
    expect(matches(todo({ done: true }), 'done')).toBe(true);
    expect(matches(todo({ catIds: ['pf'] }), 'pf')).toBe(true);
    expect(matches(todo({ catIds: ['he'] }), 'pf')).toBe(false);
  });
});

describe('isOverdue / isDueToday / isDoneToday (start page)', () => {
  it('isOverdue: open, due-dated, strictly before today', () => {
    expect(isOverdue(todo({ due: iso(-1) }))).toBe(true);
    expect(isOverdue(todo({ due: iso(-30) }))).toBe(true);
    expect(isOverdue(todo({ due: iso(0) }))).toBe(false);
    expect(isOverdue(todo({ due: iso(1) }))).toBe(false);
  });

  it('isDueToday: open, due-dated, exactly today', () => {
    expect(isDueToday(todo({ due: iso(0) }))).toBe(true);
    expect(isDueToday(todo({ due: iso(-1) }))).toBe(false);
    expect(isDueToday(todo({ due: iso(1) }))).toBe(false);
  });

  it('both ignore completed tasks', () => {
    expect(isOverdue(todo({ due: iso(-1), done: true }))).toBe(false);
    expect(isDueToday(todo({ due: iso(0), done: true }))).toBe(false);
  });

  it('both ignore transaction-dated and undated tasks', () => {
    expect(isOverdue(todo({ due: iso(-1), dateKind: 'transaction' }))).toBe(false);
    expect(isDueToday(todo({ due: iso(0), dateKind: 'transaction' }))).toBe(false);
    expect(isOverdue(todo({ due: null }))).toBe(false);
    expect(isDueToday(todo({ due: null }))).toBe(false);
  });

  it('isDoneToday: completed, and stamped done today', () => {
    expect(isDoneToday(todo({ done: true, doneAt: iso(0) }))).toBe(true);
    expect(isDoneToday(todo({ doneAt: iso(0) }))).toBe(false);
    expect(isDoneToday(todo({ done: true, doneAt: iso(-1) }))).toBe(false);
  });

  it('isDoneToday ignores the due date entirely', () => {
    expect(isDoneToday(todo({ due: null, done: true, doneAt: iso(0) }))).toBe(true);
    expect(isDoneToday(todo({ due: iso(-30), done: true, doneAt: iso(0) }))).toBe(true);
    expect(isDoneToday(todo({ due: iso(9), done: true, doneAt: iso(0) }))).toBe(true);
    expect(isDoneToday(todo({ due: iso(0), done: true, dateKind: 'transaction', doneAt: iso(0) })))
      .toBe(true);
    expect(isDoneToday(todo({ due: iso(0), done: true }))).toBe(false); // due today, never ticked
  });

  it('isDoneYesterday: completed, and stamped done the day before today', () => {
    expect(isDoneYesterday(todo({ done: true, doneAt: iso(-1) }))).toBe(true);
    expect(isDoneYesterday(todo({ doneAt: iso(-1) }))).toBe(false);
    expect(isDoneYesterday(todo({ done: true, doneAt: iso(0) }))).toBe(false);
    expect(isDoneYesterday(todo({ done: true, doneAt: iso(-2) }))).toBe(false);
    expect(isDoneYesterday(todo({ due: iso(-1), done: true }))).toBe(false); // no stamp
  });

  it('isDoneToday and isDoneYesterday never claim the same task', () => {
    const list = [
      todo({ id: 1, done: true, doneAt: iso(0) }),
      todo({ id: 2, done: true, doneAt: iso(-1) }),
      todo({ id: 3, done: true, doneAt: iso(-5) }),
    ];
    expect(list.filter(isDoneToday).map((t) => t.id)).toEqual([1]);
    expect(list.filter(isDoneYesterday).map((t) => t.id)).toEqual([2]);
  });

  it('isDoneToday and isDueToday split today into done and open, never overlapping', () => {
    const open = todo({ id: 1, due: iso(0) });
    const closed = todo({ id: 2, due: iso(0), done: true, doneAt: iso(0) });
    expect([open, closed].filter(isDueToday).map((t) => t.id)).toEqual([1]);
    expect([open, closed].filter(isDoneToday).map((t) => t.id)).toEqual([2]);
  });

  it('together they partition the "today" smart list', () => {
    const list = [
      todo({ id: 1, due: iso(-2) }), todo({ id: 2, due: iso(0) }), todo({ id: 3, due: iso(4) }),
      todo({ id: 4, due: iso(-1), done: true }), todo({ id: 5, due: iso(-1), dateKind: 'transaction' }),
    ];
    const smartToday = list.filter((t) => matches(t, 'today')).map((t) => t.id);
    const split = [...list.filter(isOverdue), ...list.filter(isDueToday)].map((t) => t.id);
    expect(smartToday.slice().sort()).toEqual(split.slice().sort());
    expect(split).toEqual([1, 2]);
  });
});

describe('amountTotals', () => {
  it('splits income from spend and nets them', () => {
    const t = amountTotals([
      todo({ id: 1, amount: 1200 }),
      todo({ id: 2, amount: -450.5 }),
      todo({ id: 3, amount: -49.5 }),
    ]);
    expect(t).toEqual({ income: 1200, spend: -500, net: 700 });
  });

  it('ignores tasks without an amount', () => {
    expect(amountTotals([todo({ id: 1, amount: 100 }), todo({ id: 2, amount: null })]))
      .toEqual({ income: 100, spend: 0, net: 100 });
  });

  it('returns null when nothing carries an amount', () => {
    expect(amountTotals([todo({ id: 1 }), todo({ id: 2 })])).toBeNull();
    expect(amountTotals([])).toBeNull();
  });

  it('counts a zero amount as income, not as absent', () => {
    expect(amountTotals([todo({ id: 1, amount: 0 })])).toEqual({ income: 0, spend: 0, net: 0 });
  });
});

describe('sortTodos', () => {
  it('actionable-by-soonest first, then non-actionable, then done', () => {
    const done = todo({ id: 1, done: true, due: iso(-1) });
    const soon = todo({ id: 2, due: iso(0) });
    const later = todo({ id: 3, due: iso(5) });
    const noDate = todo({ id: 4, due: null });
    const order = sortTodos([done, noDate, later, soon]).map((t) => t.id);
    expect(order).toEqual([2, 3, 4, 1]);
  });
});
