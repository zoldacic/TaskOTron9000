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
            <input class="input part-amount" type="text" inputmode="decimal" [value]="s.bAmount"
                   (input)="set('bAmount', $event)">
          </div>

          <div class="sum" [class.off]="!balanced()">
            <span>{{ store.t('dialog.importSplit.combined', { sum: money(sum()) }) }}</span>
            @if (!balanced()) {
              <span class="sum-warn">{{ store.t('dialog.importSplit.mismatch', { total: money(s.total) }) }}</span>
            }
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
    .sum { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .sum.off { color: var(--color-danger); }
    .sum-warn { color: var(--color-danger); }
    .hint { color: var(--muted-strong); font-size: 12px; margin-top: 12px; }
  `],
})
export class ImportSplitDialogComponent {
  store = inject(TaskStore);

  readonly sum = computed(() => {
    const s = this.store.importSplit();
    if (!s) return 0;
    return (Number(s.aAmount) || 0) + (Number(s.bAmount) || 0);
  });
  /** Both amounts present and numeric — the split can be applied. */
  readonly valid = computed(() => {
    const s = this.store.importSplit();
    if (!s) return false;
    return s.aAmount.trim() !== '' && s.bAmount.trim() !== ''
      && !Number.isNaN(Number(s.aAmount)) && !Number.isNaN(Number(s.bAmount));
  });
  /** The two parts add back up to the original amount (within a cent). */
  readonly balanced = computed(() => {
    const s = this.store.importSplit();
    if (!s || !this.valid()) return true; // don't flag a mismatch while the numbers are incomplete
    return Math.abs(this.sum() - s.total) < 0.005;
  });

  money(n: number): string { return fmtMoney(n); }
  set(k: 'aTitle' | 'aAmount' | 'bTitle' | 'bAmount', e: Event): void {
    this.store.setImportSplitField(k, (e.target as HTMLInputElement).value);
  }
  close(): void { this.store.importSplit.set(null); }
}
