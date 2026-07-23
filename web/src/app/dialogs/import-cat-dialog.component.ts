import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-import-cat-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.importCat(); as c) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ store.t('dialog.importCat.title') }}</h2>
          <p class="dialog-sub">{{ c.title }}</p>

          <!-- required single main category -->
          <div class="field">
            <span class="kicker">{{ store.t('dialog.importCat.category') }} <span class="req">*</span></span>
            <div class="chips">
              @for (m of store.mains(); track m.id) {
                <button class="chip main" [class.on]="c.mainId === m.id"
                        (click)="store.setImportCatMain(m.id)">{{ m.name }}</button>
              }
            </div>
          </div>

          <!-- optional subcategories; may belong to any main -->
          <div class="field">
            <span class="kicker">{{ store.t('dialog.importCat.subcategories') }} <span class="hint">{{ store.t('dialog.task.optional') }}</span></span>
            @for (m of store.mains(); track m.id) {
              <div class="cat-main">{{ m.name }}</div>
              <div class="chips">
                @for (s of store.subsOf(m.id); track s.id) {
                  <button class="chip" [class.on]="c.catIds.includes(s.id)" (click)="store.toggleImportCat(s.id)">{{ s.name }}</button>
                }
              </div>
            }
          </div>

          <!-- optional free-text note -->
          <label class="field">
            <span class="kicker">{{ store.t('dialog.importCat.note') }} <span class="hint">{{ store.t('dialog.task.optional') }}</span></span>
            <textarea class="input note" rows="2" [value]="c.note" [placeholder]="store.t('dialog.importCat.notePlaceholder')"
                      (input)="store.setImportCatNote(value($event))"></textarea>
          </label>

          <label class="check">
            <input type="checkbox" [checked]="c.applyAll" (change)="flag('applyAll', $event)">
            <span>{{ store.t('dialog.importCat.applyAll', { count: matchCount(), match: c.match }) }}</span>
          </label>
          <label class="check">
            <input type="checkbox" [checked]="c.remember" (change)="flag('remember', $event)">
            <span>{{ store.t('dialog.importCat.remember', { match: c.match }) }}</span>
          </label>
          @if (c.applyAll || c.remember) {
            <div class="match-picker">
              <span class="match-hint">{{ store.t('dialog.importCat.applyAllHint') }}</span>
              <span class="match-title" (mouseup)="captureSelection()" (dblclick)="captureSelection()">{{ c.title }}</span>
            </div>
          }

          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!c.mainId" (click)="store.saveImportCat()">{{ store.t('dialog.importCat.apply') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog { max-height: 90vh; overflow-y: auto; }
    .field { margin-top: var(--space-4); }
    .req { color: var(--color-accent); }
    .hint { text-transform: none; letter-spacing: 0; color: var(--muted-strong); }
    .cat-main { font-weight: 700; font-size: 12px; margin: 10px 0 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip.main.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
    .note { resize: vertical; min-height: 44px; font-family: inherit; line-height: 1.5; }
    .check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; cursor: pointer; }
    .check input { accent-color: var(--color-accent); width: 16px; height: 16px; }
    .match-picker { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0 24px; }
    .match-hint { font-size: 12px; color: var(--muted-strong); }
    .match-title {
      align-self: flex-start; font-family: var(--font-mono); font-size: 13px;
      padding: 4px 8px; background: var(--tint-surface); border: 1px solid var(--color-divider);
      user-select: text; cursor: text; white-space: pre-wrap; word-break: break-all;
    }
    .match-title::selection { background: var(--color-accent); color: #fff; }
  `],
})
export class ImportCatDialogComponent {
  store = inject(TaskStore);

  /** How many import rows contain the current match substring (drives the "apply to all" count). */
  matchCount(): number {
    const c = this.store.importCat();
    if (!c) return 0;
    const m = c.match.trim().toLowerCase();
    if (!m) return 0;
    return (this.store.importRows() ?? []).filter((r) => r.title.trim().toLowerCase().includes(m)).length;
  }

  /** Use the user's text selection within the title as the match; a bare click (no selection) leaves it unchanged. */
  captureSelection(): void {
    const text = window.getSelection()?.toString() ?? '';
    if (text.trim()) this.store.setImportCatMatch(text);
  }

  value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }

  flag(k: 'applyAll' | 'remember', e: Event): void {
    this.store.setImportCatFlag(k, (e.target as HTMLInputElement).checked);
  }
  close(): void { this.store.importCat.set(null); }
}
