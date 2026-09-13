import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-budget-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.budgetDialog(); as d) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog narrow" (click)="$event.stopPropagation()" (keydown.escape)="close()">
          <h2 class="dialog-title">{{ d.id == null ? store.t('dialog.budget.new') : store.t('dialog.budget.edit') }}</h2>

          <label class="field">
            <span class="kicker">{{ store.t('dialog.budget.name') }}</span>
            <input class="input" [value]="d.name" [placeholder]="store.t('dialog.budget.namePlaceholder')"
                   (input)="patch({ name: value($event) })"
                   (keydown.enter)="save()" autofocus>
          </label>

          <div class="range mt">
            <label class="field">
              <span class="kicker">{{ store.t('dialog.budget.from') }}</span>
              <input class="input date" type="date" [value]="d.from" (input)="patch({ from: value($event) })">
            </label>
            <label class="field">
              <span class="kicker">{{ store.t('dialog.budget.to') }}</span>
              <input class="input date" type="date" [value]="d.to" (input)="patch({ to: value($event) })">
            </label>
          </div>
          <p class="hint">{{ store.t('dialog.budget.rangeHint') }}</p>

          @if (d.from && d.to && d.from > d.to) {
            <p class="err">{{ store.t('dialog.budget.rangeError') }}</p>
          }
          @if (store.budgetError(); as e) { <p class="err">{{ e }}</p> }

          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="store.budgetDraftInvalid()"
                    (click)="save()">{{ store.t('dialog.budget.save') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .narrow { width: 420px; max-width: 100%; }
    .mt { margin-top: var(--space-4); }
    .range { display: flex; gap: 12px; }
    .range .field { flex: 1; min-width: 0; }
    .date { font-family: var(--font-mono); }
    .hint { margin: 8px 0 0; font-size: 12px; color: var(--muted-strong); line-height: 1.45; }
    .err { margin: 8px 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-danger); }
  `],
})
export class BudgetDialogComponent {
  store = inject(TaskStore);
  private router = inject(Router);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  patch(p: Parameters<TaskStore['updateBudgetDialog']>[0]): void { this.store.updateBudgetDialog(p); }
  close(): void { this.store.budgetDialog.set(null); }

  /** A brand-new budget opens straight away — there is nothing to see in the list yet. */
  async save(): Promise<void> {
    const isNew = this.store.budgetDialog()?.id == null;
    const id = await this.store.saveBudget();
    if (id && isNew) await this.router.navigate(['/budgets', id]);
  }
}
