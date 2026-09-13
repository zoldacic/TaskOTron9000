import { itemAmount, parseNum, plannedIn, plannedOut, plannedTotal, round2 } from './budget-util';
import { BudgetItem } from '../models';

const item = (amount: number): BudgetItem => ({
  id: 1, title: 'x', amount, quantity: null, unitPrice: null,
  mainId: null, catIds: [], note: null, sortOrder: 0,
});

describe('budget-util', () => {
  describe('parseNum', () => {
    it('reads a signed number, blank and junk → null', () => {
      expect(parseNum('-4000')).toBe(-4000);
      expect(parseNum(' 12.5 ')).toBe(12.5);
      expect(parseNum('')).toBeNull();
      expect(parseNum('  ')).toBeNull();
      expect(parseNum('-')).toBeNull();
      expect(parseNum('abc')).toBeNull();
    });
  });

  describe('itemAmount', () => {
    it('multiplies quantity by unit price when both are given', () => {
      expect(itemAmount('3', '-25', '')).toBe(-75);
      expect(itemAmount('2.5', '-20', '')).toBe(-50);
    });

    it('lets quantity x unit price win over a typed amount', () => {
      // Matches the server, which ignores the posted amount in this case.
      expect(itemAmount('4', '-10', '-999')).toBe(-40);
    });

    it('falls back to the typed amount when the pricing is incomplete', () => {
      expect(itemAmount('3', '', '-120')).toBe(-120);
      expect(itemAmount('', '-25', '-120')).toBe(-120);
      expect(itemAmount('', '', '-120')).toBe(-120);
    });

    it('is null when there is nothing to save yet', () => {
      expect(itemAmount('', '', '')).toBeNull();
      expect(itemAmount('3', '', '')).toBeNull();
    });

    it('keeps the sign of the unit price', () => {
      expect(itemAmount('2', '600', '')).toBe(1200); // planned income
    });
  });

  describe('round2', () => {
    it('rounds to two decimals', () => {
      expect(round2(-49.98000000000001)).toBe(-49.98);
      expect(round2(1 / 3)).toBe(0.33);
    });

    it('breaks ties away from zero, like the server', () => {
      // Math.round would give -0.12 here (ties go to +∞); the server's decimal gives -0.13.
      expect(round2(-0.125)).toBe(-0.13);
      expect(round2(0.125)).toBe(0.13);
      expect(itemAmount('0.5', '-0.25', '')).toBe(-0.13);
    });

    it('can sit a cent from the server when the midpoint dies in floating point', () => {
      // 2.5 x 19.99 is 49.975 in decimal (server: −49.98) but 49.974999… as a double.
      // The preview shows this; the saved item comes back with the server's value.
      expect(itemAmount('2.5', '-19.99', '')).toBe(-49.97);
    });
  });

  describe('totals', () => {
    const items = [item(-4000), item(-2000), item(26000), item(-12000)];

    it('plannedTotal is the signed sum', () => {
      expect(plannedTotal(items)).toBe(8000);
      expect(plannedTotal([])).toBe(0);
    });

    it('splits planned spend and planned income', () => {
      expect(plannedOut(items)).toBe(-18000);
      expect(plannedIn(items)).toBe(26000);
    });

    it('does not accumulate float drift', () => {
      expect(plannedTotal([item(-0.1), item(-0.2)])).toBe(-0.3);
    });
  });
});
