import { parseVoiceCommand } from './voice-command';
import { Main, Sub } from '../models';

// Friday 2026-07-17 — the prototype's "today", so the weekday maths is easy to eyeball.
const TODAY = new Date(2026, 6, 17);

const mains: Main[] = [
  { id: 'home', name: 'Hem' },
  { id: 'personal', name: 'Personligt' },
];
const subs: Sub[] = [
  { id: 'mat', mainId: 'home', name: 'Mat', taskCount: 0 },
  { id: 'matute', mainId: 'home', name: 'Mat ute', taskCount: 0 },
  { id: 'gro', mainId: 'home', name: 'Groceries', taskCount: 0 },
];

const en = (s: string) => parseVoiceCommand(s, 'en', mains, subs, TODAY);
const sv = (s: string) => parseVoiceCommand(s, 'sv', mains, subs, TODAY);

describe('voice-command', () => {
  it('drops the leading command words in either language', () => {
    expect(en('add buy milk tomorrow')).toMatchObject({ title: 'Buy milk', due: '2026-07-18', dateKind: 'due' });
    expect(sv('lägg till köp mjölk imorgon')).toMatchObject({ title: 'Köp mjölk', due: '2026-07-18' });
  });

  it('understands relative dates', () => {
    expect(en('call the dentist next week')).toMatchObject({ title: 'Call the dentist', due: '2026-07-24' });
    expect(sv('ring tandläkaren i övermorgon')).toMatchObject({ title: 'Ring tandläkaren', due: '2026-07-19' });
    expect(en('deploy in 3 days')).toMatchObject({ title: 'Deploy', due: '2026-07-20' });
  });

  it('takes a weekday to mean the next one strictly ahead', () => {
    expect(en('lunch on monday').due).toBe('2026-07-20');
    expect(en('standup next monday').due).toBe('2026-07-27');
    // Today is a Friday, so "friday" is a week out, not right now.
    expect(en('gym friday').due).toBe('2026-07-24');
    expect(sv('städa på lördag')).toMatchObject({ title: 'Städa', due: '2026-07-18' });
  });

  it('reads a day of the month, rolling into next month when it has passed', () => {
    expect(en('pay rent on the 5th')).toMatchObject({ title: 'Pay rent', due: '2026-08-05' });
    expect(sv('betala hyran den 20:e')).toMatchObject({ title: 'Betala hyran', due: '2026-07-20' });
  });

  it('treats an amount as money out and switches the task to a transaction', () => {
    expect(en('bought coffee 45 kronor')).toMatchObject({
      title: 'Bought coffee', amount: -45, dateKind: 'transaction',
    });
    expect(sv('betalade 12,50 kr parkering')).toMatchObject({ title: 'Betalade parkering', amount: -12.5 });
    expect(sv('tankade 1.243,01 kr').amount).toBe(-1243.01);
  });

  it('reads a number whose thousands separator is a space', () => {
    // Swedish recognisers write "1 250", which arrives as two tokens.
    expect(sv('tankade 1 250 kr')).toMatchObject({ title: 'Tankade', amount: -1250 });
    expect(sv('hyra 12 500,50 kr').amount).toBe(-12500.5);
    // Still not money without a currency word.
    expect(en('call 555 1234')).toMatchObject({ title: 'Call 555 1234', amount: null });
  });

  it('flips the sign when the words say money came in', () => {
    expect(en('got 500 dollars refund')).toMatchObject({ title: 'Got refund', amount: 500 });
    expect(sv('fick 1200 kr')).toMatchObject({ amount: 1200, dateKind: 'transaction' });
    expect(en('rebate plus 20 kr').amount).toBe(20);
  });

  it('leaves a number alone when no currency word is stuck to it', () => {
    expect(en('buy 2 apples')).toMatchObject({ title: 'Buy 2 apples', amount: null, dateKind: 'due' });
  });

  it('matches a category by name and strips it from the title', () => {
    expect(sv('handla mat imorgon')).toMatchObject({
      title: 'Handla', subId: 'mat', mainId: 'home', due: '2026-07-18',
    });
    // The longer name wins.
    expect(sv('lunch mat ute')).toMatchObject({ title: 'Lunch', subId: 'matute' });
    // A main category can be spoken on its own.
    expect(en('weekly run hem')).toMatchObject({ title: 'Weekly run', mainId: 'home', subId: null });
  });

  it('only matches a category on whole words', () => {
    expect(sv('köp en matlåda')).toMatchObject({ title: 'Köp en matlåda', subId: null, mainId: null });
  });

  it('keeps the whole sentence as the title when nothing is recognised', () => {
    expect(sv('ring mormor')).toEqual({
      title: 'Ring mormor', due: null, amount: null, dateKind: 'due', mainId: null, subId: null,
      matched: { command: null, date: null, amount: null, category: null },
    });
  });

  it('falls back to the category name when every word was consumed', () => {
    expect(sv('lägg till 45 kr mat')).toMatchObject({ title: 'Mat', amount: -45, subId: 'mat' });
  });

  it('returns an empty command for an empty transcript', () => {
    expect(en('   ')).toMatchObject({ title: '', due: null, amount: null, mainId: null, subId: null });
  });
});
