import { addDays, diffDays, dueLabel, dueTone, startOfToday, toISO } from './date-util';

const iso = (offset: number) => toISO(addDays(startOfToday(), offset));

describe('date-util', () => {
  it('diffDays is relative to today', () => {
    expect(diffDays(iso(0))).toBe(0);
    expect(diffDays(iso(1))).toBe(1);
    expect(diffDays(iso(-3))).toBe(-3);
  });

  it('dueLabel: today / tomorrow / weekday / date', () => {
    expect(dueLabel(iso(0))).toBe('Today');
    expect(dueLabel(iso(1))).toBe('Tomorrow');
    // 2..6 days out → weekday name
    expect(dueLabel(iso(3))).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/);
    // > 6 days out → "Mon D"
    expect(dueLabel(iso(10))).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('dueTone: overdue vs today vs muted, and done is always muted', () => {
    expect(dueTone(iso(-1), false)).toBe('over');
    expect(dueTone(iso(0), false)).toBe('today');
    expect(dueTone(iso(5), false)).toBe('muted');
    expect(dueTone(iso(-1), true)).toBe('muted'); // done overrides
  });
});
