// Faithful port of the prototype's date helpers (Tasks.dc.html:611-636).
// Change from prototype: "now" is the real current day, not the fixed 2026-07-17.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local midnight of today. */
export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function diffDays(iso: string): number {
  return Math.round((parseISO(iso).getTime() - startOfToday().getTime()) / 86400000);
}

export function dueLabel(iso: string): string {
  const n = diffDays(iso), d = parseISO(iso);
  if (n < 0) return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n <= 6) return WDAYS[d.getDay()];
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export type DueTone = 'muted' | 'over' | 'today';

export function dueTone(iso: string, done: boolean): DueTone {
  if (done) return 'muted';
  const n = diffDays(iso);
  if (n < 0) return 'over';
  if (n === 0) return 'today';
  return 'muted';
}
