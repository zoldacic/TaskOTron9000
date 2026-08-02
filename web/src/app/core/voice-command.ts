// Turns one spoken sentence into a task draft: "lägg till köp mjölk imorgon 45 kr mat"
// becomes { title: 'Köp mjölk', due: <tomorrow>, amount: -45, subId: 'mat' }.
//
// Pure, like the other core helpers — the browser's SpeechRecognition plumbing lives in
// speech.service.ts, so every rule below is covered by voice-command.spec.ts.
//
// The sentence is tokenized once and then *consumed*: each step marks the tokens it
// recognised, and whatever is left over becomes the title. Matching is token equality,
// which gives word boundaries for free — the subcategory "Mat" can never match inside
// "matlåda".

import { DateKind, Main, Sub } from '../models';
import { Lang } from './i18n/types';
import { addDays, startOfToday, toISO } from './date-util';

/** What a spoken phrase turned into. Every field is null when it wasn't heard. */
export interface VoiceCommand {
  /** Everything left after the recognised phrases were stripped, tidied. */
  title: string;
  /** ISO yyyy-MM-dd, or null when no date phrase was heard. */
  due: string | null;
  /** Signed amount — negative is money out, this app's convention. */
  amount: number | null;
  /** 'transaction' when an amount was heard (the amount field only shows then), else 'due'. */
  dateKind: DateKind;
  /** Main category id — spoken directly, or the main owning a matched subcategory. */
  mainId: string | null;
  /** Subcategory id, or null. */
  subId: string | null;
  /** The original-case phrases that were consumed, so the UI can say what it understood. */
  matched: {
    command: string | null;
    date: string | null;
    amount: string | null;
    category: string | null;
  };
}

// ---- grammar tables ----
// Both languages are always tried, the active one first: it costs nothing and forgives
// the recogniser mishearing which language was spoken.

const COMMAND_PREFIXES: Record<Lang, string[]> = {
  en: [
    'add a new task to', 'add a new task', 'add a task to', 'add a task', 'create a task',
    'new task', 'add task', 'remind me to', 'add', 'create', 'new',
  ],
  sv: [
    'lägg till en ny uppgift', 'lägg till en uppgift', 'lägg till uppgift', 'lägg till',
    'ny uppgift', 'skapa uppgift', 'påminn mig om att', 'påminn mig att', 'skapa',
  ],
};

/** Phrase → offset in days from today. */
const RELATIVE_DATES: Record<Lang, [string, number][]> = {
  en: [
    ['the day after tomorrow', 2], ['day after tomorrow', 2], ['next week', 7],
    ['today', 0], ['tonight', 0], ['tomorrow', 1], ['yesterday', -1],
  ],
  sv: [
    ['i övermorgon', 2], ['övermorgon', 2], ['nästa vecka', 7], ['i dag', 0], ['i morgon', 1],
    ['i går', -1], ['idag', 0], ['ikväll', 0], ['imorgon', 1], ['igår', -1],
  ],
};

/** Indexed to Date.getDay(): 0 = Sunday. */
const WEEKDAYS: Record<Lang, string[]> = {
  en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  sv: ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'],
};

/** Swallowed together with the weekday they introduce ("on monday", "på lördag"). */
const WEEKDAY_PARTICLES: Record<Lang, string[]> = {
  en: ['on', 'this', 'next'],
  sv: ['på', 'i', 'nästa'],
};
/** A particle that pushes the weekday a further week out. */
const NEXT_WORDS = new Set(['next', 'nästa']);

/** "in 3 days" / "om 3 dagar". */
const IN_WORDS = new Set(['in', 'om']);
const DAY_WORDS = new Set(['days', 'day', 'dagar', 'dag']);

/** Day-of-month needs its article, so a bare number is never mistaken for a date. */
const DAY_ARTICLES = new Set(['the', 'den']);
const DAY_ARTICLE_LEAD = new Set(['on', 'på']);
const DAY_OF_MONTH_RE = /^(\d{1,2})(?:st|nd|rd|th|:e|:a|\.)?$/;

const CURRENCY = new Set([
  'kr', 'kronor', 'krona', 'spänn', 'sek',
  'dollar', 'dollars', 'usd', 'bucks', 'crown', 'crowns',
  'euro', 'euros', 'eur',
]);
const GLUED_AMOUNT_RE = /^(\d+(?:[.,]\d{1,2})?)(kr|kronor|sek|usd|eur)$/;

/** Words that mean the money came *in*. Anything else with an amount is money out. */
const INCOME_CUES = new Set([
  'got', 'received', 'earned', 'refund', 'refunded', 'salary', 'income', 'deposit',
  'fick', 'tjänade', 'lön', 'inkomst', 'återbetalning', 'insättning',
]);

// ---- tokens ----

interface Tok {
  raw: string;
  norm: string;
  used: boolean;
}

const EDGE_PUNCT = /^[“”"'([]+|[.,!?;:”"')\]]+$/g;

function normalize(word: string): string {
  return word.toLowerCase().replace(EDGE_PUNCT, '');
}

function tokenize(s: string): Tok[] {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalize(raw), used: false }));
}

/** First index where `words` matches consecutive unused tokens, else -1. */
function findWindow(toks: Tok[], words: string[], from = 0): number {
  outer: for (let i = from; i + words.length <= toks.length; i++) {
    for (let k = 0; k < words.length; k++) {
      const t = toks[i + k];
      if (t.used || t.norm !== words[k]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Marks a window used and returns the original-case phrase it covered. */
function consume(toks: Tok[], start: number, count: number): string {
  const phrase = toks.slice(start, start + count).map((t) => t.raw).join(' ');
  for (let k = start; k < start + count; k++) toks[k].used = true;
  return phrase;
}

/** Active language first, then the other one. */
function langOrder(lang: Lang): Lang[] {
  return lang === 'sv' ? ['sv', 'en'] : ['en', 'sv'];
}

function words(phrase: string): string[] {
  return phrase.split(/\s+/).map(normalize).filter(Boolean);
}

// ---- steps ----

/** Drops a leading "add a task to" / "lägg till", but never the whole sentence. */
function stripCommandPrefix(toks: Tok[], lang: Lang): string | null {
  const phrases = langOrder(lang)
    .flatMap((l) => COMMAND_PREFIXES[l])
    .map(words)
    .sort((a, b) => b.length - a.length);
  for (const w of phrases) {
    if (w.length >= toks.length) continue; // something must be left to be the task
    if (findWindow(toks, w, 0) === 0) return consume(toks, 0, w.length);
  }
  return null;
}

interface CatMatch {
  mainId: string;
  subId: string | null;
  phrase: string;
}

/**
 * Matches a spoken category name against the user's own categories — never a hardcoded
 * list, because the real data is Swedish. Longest name wins, so "Mat ute" beats "Mat".
 */
function matchCategory(toks: Tok[], mains: Main[], subs: Sub[]): CatMatch | null {
  const cands = [
    ...subs.map((s) => ({ id: s.id, mainId: s.mainId, isSub: true, w: words(s.name) })),
    ...mains.map((m) => ({ id: m.id, mainId: m.id, isSub: false, w: words(m.name) })),
  ]
    .filter((c) => c.w.length > 0)
    // Stable sort, so a sub still wins a tie against a main of the same name.
    .sort((a, b) => b.w.length - a.w.length || b.w.join('').length - a.w.join('').length);

  for (const c of cands) {
    const i = findWindow(toks, c.w);
    if (i === -1) continue;
    return { mainId: c.mainId, subId: c.isSub ? c.id : null, phrase: consume(toks, i, c.w.length) };
  }
  return null;
}

/** "1.243,01" and "12,50" and "45" — the recogniser writes numbers however it likes. */
function toNumber(norm: string): number | null {
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(norm)) {
    return Number(norm.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+(?:[.,]\d{1,2})?$/.test(norm)) return Number(norm.replace(',', '.'));
  return null;
}

/**
 * "1 250" — Swedish writes the thousands separator as a space, so the groups arrive as
 * separate tokens. Returns the value and the last token index it covered.
 */
function readGroupedNumber(toks: Tok[], i: number): { value: number; end: number } | null {
  if (!/^\d{1,3}$/.test(toks[i].norm)) return null;
  let digits = toks[i].norm;
  let decimals = '';
  let end = i;
  while (end + 1 < toks.length && !toks[end + 1].used) {
    const m = /^(\d{3})(?:,(\d{1,2}))?$/.exec(toks[end + 1].norm);
    if (!m) break;
    digits += m[1];
    end += 1;
    if (m[2]) {
      decimals = m[2];
      break;
    }
  }
  if (end === i) return null;
  return { value: Number(decimals ? `${digits}.${decimals}` : digits), end };
}

interface AmountMatch {
  value: number;
  /** -1 / 1 when the speaker said "minus" / "plus", 0 when they didn't. */
  sign: number;
  phrase: string;
}

/**
 * A number only counts as money when a currency word is stuck to it — otherwise
 * "buy 2 apples" would cost two kronor.
 */
function matchAmount(toks: Tok[]): AmountMatch | null {
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].used) continue;
    let start = i;
    let end = i;
    let value: number | null = null;

    const glued = GLUED_AMOUNT_RE.exec(toks[i].norm);
    const grouped = glued ? null : readGroupedNumber(toks, i);
    const afterGroup = grouped ? toks[grouped.end + 1] : undefined;

    if (glued) {
      value = toNumber(glued[1]);
    } else if (grouped && afterGroup && !afterGroup.used && CURRENCY.has(afterGroup.norm)) {
      value = grouped.value;
      end = grouped.end + 1;
    } else {
      value = toNumber(toks[i].norm);
      if (value === null) continue;
      const after = toks[i + 1];
      const before = toks[i - 1];
      if (after && !after.used && CURRENCY.has(after.norm)) end = i + 1;
      else if (before && !before.used && CURRENCY.has(before.norm)) start = i - 1;
      else continue;
    }
    if (value === null) continue;

    let sign = 0;
    const sgn = toks[start - 1];
    if (sgn && !sgn.used && (sgn.norm === 'minus' || sgn.norm === 'plus')) {
      sign = sgn.norm === 'minus' ? -1 : 1;
      start -= 1;
    }
    return { value, sign, phrase: consume(toks, start, end - start + 1) };
  }
  return null;
}

interface DateMatch {
  iso: string;
  phrase: string;
}

function matchDate(toks: Tok[], lang: Lang, today: Date): DateMatch | null {
  const order = langOrder(lang);

  // 1. relative phrases, longest first
  const rel = order
    .flatMap((l) => RELATIVE_DATES[l])
    .map(([phrase, offset]) => ({ w: words(phrase), offset }))
    .sort((a, b) => b.w.length - a.w.length);
  for (const r of rel) {
    const i = findWindow(toks, r.w);
    if (i !== -1) return { iso: toISO(addDays(today, r.offset)), phrase: consume(toks, i, r.w.length) };
  }

  // 2. "in 3 days" / "om 3 dagar"
  for (let i = 0; i + 2 < toks.length; i++) {
    const [a, b, c] = [toks[i], toks[i + 1], toks[i + 2]];
    if (a.used || b.used || c.used) continue;
    if (!IN_WORDS.has(a.norm) || !DAY_WORDS.has(c.norm)) continue;
    const n = toNumber(b.norm);
    if (n === null || !Number.isInteger(n) || n < 1 || n > 99) continue;
    return { iso: toISO(addDays(today, n)), phrase: consume(toks, i, 3) };
  }

  // 3. weekday, optionally introduced by "on" / "på" / "next" / "nästa"
  const days = order.flatMap((l) => WEEKDAYS[l].map((name, day) => ({ name, day })));
  const particles = new Set(order.flatMap((l) => WEEKDAY_PARTICLES[l]));
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].used) continue;
    const hit = days.find((d) => d.name === toks[i].norm);
    if (!hit) continue;
    let start = i;
    let nextWeek = false;
    const lead = toks[i - 1];
    if (lead && !lead.used && particles.has(lead.norm)) {
      nextWeek = NEXT_WORDS.has(lead.norm);
      start = i - 1;
    }
    // A bare weekday means the next one ahead, never today.
    let delta = (hit.day - today.getDay() + 7) % 7 || 7;
    if (nextWeek) delta += 7;
    return { iso: toISO(addDays(today, delta)), phrase: consume(toks, start, i - start + 1) };
  }

  // 4. "on the 5th" / "den 20:e" — the article is required
  for (let i = 0; i + 1 < toks.length; i++) {
    if (toks[i].used || toks[i + 1].used) continue;
    if (!DAY_ARTICLES.has(toks[i].norm)) continue;
    const m = DAY_OF_MONTH_RE.exec(toks[i + 1].norm);
    if (!m) continue;
    const day = Number(m[1]);
    if (day < 1 || day > 31) continue;
    let start = i;
    const lead = toks[i - 1];
    if (lead && !lead.used && DAY_ARTICLE_LEAD.has(lead.norm)) start = i - 1;
    // The 5th, spoken on the 17th, means next month's 5th.
    const inMonth = new Date(today.getFullYear(), today.getMonth(), day);
    const d = inMonth.getTime() < today.getTime()
      ? new Date(today.getFullYear(), today.getMonth() + 1, day)
      : inMonth;
    return { iso: toISO(d), phrase: consume(toks, start, i + 1 - start + 1) };
  }

  return null;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : '';
}

/** Whatever survived, joined back up. */
function leftovers(toks: Tok[]): string {
  return toks
    .filter((t) => !t.used)
    .map((t) => t.raw)
    .join(' ')
    .replace(EDGE_PUNCT, '')
    .trim();
}

/**
 * Turns one spoken sentence into a task draft. `today` is a parameter so specs never
 * depend on the calendar.
 */
export function parseVoiceCommand(
  transcript: string,
  lang: Lang,
  mains: Main[],
  subs: Sub[],
  today: Date = startOfToday(),
): VoiceCommand {
  const toks = tokenize(transcript);

  const command = stripCommandPrefix(toks, lang);
  const cat = matchCategory(toks, mains, subs);
  const money = matchAmount(toks);
  const date = matchDate(toks, lang, today);

  let amount: number | null = null;
  if (money) {
    const income = money.sign !== 0
      ? money.sign > 0
      : toks.some((t) => !t.used && INCOME_CUES.has(t.norm));
    amount = income ? money.value : -money.value;
  }

  // If everything was recognised, the category name is a better title than nothing.
  const title = capitalize(leftovers(toks) || (cat ? cat.phrase : ''));

  return {
    title,
    due: date?.iso ?? null,
    amount,
    dateKind: amount == null ? 'due' : 'transaction',
    mainId: cat?.mainId ?? null,
    subId: cat?.subId ?? null,
    matched: {
      command,
      date: date?.phrase ?? null,
      amount: money?.phrase ?? null,
      category: cat?.phrase ?? null,
    },
  };
}
