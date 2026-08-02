import { dupSignature, duplicateRowKeys } from './import-dup';
import { ImportRow, Todo } from '../models';

function todo(p: Partial<Todo>): Todo {
  return {
    id: 1, title: 'ACME CORP', done: false, due: '2026-07-15', amount: -120.5, dateKind: 'transaction',
    mainId: 'money', catIds: [], bankAccountId: null, note: null, doneAt: null, ...p,
  };
}
function row(p: Partial<ImportRow>): ImportRow {
  return {
    key: 1, title: 'ACME CORP', date: '2026-07-15', amount: -120.5, ok: true,
    mainId: 'money', catIds: [], note: '', ...p,
  };
}

describe('dupSignature', () => {
  it('ignores case and surrounding/repeated whitespace in the title', () => {
    expect(dupSignature('  ACME   Corp ', -1, null)).toBe(dupSignature('acme corp', -1, null));
  });

  it('compares amounts to the cent and keeps "no amount" distinct from zero', () => {
    expect(dupSignature('a', 120.5, null)).toBe(dupSignature('a', 120.5, null));
    expect(dupSignature('a', null, null)).not.toBe(dupSignature('a', 0, null));
  });
});

describe('duplicateRowKeys', () => {
  it('flags a row matching title, amount and date of a saved task', () => {
    expect([...duplicateRowKeys([row({})], [todo({})])]).toEqual([1]);
  });

  it('does not flag when any of the three differs', () => {
    const rows = [
      row({ key: 1, title: 'OTHER SHOP' }),
      row({ key: 2, amount: -120.51 }),
      row({ key: 3, date: '2026-07-16' }),
      row({ key: 4, date: null }),
    ];
    expect(duplicateRowKeys(rows, [todo({})]).size).toBe(0);
  });

  it('matches a dateless, amountless task', () => {
    const r = row({ key: 7, date: null, amount: null });
    const t = todo({ due: null, amount: null });
    expect([...duplicateRowKeys([r], [t])]).toEqual([7]);
  });

  it('returns an empty set when nothing is saved yet', () => {
    expect(duplicateRowKeys([row({})], []).size).toBe(0);
  });

  it('flags every row that matches the same saved task', () => {
    const rows = [row({ key: 1 }), row({ key: 2 }), row({ key: 3, title: 'ELSEWHERE' })];
    expect([...duplicateRowKeys(rows, [todo({})])]).toEqual([1, 2]);
  });
});
