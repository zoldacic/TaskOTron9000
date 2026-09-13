import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { IconComponent } from '../../shared/icon.component';
import { fmtMoney } from '../../core/money-util';
import { BudgetCompareRow, BudgetItem } from '../../models';
import { UNCATEGORIZED } from '../../core/report-drill';

@Component({
  selector: 'app-budget-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="view om-scroll">
      <a class="back" routerLink="/budgets"><app-icon name="arrow-left" [size]="14" /> {{ store.t('budget.back') }}</a>

      @if (store.activeBudget(); as b) {
        <header class="head">
          <div class="title-row">
            <h1 class="view-title">{{ b.name }}</h1>
            <button class="btn-icon" (click)="store.openEditBudget(b.id)" [attr.aria-label]="store.t('budget.edit')">
              <app-icon name="pencil" />
            </button>
            <button class="btn-icon danger" (click)="remove(b.id)" [attr.aria-label]="store.t('budget.delete')">
              <app-icon name="trash" />
            </button>
          </div>
          <div class="view-sub mono">{{ store.t('budget.range', { from: b.from, to: b.to }) }}</div>
        </header>

        <!-- planned totals -->
        <section class="stats">
          <div class="stat"><span class="kicker">{{ store.t('budget.plannedIn') }}</span><span class="fig in">{{ fmt(store.budgetPlannedIn()) }}</span></div>
          <div class="stat"><span class="kicker">{{ store.t('budget.plannedOut') }}</span><span class="fig out">{{ fmt(store.budgetPlannedOut()) }}</span></div>
          <div class="stat"><span class="kicker">{{ store.t('budget.plannedNet') }}</span><span class="fig" [class.in]="store.budgetPlannedTotal() >= 0" [class.out]="store.budgetPlannedTotal() < 0">{{ fmt(store.budgetPlannedTotal()) }}</span></div>
        </section>

        <!-- items -->
        <section class="block rule-2">
          <div class="block-head">
            <div class="kicker">{{ store.t('budget.col.item') }}</div>
            <button class="btn btn-secondary add" (click)="store.openNewBudgetItem()">
              <app-icon name="plus" [size]="14" /> {{ store.t('budget.addItem') }}
            </button>
          </div>

          @if (b.items.length === 0) {
            <div class="empty">
              <h2>{{ store.t('budget.noItems.title') }}</h2>
              <p>{{ store.t('budget.noItems.body') }}</p>
            </div>
          } @else {
            <div class="table-wrap om-scroll">
              <table class="grid">
                <thead>
                  <tr>
                    <th>{{ store.t('budget.col.item') }}</th>
                    <th>{{ store.t('budget.col.category') }}</th>
                    <th class="num">{{ store.t('budget.col.amount') }}</th>
                    <th class="acts"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of b.items; track i.id) {
                    <tr>
                      <td>
                        <span class="item-title">{{ i.title }}</span>
                        @if (i.note) { <span class="note">{{ i.note }}</span> }
                      </td>
                      <td class="cat">{{ catLabel(i) }}</td>
                      <td class="num">
                        <span [class.in]="i.amount >= 0" [class.out]="i.amount < 0">{{ fmt(i.amount) }}</span>
                        @if (i.quantity !== null && i.unitPrice !== null) {
                          <span class="pricing">{{ i.quantity }} × {{ fmt(i.unitPrice) }}</span>
                        }
                      </td>
                      <td class="acts">
                        <div class="acts-row">
                          <button class="btn-icon" (click)="store.openEditBudgetItem(i.id)" [attr.aria-label]="store.t('budget.editItem')">
                            <app-icon name="pencil" />
                          </button>
                          <button class="btn-icon danger" (click)="store.askRemoveBudgetItem(i.id)" [attr.aria-label]="store.t('budget.deleteItem')">
                            <app-icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2">{{ store.t('budget.total') }}</td>
                    <td class="num" [class.in]="store.budgetPlannedTotal() >= 0" [class.out]="store.budgetPlannedTotal() < 0">
                      {{ fmt(store.budgetPlannedTotal()) }}
                    </td>
                    <td class="acts"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </section>

        <!-- planned vs actual -->
        <section class="block">
          <div class="block-head">
            <div class="kicker">{{ store.t('budget.vsActual') }}</div>
            <div class="seg">
              <button class="seg-opt" [class.active]="store.budgetCompareMode() === 'main'"
                      (click)="store.setBudgetCompareMode('main')">{{ store.t('budget.byMain') }}</button>
              <button class="seg-opt" [class.active]="store.budgetCompareMode() === 'sub'"
                      (click)="store.setBudgetCompareMode('sub')">{{ store.t('budget.bySub') }}</button>
            </div>
          </div>
          <p class="hint">{{ store.t('budget.vsActualHint') }}</p>

          @if (store.budgetCompare(); as c) {
            @if (c.rows.length === 0) {
              <p class="empty-line">{{ store.t('budget.compareEmpty') }}</p>
            } @else {
              <div class="table-wrap om-scroll">
                <table class="grid">
                  <thead>
                    <tr>
                      <th>{{ store.t('budget.col.category') }}</th>
                      <th class="num">{{ store.t('budget.col.planned') }}</th>
                      <th class="num">{{ store.t('budget.col.actual') }}</th>
                      <th class="num">{{ store.t('budget.col.diff') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of c.rows; track r.id) {
                      <tr>
                        <td>{{ rowName(r) }}</td>
                        <td class="num">{{ fmt(r.planned) }}</td>
                        <td class="num">{{ fmt(r.actual) }}</td>
                        <td class="num">
                          <span [class.in]="r.diff > 0" [class.out]="r.diff < 0">{{ fmt(r.diff) }}</span>
                          <span class="verdict">{{ verdict(r.diff) }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{{ store.t('budget.total') }}</td>
                      <td class="num">{{ fmt(c.planned) }}</td>
                      <td class="num">{{ fmt(c.actual) }}</td>
                      <td class="num" [class.in]="c.diff > 0" [class.out]="c.diff < 0">{{ fmt(c.diff) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          }
        </section>
      } @else if (store.budgetError(); as e) {
        <p class="load-error">{{ e }}</p>
      }
    </div>
  `,
  styles: [`
    .view { height: 100%; overflow-y: auto; padding-bottom: 32px; }
    .back {
      display: inline-flex; align-items: center; gap: 6px; margin: 16px 24px 0;
      font-family: var(--font-mono); font-size: 12px; color: var(--muted-strong); text-decoration: none;
    }
    .back:hover { color: var(--color-accent); }
    .head { padding: 12px 24px 16px; }
    .title-row { display: flex; align-items: center; gap: 8px; }
    .title-row .view-title { flex: none; }
    .mono { font-family: var(--font-mono); }
    .stats { display: flex; flex-wrap: wrap; gap: 12px; padding: 0 24px 20px; }
    .stat {
      flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 6px;
      padding: 14px 16px; background: var(--color-surface); border: 1px solid var(--color-divider);
    }
    .fig { font-family: var(--font-mono); font-size: 18px; }
    .block { padding: 20px 24px; }
    .block-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .add { display: inline-flex; align-items: center; gap: 6px; }
    .hint { margin: 0 0 14px; font-size: 12px; color: var(--muted-strong); line-height: 1.5; max-width: 70ch; }
    /* Tables get their own scroller so the page itself never scrolls sideways. */
    .table-wrap { overflow-x: auto; }
    .grid { width: 100%; border-collapse: collapse; font-size: 13px; }
    .grid th {
      text-align: left; font-family: var(--font-heading); font-size: 11px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted-strong);
      padding: 8px 10px; border-bottom: 2px solid var(--color-divider); white-space: nowrap;
    }
    .grid td { padding: 10px; border-bottom: 1px solid var(--color-divider); vertical-align: top; }
    .grid tfoot td { border-bottom: 0; border-top: 2px solid var(--color-divider); font-weight: 700; }
    .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
    /* .grid th sets text-align:left and outranks .num on its own. */
    .grid th.num { text-align: right; }
    /* The global .btn-icon is display:grid, so the two buttons need a row to sit in. */
    .acts { width: 1%; white-space: nowrap; }
    .acts-row { display: flex; justify-content: flex-end; }
    .item-title { display: block; }
    .note { display: block; margin-top: 3px; font-size: 12px; color: var(--muted); }
    .cat { color: var(--muted-strong); }
    .pricing { display: block; margin-top: 3px; font-size: 11px; color: var(--muted); }
    .verdict { display: block; margin-top: 3px; font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .in { color: var(--color-income); }
    .out { color: var(--color-danger); }
    .empty { max-width: 520px; }
    .empty h2 { font-size: 16px; margin: 0 0 8px; }
    .empty p { color: var(--muted-strong); line-height: 1.5; margin: 0; }
    .empty-line, .load-error { color: var(--muted-strong); font-size: 13px; }
    .load-error { padding: 24px; color: var(--color-danger); }

    @media (max-width: 760px) {
      .back { margin: 12px 16px 0; }
      .head { padding: 12px 16px; }
      .stats { padding: 0 16px 16px; }
      .block { padding: 16px; }
      .block-head { flex-wrap: wrap; }
    }
  `],
})
export class BudgetDetailComponent implements OnInit, OnDestroy {
  store = inject(TaskStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.store.openBudget(id);
  }
  ngOnDestroy(): void { this.store.closeBudget(); }

  fmt(n: number): string { return fmtMoney(n); }

  /** An item's category: its subs when it has any, else its main, else nothing. */
  catLabel(i: BudgetItem): string {
    if (i.catIds.length) {
      return i.catIds.map((id) => this.store.subName(id)).join(', ');
    }
    return i.mainId ? this.store.mainName(i.mainId) : this.store.t('budget.noCategory');
  }

  rowName(r: BudgetCompareRow): string {
    return r.id === UNCATEGORIZED ? this.store.t('budget.uncategorized') : r.name;
  }

  /** Plain-language read on the difference; the sign alone is easy to misread. */
  verdict(diff: number): string {
    if (diff === 0) return this.store.t('budget.onPlan');
    return this.store.t(diff < 0 ? 'budget.over' : 'budget.under');
  }

  remove(id: string): void {
    this.store.askRemoveBudget(id, () => void this.router.navigate(['/budgets']));
  }
}
