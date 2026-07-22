import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { fmtMoney } from '../core/money-util';

@Component({
  selector: 'app-import-split-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.importSplit(); as s) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ store.t('dialog.importSplit.title') }}</h2>
          <p class="dialog-sub">{{ store.t('dialog.importSplit.sub', { total: money(s.total) }) }}</p>

          <div class="part">
            <span class="part-label">{{ store.t('dialog.importSplit.partA') }}</span>
            <input class="input part-title" [value]="s.aTitle"
                   [placeholder]="store.t('dialog.importSplit.titlePlaceholder')"
                   (input)="set('aTitle', $event)">
            <input class="input part-amount" type="text" inputmode="decimal" [value]="s.aAmount"
                   (input)="set('aAmount', $event)">
          </div>
          <div class="part">
            <span class="part-label">{{ store.t('dialog.importSplit.partB') }}</span>
            <input class="input part-title" [value]="s.bTitle"
                   [placeholder]="store.t('dialog.importSplit.titlePlaceholder')"
                   (input)="set('bTitle', $event)">
            <span class="part-amount derived" [title]="store.t('dialog.importSplit.remainder')">{{ valid() ? money(remainder()) : '—' }}</span>
          </div>

          <p class="hint">{{ store.t('dialog.importSplit.hint') }}</p>

          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!valid()" (click)="store.saveImportSplit()">{{ store.t('dialog.importSplit.apply') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .part { display: grid; grid-template-columns: 64px 1fr 120px; gap: 10px; align-items: center; margin-top: var(--space-4); }
    .part-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .part-amount { font-family: var(--font-mono); text-align: right; }
    .derived { font-weight: 700; color: var(--muted); align-self: center; }
    .hint { color: var(--muted-strong); font-size: 12px; margin-top: 12px; }
  `],
})
export class ImportSplitDialogComponent {
  store = inject(TaskStore);

  /** Part 1 amount is present and numeric — the split can be applied. */
  readonly valid = computed(() => {
    const s = this.store.importSplit();
    if (!s) return false;
    return s.aAmount.trim() !== '' && !Number.isNaN(Number(s.aAmount));
  });
  /** Part 2's auto-derived amount: whatever is left of the original after part 1. */
  readonly remainder = computed(() => {
    const s = this.store.importSplit();
    if (!s) return 0;
    return Math.round((s.total - Number(s.aAmount)) * 100) / 100;
  });

  money(n: number): string { return fmtMoney(n); }
  set(k: 'aTitle' | 'aAmount' | 'bTitle', e: Event): void {
    this.store.setImportSplitField(k, (e.target as HTMLInputElement).value);
  }
  close(): void { this.store.importSplit.set(null); }
}
