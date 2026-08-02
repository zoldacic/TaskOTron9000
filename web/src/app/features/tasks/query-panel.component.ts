import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { QueryAmountKind, QueryDateKind } from '../../models';
import { NO_ACCOUNT } from '../../core/task-query';
import { TranslationKey } from '../../core/i18n/en';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-query-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="panel rule-2 om-scroll">
      <!-- categories -->
      <div class="field">
        <span class="kicker">{{ store.t('query.categories') }} <span class="hint">{{ store.t('query.matchAny') }}</span></span>
        @for (m of store.mains(); track m.id) {
          <div class="cat-main">{{ m.name }}</div>
          <div class="chips">
            @for (s of store.subsOf(m.id); track s.id) {
              <button class="chip" [class.on]="q().catIds.includes(s.id)"
                      (click)="store.toggleQueryCat(s.id)">{{ s.name }}</button>
            }
          </div>
        }
      </div>

      <div class="grid">
        <!-- due date range -->
        <label class="field">
          <span class="kicker">{{ store.t('query.dueFrom') }}</span>
          <input class="input date" type="date" [value]="q().dueFrom ?? ''"
                 (input)="store.patchQuery({ dueFrom: value($event) || null })">
        </label>
        <label class="field">
          <span class="kicker">{{ store.t('query.dueTo') }}</span>
          <input class="input date" type="date" [value]="q().dueTo ?? ''"
                 (input)="store.patchQuery({ dueTo: value($event) || null })">
        </label>

        <!-- task type -->
        <div class="field">
          <span class="kicker">{{ store.t('query.taskType') }}</span>
          <div class="seg">
            @for (o of dateKinds; track o.key) {
              <button class="seg-opt" [class.active]="q().dateKind === o.key"
                      (click)="store.patchQuery({ dateKind: o.key })">{{ store.t(o.labelKey) }}</button>
            }
          </div>
        </div>

        <!-- bank account -->
        @if (store.bankAccounts().length) {
          <label class="field">
            <span class="kicker">{{ store.t('query.bankAccount') }}</span>
            <select class="input acct" [value]="q().bankAccountId ?? ''"
                    (change)="store.patchQuery({ bankAccountId: selectVal($event) })">
              <option value="">{{ store.t('query.any') }}</option>
              <option [value]="NO_ACCOUNT">{{ store.t('query.noAccount') }}</option>
              @for (a of store.bankAccounts(); track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            </select>
          </label>
        }
      </div>

      <!-- amount -->
      <div class="field">
        <span class="kicker">{{ store.t('query.amount') }}</span>
        <div class="seg">
          @for (o of amountKinds; track o.key) {
            <button class="seg-opt" [class.active]="q().amountKind === o.key"
                    (click)="store.patchQuery({ amountKind: o.key })">{{ store.t(o.labelKey) }}</button>
          }
        </div>
        <div class="range">
          <input class="input num" inputmode="decimal" [placeholder]="store.t('query.minPlaceholder')" [value]="q().amountMin ?? ''"
                 (input)="store.patchQuery({ amountMin: num($event) })">
          <span class="dash">–</span>
          <input class="input num" inputmode="decimal" [placeholder]="store.t('query.maxPlaceholder')" [value]="q().amountMax ?? ''"
                 (input)="store.patchQuery({ amountMax: num($event) })">
          <span class="hint">{{ store.t('query.absoluteValue') }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-ghost" (click)="store.clearQuery()"
                [disabled]="!store.queryActive()">
          <app-icon name="x" [size]="14" /> {{ store.t('query.clear') }}
        </button>
        <span class="spacer"></span>
        <button class="btn btn-secondary" (click)="store.openSaveQuery()"
                [disabled]="!store.queryActive()">{{ store.t('query.saveQuery') }}</button>
      </div>
    </div>
  `,
  styles: [`
    /* The panel sits above the task list in a flex column; left unbounded it grows past the
       viewport and starves the list of height. Cap it and scroll it on its own instead. */
    :host { flex: none; min-height: 0; }
    .panel {
      padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 16px;
      max-height: 45vh; overflow-y: auto;
    }
    .field { display: flex; flex-direction: column; }
    .hint { text-transform: none; letter-spacing: 0; color: var(--muted-strong); }
    .cat-main { font-weight: 700; font-size: 12px; margin: 8px 0 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px 20px; }
    .date { font-family: var(--font-mono); }
    .acct { max-width: 100%; }
    .range { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .num { max-width: 110px; font-family: var(--font-mono); }
    .dash { color: var(--muted); }
    .actions { display: flex; align-items: center; gap: 10px; }
    .spacer { flex: 1; }

    /* On a small screen the task list hides while the panel is open (see tasks-view), so the
       panel claims the freed height instead of staying capped at 45vh. */
    @media (max-width: 860px) {
      :host { flex: 1; }
      .panel { max-height: none; height: 100%; padding: 12px 16px 16px; }
    }
  `],
})
export class QueryPanelComponent {
  store = inject(TaskStore);
  readonly NO_ACCOUNT = NO_ACCOUNT;

  readonly dateKinds: { key: QueryDateKind; labelKey: TranslationKey }[] = [
    { key: 'any', labelKey: 'query.type.any' },
    { key: 'due', labelKey: 'query.type.due' },
    { key: 'transaction', labelKey: 'query.type.transaction' },
  ];
  readonly amountKinds: { key: QueryAmountKind; labelKey: TranslationKey }[] = [
    { key: 'any', labelKey: 'query.amt.any' },
    { key: 'income', labelKey: 'query.amt.income' },
    { key: 'spend', labelKey: 'query.amt.spend' },
    { key: 'has', labelKey: 'query.amt.has' },
    { key: 'none', labelKey: 'query.amt.none' },
  ];

  q() { return this.store.queryDraft(); }

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  selectVal(e: Event): string | null { return (e.target as HTMLSelectElement).value || null; }
  num(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v === '') return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
}
