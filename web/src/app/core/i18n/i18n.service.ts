import { Injectable, signal } from '@angular/core';
import { Lang, TParams } from './types';
import { en, TranslationKey } from './en';
import { sv } from './sv';

const DICTS: Record<Lang, Record<TranslationKey, string>> = { en, sv };
const STORAGE_KEY = 'tot.lang';

function initialLang(): Lang {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === 'sv' || stored === 'en' ? stored : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  /** Current UI language. Reading this in a template makes the view react to changes. */
  readonly lang = signal<Lang>(initialLang());

  setLang(l: Lang): void {
    this.lang.set(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage may be unavailable */ }
  }

  /** Translate `key` in the active language, filling {placeholder} params. Falls back to en, then the key. */
  t(key: TranslationKey, params?: TParams): string {
    const template = DICTS[this.lang()][key] ?? en[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      name in params ? String(params[name]) : `{${name}}`);
  }
}
