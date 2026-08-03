import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { Todo } from '../models';
import { UNCATEGORIZED } from '../core/report-drill';
import { fmtMoney } from '../core/money-util';
import { IconComponent } from '../shared/icon.component';

/**
 * The transactions behind one bar of the report's "net by category" chart. Read-only: the
 * report is for explaining a number, not for editing the tasks that make it up.
 */
@Component({
  selector: 'app-report-drill-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (store.repDrill(); as d) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog wide" (click)="$event.stopPropagation()" (keydown.escape)="close()">
          <h2 class="dialog-title">{{ name() }}</h2>
          <p class="dialog-sub">
            {{ store.t('dialog.reportDrill.range', { from: store.repStart(), to: store.repEnd() }) }}
            · {{ rows().length === 1 ? store.t('dialog.reportDrill.countOne') : store.t('dialog.reportDrill.count', { count: rows().length }) }}
          </p>

          @if (rows().length === 0) {
            <p class="empty">{{ store.t('dialog.reportDrill.empty') }}</p>
          } @else {
            <ul class="rows">
              @for (t of rows(); track t.id) {
                <li class="row rule-1">
                  <span class="date">{{ t.due ?? store.t('dialog.reportDrill.noDate') }}</span>
                  <span class="body">
                    <span class="title" [class.done]="t.done">{{ t.title }}</span>
                    @for (n of subNames(t); track n) {
                      <span class="tag tag-neutral">{{ n }}</span>
                    } @empty {
                      <span class="tag tag-none">{{ store.t('dialog.reportDrill.noSub') }}</span>
                    }
                    @if (store.accountName(t.bankAccountId); as acct) {
                      <span class="tag tag-account"><app-icon name="upload" [size]="11" /> {{ acct }}</span>
                    }
                    @if (t.note) { <span class="note">{{ t.note }}</span> }
                  </span>
                  <span class="amount" [class.in]="t.amount! >= 0" [class.out]="t.amount! < 0">{{ fmt(t.amount!) }}</span>
                </li>
              }
            </ul>

            <div class="total">
              <span class="t-label">{{ store.t('dialog.reportDrill.total') }}</span>
              <span class="amount" [class.in]="total() >= 0" [class.out]="total() < 0">{{ fmt(total()) }}</span>
            </div>
          }

          <div class="dialog-actions">
            <button class="btn btn-primary" (click)="close()" autofocus>{{ store.t('common.close') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .wide { width: 560px; max-height: 90vh; overflow-y: auto; }
    .empty { margin: 4px 0; color: var(--muted-strong); line-height: 1.45; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; }
    .date { flex: none; width: 88px; font-family: var(--font-mono); font-size: 12px; color: var(--muted); padding-top: 2px; }
    .body { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .title { font-size: 14px; line-height: 1.3; }
    .title.done { text-decoration: line-through; color: color-mix(in srgb, var(--color-text) 42%, transparent); }
    /* Full basis so the note wraps onto its own line below the title and tags. */
    .note { flex-basis: 100%; font-size: 13px; line-height: 1.4; color: var(--muted); white-space: pre-wrap; }
    /* A row with no sub category still says so, so a gap reads as data and not as a rendering bug. */
    .tag-none { background: none; border: 1px dashed var(--color-divider); color: var(--muted); }
    .amount { flex: none; font-family: var(--font-mono); font-size: 14px; font-weight: 700; white-space: nowrap; }
    .in { color: var(--color-income); }
    .out { color: var(--color-danger); }
    .total { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0 0; }
    .t-label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    @media (max-width: 560px) {
      .date { width: 72px; }
    }
  `],
})
export class ReportDrillDialogComponent {
  store = inject(TaskStore);

  fmt = fmtMoney;

  readonly rows = this.store.repDrillRows;

  /** The server sends the uncategorized row with an English name; show the translated one. */
  readonly name = computed(() => {
    const d = this.store.repDrill();
    if (!d) return '';
    return d.id === UNCATEGORIZED ? this.store.t('report.uncategorized') : d.name;
  });

  readonly total = computed(() => this.rows().reduce((s, t) => s + (t.amount ?? 0), 0));

  /** Sub category names for a row, dropping ids the store no longer knows (deleted subs). */
  subNames(t: Todo): string[] {
    return t.catIds.map((id) => this.store.subName(id)).filter((n) => !!n);
  }

  close(): void { this.store.repDrill.set(null); }
}
