// Thin wrapper around the browser's Web Speech API, so the rest of the app only ever
// deals with "here is what was said" callbacks. The parsing lives in voice-command.ts;
// the state lives in TaskStore. This file holds nothing but the device plumbing.

import { Injectable } from '@angular/core';
import { Lang } from './i18n/types';

// TypeScript's bundled lib.dom does not declare SpeechRecognition, and tsconfig.app.json
// sets "types": [], so @types/dom-speech-recognition would be ignored anyway. Declared
// locally rather than as an ambient global, so no other file can assume it exists.
interface SpeechAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechResult {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [i: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  readonly [i: number]: SpeechResult;
}
interface SpeechResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface SpeechErrorEvent {
  readonly error: string;
  readonly message?: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

/** Chrome and Edge expose it prefixed. Resolved on every call, never cached. */
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null; // may be unavailable
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechHandlers {
  /** Every interim and final chunk; `text` is the whole utterance so far. */
  onTranscript: (text: string, final: boolean) => void;
  /** A SpeechRecognition error code, e.g. 'not-allowed'. Never fired for a deliberate abort. */
  onError: (code: string) => void;
  /** Recognition finished, for any reason. Always the last callback. */
  onEnd: () => void;
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private rec: Recognition | null = null;

  /** Whether this browser can listen at all. */
  get supported(): boolean {
    return recognitionCtor() !== null;
  }

  /** Starts one utterance. Returns false when unsupported or already listening. */
  start(lang: Lang, h: SpeechHandlers): boolean {
    const Ctor = recognitionCtor();
    if (!Ctor || this.rec) return false;

    const rec = new Ctor();
    rec.lang = lang === 'sv' ? 'sv-SE' : 'en-US';
    // One utterance: a natural pause ends it, which is exactly our "done speaking".
    rec.continuous = false;
    rec.interimResults = true; // drives the live transcript in the dialog
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      // An utterance may arrive split across several results — stitch them back together.
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0].transcript;
        final = r.isFinal;
      }
      h.onTranscript(text.trim(), final);
    };
    rec.onerror = (e) => h.onError(e.error);
    rec.onend = () => {
      this.detach();
      h.onEnd();
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // e.g. an InvalidStateError from starting twice in a row.
      this.detach();
      h.onError('generic');
      return false;
    }
    return true;
  }

  /** Finish the current utterance and deliver whatever was heard (fires onEnd). */
  stop(): void {
    try {
      this.rec?.stop();
    } catch { /* already stopped */ }
  }

  /**
   * Throw the utterance away. The handlers are dropped first, so the caller hears nothing
   * more from it — neither the 'aborted' error nor a late onend landing on whatever
   * replaced it.
   */
  abort(): void {
    const rec = this.rec;
    this.detach();
    try {
      rec?.abort();
    } catch { /* already stopped */ }
  }

  /** Drops the handlers so no closure outlives the utterance. */
  private detach(): void {
    const r = this.rec;
    if (!r) return;
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    this.rec = null;
  }
}
