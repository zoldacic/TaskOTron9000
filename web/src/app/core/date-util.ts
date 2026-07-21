// Faithful port of the prototype's date helpers (Tasks.dc.html:611-636).
// Change from prototype: "now" is the real current day, not the fixed 2026-07-17.
// Labels are locale-aware: month/weekday names come from Intl, Today/Tomorrow from the dict.

import { Lang } from './i18n/types';
import { en, TranslationKey } from './i18n/en';
import { sv } from './i18n/sv';

const DICT: Record<Lang, Record<TranslationKey, string>> = { en, sv };
const localeOf = (lang: Lang) => (lang === 'sv' ? 'sv-SE' : 'en-US');
const monthDay = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(localeOf(lang), { month: 'short', day: 'numeric' }).format(d);
const weekday = (d: Date, lang: Lang) =>
  new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long' }).format(d);

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

export function dueLabel(iso: string, lang: Lang = 'en'): string {
  const n = diffDays(iso), d = parseISO(iso);
  if (n < 0) return monthDay(d, lang);
  if (n === 0) return DICT[lang]['date.today'];
  if (n === 1) return DICT[lang]['date.tomorrow'];
  if (n <= 6) return weekday(d, lang);
  return monthDay(d, lang);
}

export type DueTone = 'muted' | 'over' | 'today';

export function dueTone(iso: string, done: boolean): DueTone {
  if (done) return 'muted';
  const n = diffDays(iso);
  if (n < 0) return 'over';
  if (n === 0) return 'today';
  return 'muted';
}
