// Pure helpers for budget items. The quantity x unit price rule mirrors the server's
// BudgetEndpoints.ResolveAmount — the server has the final word, this keeps the dialog's
// live preview honest in the meantime.

import { BudgetItem } from '../models';

/** Parse a free-typed amount field; blank or unparseable → null. */
export function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

/**
 * Round to 2 decimals, half away from zero — the server's MidpointRounding.AwayFromZero,
 * not JS's Math.round (which breaks ties toward +∞ and would turn -0.125 into -0.12).
 *
 * Exact parity is only possible where the midpoint survives binary floating point: the
 * server computes in `decimal`, so a half-cent product like 2.5 x 19.99 lands a cent apart
 * (the double is already 49.974999…). The server's value is the one that is stored, and the
 * item is re-read after every save, so the difference cannot outlive the dialog.
 */
export function round2(n: number): number {
  return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100) / 100;
}

/**
 * The amount an item will be saved with: quantity x unit price when both are given
 * (the unit price carries the sign), otherwise the typed amount. null = not yet valid.
 */
export function itemAmount(qtyStr: string, priceStr: string, amountStr: string): number | null {
  const qty = parseNum(qtyStr);
  const price = parseNum(priceStr);
  if (qty !== null && price !== null) return round2(qty * price);
  return parseNum(amountStr);
}

/** Signed sum of a budget's items: negative = net planned spend. */
export function plannedTotal(items: readonly BudgetItem[]): number {
  return round2(items.reduce((sum, i) => sum + i.amount, 0));
}

/** Planned spend only (the negative lines), as a negative number. */
export function plannedOut(items: readonly BudgetItem[]): number {
  return round2(items.filter((i) => i.amount < 0).reduce((sum, i) => sum + i.amount, 0));
}

/** Planned income only (the positive lines). */
export function plannedIn(items: readonly BudgetItem[]): number {
  return round2(items.filter((i) => i.amount > 0).reduce((sum, i) => sum + i.amount, 0));
}
