import { amountTotals, matches, sortTodos } from './todo-util';
import { addDays, startOfToday, toISO } from './date-util';
import { Todo } from '../models';

const iso = (offset: number) => toISO(addDays(startOfToday(), offset));

function todo(p: Partial<Todo>): Todo {
  return {
    id: 1, title: 't', done: false, due: null, amount: null, dateKind: 'due', mainId: 'work', catIds: [],
    bankAccountId: null, note: null, ...p,
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
