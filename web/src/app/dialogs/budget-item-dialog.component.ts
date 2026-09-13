import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { fmtMoney } from '../core/money-util';

@Component({
  selector: 'app-budget-item-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.budgetItemDialog(); as d) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ d.id == null ? store.t('dialog.budgetItem.new') : store.t('dialog.budgetItem.edit') }}</h2>

          <label class="field">
            <span class="kicker">{{ store.t('dialog.budgetItem.itemLabel') }}</span>
            <input class="input" [value]="d.title" [placeholder]="store.t('dialog.budgetItem.titlePlaceholder')"
                   (input)="patch({ title: value($event) })" autofocus>
          </label>

          <label class="field mt">
            <span class="kicker">
              {{ store.t('dialog.budgetItem.amount') }}
              <span class="hint">{{ store.t('dialog.budgetItem.amountHint') }}</span>
            </span>
            <input class="input amount" inputmode="decimal" [value]="amountField()"
                   [placeholder]="store.t('dialog.budgetItem.amountPlaceholder')"
                   [disabled]="priced()"
                   (input)="patch({ amountStr: value($event) })">
          </label>

          <!-- optional pricing: fills the amount in for you -->
          <div class="field mt">
            <span class="kicker">
              {{ store.t('dialog.budgetItem.pricing') }}
              <span class="hint">{{ store.t('dialog.budgetItem.optional') }}</span>
            </span>
            <div class="pricing">
              <input class="input qty" inputmode="decimal" [value]="d.qtyStr"
                     [placeholder]="store.t('dialog.budgetItem.quantity')"
                     (input)="patch({ qtyStr: value($event) })">
              <span class="times">×</span>
              <input class="input qty" inputmode="decimal" [value]="d.priceStr"
                     [placeholder]="store.t('dialog.budgetItem.unitPrice')"
                     (input)="patch({ priceStr: value($event) })">
            </div>
            <p class="sub-hint">
              {{ store.t('dialog.budgetItem.pricingHint') }}
              @if (priced()) {
                <strong class="computed">{{ store.t('dialog.budgetItem.computed', { amount: computed() }) }}</strong>
              }
            </p>
          </div>

          <!-- optional main category -->
          <div class="field mt">
            <span class="kicker">
              {{ store.t('dialog.budgetItem.category') }}
              <span class="hint">{{ store.t('dialog.budgetItem.categoryHint') }}</span>
            </span>
            <div class="chips">
              @for (m of store.mains(); track m.id) {
                <button class="chip main" [class.on]="d.mainId === m.id"
                        (click)="store.setBudgetItemMain(m.id)">{{ m.name }}</button>
              }
            </div>
          </div>

          <!-- optional subcategories; may belong to any main -->
          <div class="field mt">
            <span class="kicker">
              {{ store.t('dialog.budgetItem.subcategories') }}
              <span class="hint">{{ store.t('dialog.budgetItem.optional') }}</span>
            </span>
            <div class="chips">
              @for (m of store.mains(); track m.id) {
                <button class="chip main" [class.on]="store.isMainExpanded(m.id)"
                        (click)="store.toggleMainExpand(m.id)">{{ m.name }}</button>
              }
            </div>
            @for (m of store.mains(); track m.id) {
              @if (store.isMainExpanded(m.id)) {
                <div class="cat-main">{{ m.name }}</div>
                <div class="chips">
                  @for (s of store.subsOf(m.id); track s.id) {
                    <button class="chip" [class.on]="d.catIds.includes(s.id)"
                            (click)="store.toggleBudgetItemCat(s.id)">{{ s.name }}</button>
                  }
                </div>
              }
            }
          </div>

          <label class="field mt">
            <span class="kicker">
              {{ store.t('dialog.budgetItem.note') }}
              <span class="hint">{{ store.t('dialog.budgetItem.optional') }}</span>
            </span>
            <textarea class="input note" rows="3" [value]="d.note"
                      [placeholder]="store.t('dialog.budgetItem.notePlaceholder')"
                      (input)="patch({ note: value($event) })"></textarea>
          </label>

          @if (store.budgetError(); as e) { <p class="err">{{ e }}</p> }

          <div class="dialog-actions">
            @if (d.id != null) {
              <button class="btn btn-ghost del" (click)="store.deleteBudgetItemFromDialog()">{{ store.t('dialog.budgetItem.delete') }}</button>
            }
            <span class="spacer"></span>
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!canSave()"
                    (click)="store.saveBudgetItem()">{{ store.t('dialog.budgetItem.save') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog { max-height: 90vh; overflow-y: auto; }
    .dialog-actions {
      position: sticky;
      bottom: calc(-1 * var(--space-6));
      margin: var(--space-6) calc(-1 * var(--space-6)) calc(-1 * var(--space-6));
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface);
      border-top: 1px solid var(--color-divider);
    }
    .mt { margin-top: var(--space-4); }
    .hint { text-transform: none; letter-spacing: 0; color: var(--muted-strong); }
    .amount { max-width: 200px; font-family: var(--font-mono); }
    .amount:disabled { opacity: 0.55; }
    .pricing { display: flex; align-items: center; gap: 8px; }
    .qty { max-width: 130px; font-family: var(--font-mono); }
    .times { font-family: var(--font-mono); color: var(--muted); }
    .sub-hint { margin: 8px 0 0; font-size: 12px; color: var(--muted-strong); line-height: 1.45; }
    .computed { display: block; margin-top: 4px; font-family: var(--font-mono); color: var(--color-accent); }
    .note { resize: vertical; min-height: 60px; font-family: inherit; line-height: 1.5; }
    .cat-main { font-weight: 700; font-size: 12px; margin: 10px 0 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip.main.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
    .err { margin: 12px 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-danger); }
    .spacer { flex: 1; }
    .del { color: var(--muted); }
    .del:hover { color: var(--color-danger); }
  `],
})
export class BudgetItemDialogComponent {
  store = inject(TaskStore);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  patch(p: Parameters<TaskStore['updateBudgetItemDialog']>[0]): void { this.store.updateBudgetItemDialog(p); }
  close(): void { this.store.budgetItemDialog.set(null); }

  /** Quantity and unit price both filled — the amount is derived, so its field is read-only. */
  priced(): boolean {
    const d = this.store.budgetItemDialog();
    if (!d) return false;
    return d.qtyStr.trim() !== '' && d.priceStr.trim() !== '' && this.store.budgetItemAmount() !== null;
  }

  /** Shows the derived amount while pricing drives it, so the field never reads stale. */
  amountField(): string {
    const d = this.store.budgetItemDialog();
    if (!d) return '';
    if (!this.priced()) return d.amountStr;
    return String(this.store.budgetItemAmount() ?? '');
  }

  computed(): string {
    const n = this.store.budgetItemAmount();
    return n === null ? '—' : fmtMoney(n);
  }

  canSave(): boolean {
    const d = this.store.budgetItemDialog();
    return !!d && d.title.trim() !== '' && this.store.budgetItemAmount() !== null;
  }
}
