import { ChangeDetectionStrategy, Component, ElementRef, OnInit, effect, inject, viewChild } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { stripMarkdown } from '../../core/markdown-strip';
import { IconComponent } from '../../shared/icon.component';

/**
 * Ask questions about the tasks in plain language.
 *
 * Answers are rendered as plain text (white-space: pre-wrap) rather than parsed
 * markdown — nothing the model writes is ever treated as markup, so there is no
 * injection surface, and Claude is told to answer in prose.
 */
@Component({
  selector: 'app-ask-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="view">
      <header class="head">
        <h1 class="view-title">{{ store.t('ask.title') }}</h1>
        <div class="view-sub">{{ store.t('ask.sub') }}</div>
      </header>

      <div class="thread om-scroll" #thread>
        @if (store.askConfigured() === false) {
          <div class="notice">
            <app-icon name="alert-triangle" [size]="15" />
            <span>{{ store.t('ask.notConfigured') }}</span>
          </div>
        }

        @if (store.askMessages().length === 0) {
          <div class="empty-box">
            <p>{{ store.t('ask.empty') }}</p>
            <p class="ex-label">{{ store.t('ask.examples') }}</p>
            @for (ex of examples; track ex) {
              <button class="ex" (click)="useExample(store.t(ex))">{{ store.t(ex) }}</button>
            }
          </div>
        }

        @for (m of store.askMessages(); track $index) {
          <article class="msg" [class.user]="m.role === 'user'">
            <div class="who kicker">{{ m.role === 'user' ? store.t('ask.you') : store.t('ask.claude') }}</div>
            @if (m.tools?.length) {
              <div class="lookups">
                <span class="kicker lookups-label">{{ store.t('ask.lookedUp') }}</span>
                @for (t of m.tools; track $index) {
                  <div class="lookup"><app-icon name="search" [size]="12" /><span>{{ t }}</span></div>
                }
              </div>
            }
            @if (m.content) {
              <div class="body">{{ display(m.content) }}</div>
            } @else {
              <div class="body pending">{{ store.t('ask.thinking') }}</div>
            }
          </article>
        }

        @if (store.askError(); as e) {
          <div class="notice error">
            <app-icon name="alert-triangle" [size]="15" />
            <span>{{ e }}</span>
          </div>
        }
      </div>

      <footer class="composer">
        <textarea class="input ask-box" rows="2"
                  [placeholder]="store.t('ask.placeholder')"
                  [value]="store.askInput()"
                  (input)="store.askInput.set(value($event))"
                  (keydown.enter)="onEnter($event)"></textarea>
        <div class="buttons">
          @if (store.askBusy()) {
            <button class="btn btn-secondary" (click)="store.stopAsk()">{{ store.t('ask.stop') }}</button>
          } @else {
            <button class="btn btn-primary" [disabled]="!store.askInput().trim()"
                    (click)="store.sendAsk()">{{ store.t('ask.send') }}</button>
          }
          <button class="btn btn-ghost" [disabled]="!store.askMessages().length"
                  (click)="store.clearAsk()">{{ store.t('ask.clear') }}</button>
        </div>
        <p class="help">{{ store.t('ask.hint') }}</p>
      </footer>
    </div>
  `,
  styles: [`
    .view { display: flex; flex-direction: column; height: 100%; }
    .head { padding: 24px 24px 16px; }
    .thread { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 24px 16px; display: flex; flex-direction: column; gap: 16px; }

    .empty-box {
      border: 1px dashed var(--color-divider); padding: 28px 24px; color: var(--muted);
      font-size: 13px; line-height: 1.6;
    }
    .ex-label { margin: 16px 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .ex {
      display: block; width: 100%; text-align: left; background: none; cursor: pointer;
      border: 1px solid var(--color-divider); color: var(--fg);
      padding: 8px 10px; margin-bottom: 6px; font: inherit; font-size: 13px;
    }
    .ex:hover { border-color: var(--color-accent); color: var(--color-accent); }

    .msg { display: flex; flex-direction: column; gap: 6px; max-width: 760px; }
    .msg.user { align-self: flex-end; align-items: flex-end; }
    .who { color: var(--muted); }
    .body {
      white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.65;
      border: 1px solid var(--color-divider); padding: 10px 12px;
    }
    .msg.user .body { background: color-mix(in srgb, var(--color-accent) 10%, transparent); border-color: color-mix(in srgb, var(--color-accent) 35%, transparent); }
    .pending { color: var(--muted); font-style: italic; }

    /* what Claude looked up to answer — shown so a number can be traced back */
    .lookups { display: flex; flex-direction: column; gap: 3px; }
    .lookups-label { color: var(--muted); }
    .lookup {
      display: flex; align-items: center; gap: 6px;
      font-family: var(--font-mono); font-size: 11.5px; color: var(--muted);
    }

    .notice {
      display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.5;
      color: var(--color-amber); border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
      background: color-mix(in srgb, var(--color-amber) 12%, transparent); padding: 10px 12px;
    }
    .notice.error { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 40%, transparent); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }

    .composer { padding: 12px 24px 20px; border-top: 1px solid var(--color-divider); }
    .ask-box { width: 100%; resize: vertical; font-family: var(--font-mono); font-size: 13px; }
    .buttons { display: flex; gap: 8px; margin-top: 8px; }
    .help { color: var(--muted); font-size: 12px; margin-top: 10px; }
  `],
})
export class AskViewComponent implements OnInit {
  store = inject(TaskStore);
  private thread = viewChild<ElementRef<HTMLElement>>('thread');

  readonly examples = ['ask.example1', 'ask.example2', 'ask.example3'] as const;

  constructor() {
    // Follow the answer as it streams in, so the newest text stays visible.
    effect(() => {
      this.store.askMessages();
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  ngOnInit(): void {
    if (this.store.askConfigured() === null) void this.store.refreshAskStatus();
  }

  // Enter sends; Shift+Enter is a newline.
  onEnter(e: Event): void {
    const ev = e as KeyboardEvent;
    if (ev.shiftKey) return;
    ev.preventDefault();
    void this.store.sendAsk();
  }

  useExample(text: string): void {
    this.store.askInput.set(text);
    void this.store.sendAsk();
  }

  /**
   * Answers are stored as received and stripped of markdown decoration only for
   * display, so a marker split across two streamed chunks still resolves and the
   * conversation sent back to the model stays verbatim.
   */
  display(content: string): string { return stripMarkdown(content); }

  value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }
}
