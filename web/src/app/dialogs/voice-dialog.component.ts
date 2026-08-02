import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { IconComponent } from '../shared/icon.component';

/**
 * Listens for one spoken task. Nothing is saved here — when the utterance ends the store
 * parses it and opens the normal task dialog, prefilled, for the user to confirm.
 */
@Component({
  selector: 'app-voice-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (store.voiceOpen()) {
      <div class="dialog-backdrop" (click)="store.cancelVoice()">
        <div class="dialog narrow" (click)="$event.stopPropagation()"
             (keydown.escape)="store.cancelVoice()">
          <h2 class="dialog-title">{{ store.t('dialog.voice.title') }}</h2>

          @if (!store.voiceSupported()) {
            <div class="notice">
              <app-icon name="alert-triangle" [size]="15" />
              <span>{{ store.t('dialog.voice.unsupported') }}</span>
            </div>
            <div class="dialog-actions">
              <button class="btn btn-secondary" (click)="store.cancelVoice()">{{ store.t('common.close') }}</button>
            </div>
          } @else {
            <p class="dialog-sub">{{ store.t('dialog.voice.sub') }}</p>

            <!-- The language you speak, which need not be the language the app is read in. -->
            <div class="lang-row">
              <span class="kicker">{{ store.t('dialog.voice.spokenLanguage') }}</span>
              <div class="seg">
                <button class="seg-opt" [class.active]="store.voiceLang() === 'en'"
                        (click)="store.setVoiceLang('en')">{{ store.t('dialog.voice.lang.en') }}</button>
                <button class="seg-opt" [class.active]="store.voiceLang() === 'sv'"
                        (click)="store.setVoiceLang('sv')">{{ store.t('dialog.voice.lang.sv') }}</button>
              </div>
            </div>

            <div class="mic" [class.live]="store.voiceListening()">
              <app-icon name="mic" [size]="28" />
            </div>
            <div class="status">
              {{ store.voiceListening() ? store.t('dialog.voice.listening') : store.t('dialog.voice.idle') }}
            </div>

            <div class="heard" [class.dim]="!store.voiceTranscript()">
              {{ store.voiceTranscript() || store.t('dialog.voice.example') }}
            </div>

            @if (store.voiceError(); as err) {
              <div class="notice error mt">
                <app-icon name="alert-triangle" [size]="15" />
                <span>{{ err }}</span>
              </div>
            }

            <div class="dialog-actions">
              <button class="btn btn-secondary" (click)="store.cancelVoice()">{{ store.t('common.cancel') }}</button>
              @if (store.voiceListening()) {
                <button class="btn btn-primary" [disabled]="!store.voiceTranscript().trim()"
                        (click)="store.stopVoice()">{{ store.t('dialog.voice.useIt') }}</button>
              } @else {
                <button class="btn btn-primary" (click)="store.startVoice()">{{ store.t('dialog.voice.retry') }}</button>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .narrow { width: 400px; }
    .lang-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
      padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-divider);
    }
    .mic {
      display: grid; place-items: center; width: 64px; height: 64px;
      margin: var(--space-4) auto var(--space-2);
      color: var(--muted); border: 1px solid var(--color-divider);
    }
    .mic.live {
      color: var(--color-accent); border-color: var(--color-accent);
      animation: omBlink 1.1s ease-in-out infinite;
    }
    .status {
      text-align: center; font-family: var(--font-mono); font-size: 12px;
      color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .heard {
      margin-top: var(--space-4); min-height: 56px; padding: 10px 12px;
      border: 1px solid var(--color-divider); background: var(--tint-surface);
      font-family: var(--font-mono); font-size: 13px; line-height: 1.5; word-break: break-word;
    }
    .heard.dim { color: var(--muted); }
    .notice {
      display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.5;
      color: var(--color-amber); border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
      background: color-mix(in srgb, var(--color-amber) 12%, transparent); padding: 10px 12px;
    }
    .notice.error {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    }
    .mt { margin-top: var(--space-3); }
  `],
})
export class VoiceDialogComponent {
  store = inject(TaskStore);
}
