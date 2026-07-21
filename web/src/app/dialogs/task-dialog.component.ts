import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { IconComponent } from '../shared/icon.component';
import { toISO, addDays, startOfToday, dueLabel } from '../core/date-util';

@Component({
  selector: 'app-task-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (store.taskDialog(); as d) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ d.id == null ? store.t('dialog.task.new') : store.t('dialog.task.edit') }}</h2>

          <label class="field">
            <span class="kicker">{{ store.t('dialog.task.taskLabel') }}</span>
            <input class="input" [value]="d.title" [placeholder]="store.t('dialog.task.titlePlaceholder')"
                   (input)="patch({ title: value($event) })" autofocus>
          </label>

          <div class="field mt switch-row">
            <span class="kicker">
              <app-icon name="receipt" [size]="14" /> {{ store.t('dialog.task.transaction') }}
            </span>
            <button class="switch" [class.on]="d.dateKind === 'transaction'"
                    role="switch" [attr.aria-checked]="d.dateKind === 'transaction'"
                    (click)="patch({ dateKind: d.dateKind === 'transaction' ? 'due' : 'transaction' })">
              <span class="knob"></span>
            </button>
          </div>

          <div class="field mt">
            <span class="kicker">{{ d.dateKind === 'transaction' ? store.t('dialog.task.transactionDate') : store.t('dialog.task.doItDate') }}</span>
            @if (d.dateKind !== 'transaction') {
              <div class="presets">
                @for (p of presets(); track p.labelKey) {
                  <button class="btn preset" [class.on]="d.due === p.iso" (click)="patch({ due: p.iso })">{{ store.t(p.labelKey) }}</button>
                }
                <button class="btn preset ghost" (click)="patch({ due: null })">{{ store.t('dialog.task.clear') }}</button>
              </div>
            }
            <div class="date-row">
              <input class="input date" type="date" [value]="d.due ?? ''"
                     (input)="patch({ due: value($event) || null })">
              <span class="human">{{ humanDate() }}</span>
            </div>
          </div>

          @if (d.dateKind === 'transaction') {
            <label class="field mt">
              <span class="kicker">{{ store.t('dialog.task.amount') }} <span class="hint">{{ store.t('dialog.task.amountHint') }}</span></span>
              <input class="input" inputmode="decimal" [value]="d.amountStr" [placeholder]="store.t('dialog.task.amountPlaceholder')"
                     (input)="patch({ amountStr: value($event) })">
            </label>

            @if (store.bankAccounts().length) {
              <label class="field mt">
                <span class="kicker">{{ store.t('dialog.task.bankAccount') }} <span class="hint">{{ store.t('dialog.task.optional') }}</span></span>
                <select class="input acct" [value]="d.bankAccountId ?? ''"
                        (change)="patch({ bankAccountId: selectAccount($event) })">
                  <option value="">{{ store.t('dialog.task.none') }}</option>
                  @for (a of store.bankAccounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </label>
            }
          }

          <div class="field mt">
            <span class="kicker">{{ store.t('dialog.task.categories') }}</span>
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
                    <button class="chip" [class.on]="d.catIds.includes(s.id)" (click)="store.toggleDraftCat(s.id)">{{ s.name }}</button>
                  }
                </div>
              }
            }
          </div>

          <div class="dialog-actions">
            @if (d.id != null) {
              <button class="btn btn-ghost del" (click)="store.askDeleteFromDialog()">{{ store.t('dialog.task.deleteTask') }}</button>
            }
            <span class="spacer"></span>
            <button class="btn btn-secondary" (click)="close()">{{ store.t('dialog.task.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!d.title.trim()" (click)="store.saveTask()">{{ store.t('dialog.task.save') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .mt { margin-top: var(--space-4); }
    .hint { text-transform: none; letter-spacing: 0; color: var(--muted-strong); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .preset { padding: 6px 12px; font-size: 12px; }
    .preset.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
    .preset.ghost { color: var(--muted); }
    .date-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
    .date { max-width: 200px; font-family: var(--font-mono); }
    .acct { max-width: 240px; }
    .human { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .cat-main { font-weight: 700; font-size: 12px; margin: 10px 0 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip.main.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
    .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .switch { width: 40px; height: 22px; padding: 0; border-radius: 999px; border: 1px solid var(--color-divider); background: var(--color-surface); cursor: pointer; transition: background .15s, border-color .15s; }
    .switch .knob { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--muted); margin-left: 2px; transition: transform .15s, background .15s; }
    .switch.on { background: color-mix(in srgb, var(--color-accent) 22%, transparent); border-color: var(--color-accent); }
    .switch.on .knob { transform: translateX(18px); background: var(--color-accent); }
    .spacer { flex: 1; }
    .del { color: var(--muted); }
    .del:hover { color: var(--color-accent); }
  `],
})
export class TaskDialogComponent {
  store = inject(TaskStore);

  presets = computed(() => {
    const now = startOfToday();
    return [
      { labelKey: 'date.preset.today' as const, iso: toISO(now) },
      { labelKey: 'date.preset.tomorrow' as const, iso: toISO(addDays(now, 1)) },
      { labelKey: 'date.preset.nextWeek' as const, iso: toISO(addDays(now, 7)) },
    ];
  });

  humanDate(): string {
    const due = this.store.taskDialog()?.due;
    return due ? dueLabel(due, this.store.lang()) : this.store.t('dialog.task.noDate');
  }

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  selectAccount(e: Event): string | null { return (e.target as HTMLSelectElement).value || null; }
  patch(p: Parameters<TaskStore['updateDialog']>[0]): void { this.store.updateDialog(p); }
  close(): void { this.store.taskDialog.set(null); }
}
