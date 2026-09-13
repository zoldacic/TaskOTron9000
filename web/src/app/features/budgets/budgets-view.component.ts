import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { IconComponent } from '../../shared/icon.component';
import { fmtMoney } from '../../core/money-util';
import { BudgetSummary } from '../../models';

@Component({
  selector: 'app-budgets-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="view om-scroll">
      <header class="head">
        <h1 class="view-title">{{ store.t('budget.title') }}</h1>
        <div class="view-sub">{{ store.t('budget.sub') }}</div>
      </header>

      <section class="block">
        <button class="btn btn-primary new" (click)="store.openNewBudget()">
          <app-icon name="plus" [size]="14" /> {{ store.t('budget.new') }}
        </button>

        @if (store.budgets().length === 0) {
          <div class="empty">
            <h2>{{ store.t('budget.empty.title') }}</h2>
            <p>{{ store.t('budget.empty.body') }}</p>
          </div>
        } @else {
          <div class="list">
            @for (b of store.budgets(); track b.id) {
              <div class="row rule-1">
                <a class="main" [routerLink]="['/budgets', b.id]" [attr.aria-label]="store.t('budget.open')">
                  <span class="name">{{ b.name }}</span>
                  <span class="range">{{ store.t('budget.range', { from: b.from, to: b.to }) }}</span>
                  <span class="count">{{ itemsLabel(b) }}</span>
                </a>
                <span class="total" [class.in]="b.plannedTotal >= 0" [class.out]="b.plannedTotal < 0">
                  {{ fmt(b.plannedTotal) }}
                </span>
                <button class="btn-icon" (click)="store.openEditBudget(b.id)" [attr.aria-label]="store.t('budget.edit')">
                  <app-icon name="pencil" />
                </button>
                <button class="btn-icon danger" (click)="store.askRemoveBudget(b.id)" [attr.aria-label]="store.t('budget.delete')">
                  <app-icon name="trash" />
                </button>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .view { height: 100%; overflow-y: auto; }
    .head { padding: 24px 24px 16px; }
    .block { padding: 0 24px 24px; }
    .new { display: inline-flex; align-items: center; gap: 8px; }
    .list { margin-top: 16px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
    .main {
      flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 12px;
      text-decoration: none; color: var(--color-text); cursor: pointer;
    }
    .main:hover .name { color: var(--color-accent); }
    .name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .range, .count { font-family: var(--font-mono); font-size: 12px; color: var(--muted); flex: none; }
    .total { font-family: var(--font-mono); font-size: 14px; flex: none; }
    .total.in { color: var(--color-income); }
    .total.out { color: var(--color-danger); }
    .empty { margin-top: 32px; max-width: 520px; }
    .empty h2 { font-size: 16px; margin: 0 0 8px; }
    .empty p { color: var(--muted-strong); line-height: 1.5; margin: 0; }

    @media (max-width: 760px) {
      .head { padding: 16px 16px 12px; }
      .block { padding: 0 16px 16px; }
      /* Name over its dates rather than a squeezed single line. */
      .main { flex-direction: column; align-items: flex-start; gap: 2px; }
    }
  `],
})
export class BudgetsViewComponent {
  store = inject(TaskStore);

  fmt(n: number): string { return fmtMoney(n); }

  itemsLabel(b: BudgetSummary): string {
    return this.store.t(b.itemCount === 1 ? 'budget.itemCount' : 'budget.itemsCount', { count: b.itemCount });
  }
}
