import { emptyQuery, isEmptyQuery, matchesQuery, NO_ACCOUNT } from './task-query';
import { TaskQuery, Todo } from '../models';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 1, title: 't', done: false, due: null, amount: null, dateKind: 'due', mainId: 'work', catIds: [],
    bankAccountId: null, ...p,
  };
}
function query(p: Partial<TaskQuery>): TaskQuery {
  return { ...emptyQuery(), ...p };
}

describe('isEmptyQuery', () => {
  it('is true for a fresh query and false once any criterion is set', () => {
    expect(isEmptyQuery(emptyQuery())).toBe(true);
    expect(isEmptyQuery(query({ text: 'x' }))).toBe(false);
    expect(isEmptyQuery(query({ catIds: ['pf'] }))).toBe(false);
    expect(isEmptyQuery(query({ dueFrom: '2026-07-01' }))).toBe(false);
  });
});

describe('matchesQuery', () => {
  it('empty query matches everything', () => {
    expect(matchesQuery(todo({ done: true }), emptyQuery())).toBe(true);
  });

  it('title text is a case-insensitive substring', () => {
    expect(matchesQuery(todo({ title: 'Buy Milk' }), query({ text: 'milk' }))).toBe(true);
    expect(matchesQuery(todo({ title: 'Buy Milk' }), query({ text: 'eggs' }))).toBe(false);
  });

  it('categories match ANY of the selected sub ids', () => {
    expect(matchesQuery(todo({ catIds: ['pf'] }), query({ catIds: ['pf', 'he'] }))).toBe(true);
    expect(matchesQuery(todo({ catIds: ['wr'] }), query({ catIds: ['pf', 'he'] }))).toBe(false);
    expect(matchesQuery(todo({ catIds: [] }), query({ catIds: ['pf'] }))).toBe(false);
  });

  it('due-date range is inclusive and excludes dateless tasks', () => {
    const q = query({ dueFrom: '2026-07-01', dueTo: '2026-07-31' });
    expect(matchesQuery(todo({ due: '2026-07-15' }), q)).toBe(true);
    expect(matchesQuery(todo({ due: '2026-07-01' }), q)).toBe(true);
    expect(matchesQuery(todo({ due: '2026-08-01' }), q)).toBe(false);
    expect(matchesQuery(todo({ due: null }), q)).toBe(false);
  });

  it('task type filters by dateKind', () => {
    expect(matchesQuery(todo({ dateKind: 'transaction' }), query({ dateKind: 'transaction' }))).toBe(true);
    expect(matchesQuery(todo({ dateKind: 'due' }), query({ dateKind: 'transaction' }))).toBe(false);
  });

  it('amount kind distinguishes income/spend/has/none', () => {
    expect(matchesQuery(todo({ amount: 50 }), query({ amountKind: 'income' }))).toBe(true);
    expect(matchesQuery(todo({ amount: -50 }), query({ amountKind: 'income' }))).toBe(false);
    expect(matchesQuery(todo({ amount: -50 }), query({ amountKind: 'spend' }))).toBe(true);
    expect(matchesQuery(todo({ amount: 50 }), query({ amountKind: 'has' }))).toBe(true);
    expect(matchesQuery(todo({ amount: null }), query({ amountKind: 'has' }))).toBe(false);
    expect(matchesQuery(todo({ amount: null }), query({ amountKind: 'none' }))).toBe(true);
  });

  it('amount magnitude bounds compare on absolute value', () => {
    const q = query({ amountMin: 10, amountMax: 100 });
    expect(matchesQuery(todo({ amount: -50 }), q)).toBe(true);
    expect(matchesQuery(todo({ amount: 5 }), q)).toBe(false);
    expect(matchesQuery(todo({ amount: -500 }), q)).toBe(false);
    expect(matchesQuery(todo({ amount: null }), q)).toBe(false);
  });

  it('bank account matches a specific id or the no-account sentinel', () => {
    expect(matchesQuery(todo({ bankAccountId: 'b1' }), query({ bankAccountId: 'b1' }))).toBe(true);
    expect(matchesQuery(todo({ bankAccountId: 'b2' }), query({ bankAccountId: 'b1' }))).toBe(false);
    expect(matchesQuery(todo({ bankAccountId: null }), query({ bankAccountId: NO_ACCOUNT }))).toBe(true);
    expect(matchesQuery(todo({ bankAccountId: 'b1' }), query({ bankAccountId: NO_ACCOUNT }))).toBe(false);
  });

  it('combines criteria with AND', () => {
    const q = query({ text: 'rent', dateKind: 'transaction', amountKind: 'spend' });
    expect(matchesQuery(todo({ title: 'Apartment rent', dateKind: 'transaction', amount: -1650 }), q)).toBe(true);
    expect(matchesQuery(todo({ title: 'Apartment rent', dateKind: 'due', amount: -1650 }), q)).toBe(false);
  });
});
