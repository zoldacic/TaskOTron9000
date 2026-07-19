import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { QueryAmountKind, QueryDateKind } from '../../models';
import { NO_ACCOUNT } from '../../core/task-query';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-query-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="panel rule-2">
      <!-- categories -->
      <div class="field">
        <span class="kicker">Categories <span class="hint">· match any</span></span>
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
          <span class="kicker">Due from</span>
          <input class="input date" type="date" [value]="q().dueFrom ?? ''"
                 (input)="store.patchQuery({ dueFrom: value($event) || null })">
        </label>
        <label class="field">
          <span class="kicker">Due to</span>
          <input class="input date" type="date" [value]="q().dueTo ?? ''"
                 (input)="store.patchQuery({ dueTo: value($event) || null })">
        </label>

        <!-- task type -->
        <div class="field">
          <span class="kicker">Task type</span>
          <div class="seg">
            @for (o of dateKinds; track o.key) {
              <button class="seg-opt" [class.active]="q().dateKind === o.key"
                      (click)="store.patchQuery({ dateKind: o.key })">{{ o.label }}</button>
            }
          </div>
        </div>

        <!-- bank account -->
        @if (store.bankAccounts().length) {
          <label class="field">
            <span class="kicker">Bank account</span>
            <select class="input acct" [value]="q().bankAccountId ?? ''"
                    (change)="store.patchQuery({ bankAccountId: selectVal($event) })">
              <option value="">Any</option>
              <option [value]="NO_ACCOUNT">— No account —</option>
              @for (a of store.bankAccounts(); track a.id) {
                <option [value]="a.id">{{ a.name }}</option>
              }
            </select>
          </label>
        }
      </div>

      <!-- amount -->
      <div class="field">
        <span class="kicker">Amount</span>
        <div class="seg">
          @for (o of amountKinds; track o.key) {
            <button class="seg-opt" [class.active]="q().amountKind === o.key"
                    (click)="store.patchQuery({ amountKind: o.key })">{{ o.label }}</button>
          }
        </div>
        <div class="range">
          <input class="input num" inputmode="decimal" placeholder="min" [value]="q().amountMin ?? ''"
                 (input)="store.patchQuery({ amountMin: num($event) })">
          <span class="dash">–</span>
          <input class="input num" inputmode="decimal" placeholder="max" [value]="q().amountMax ?? ''"
                 (input)="store.patchQuery({ amountMax: num($event) })">
          <span class="hint">absolute value</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-ghost" (click)="store.clearQuery()"
                [disabled]="!store.queryActive()">
          <app-icon name="x" [size]="14" /> Clear
        </button>
        <span class="spacer"></span>
        <button class="btn btn-secondary" (click)="store.openSaveQuery()"
                [disabled]="!store.queryActive()">Save query…</button>
      </div>
    </div>
  `,
  styles: [`
    .panel { padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 16px; }
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
  `],
})
export class QueryPanelComponent {
  store = inject(TaskStore);
  readonly NO_ACCOUNT = NO_ACCOUNT;

  readonly dateKinds: { key: QueryDateKind; label: string }[] = [
    { key: 'any', label: 'Any' },
    { key: 'due', label: 'Tasks' },
    { key: 'transaction', label: 'Transactions' },
  ];
  readonly amountKinds: { key: QueryAmountKind; label: string }[] = [
    { key: 'any', label: 'Any' },
    { key: 'income', label: 'Income' },
    { key: 'spend', label: 'Spend' },
    { key: 'has', label: 'Has amount' },
    { key: 'none', label: 'No amount' },
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
