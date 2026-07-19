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
          <h2 class="dialog-title">{{ d.id == null ? 'New task' : 'Edit task' }}</h2>

          <label class="field">
            <span class="kicker">Task</span>
            <input class="input" [value]="d.title" placeholder="What must be conquered?"
                   (input)="patch({ title: value($event) })" autofocus>
          </label>

          <div class="field mt">
            <span class="kicker">Date kind</span>
            <div class="seg">
              <button class="seg-opt" [class.active]="d.dateKind === 'due'"
                      (click)="patch({ dateKind: 'due' })">
                <app-icon name="clock" [size]="14" /> Do it by
              </button>
              <button class="seg-opt" [class.active]="d.dateKind === 'transaction'"
                      (click)="patch({ dateKind: 'transaction' })">
                <app-icon name="receipt" [size]="14" /> Transaction
              </button>
            </div>
          </div>

          <div class="field mt">
            <span class="kicker">{{ d.dateKind === 'transaction' ? 'Transaction date' : 'Do-it date' }}</span>
            <div class="presets">
              @for (p of presets(); track p.label) {
                <button class="btn preset" [class.on]="d.due === p.iso" (click)="patch({ due: p.iso })">{{ p.label }}</button>
              }
              <button class="btn preset ghost" (click)="patch({ due: null })">Clear</button>
            </div>
            <div class="date-row">
              <input class="input date" type="date" [value]="d.due ?? ''"
                     (input)="patch({ due: value($event) || null })">
              <span class="human">{{ humanDate() }}</span>
            </div>
          </div>

          <label class="field mt">
            <span class="kicker">Amount <span class="hint">· optional · negative = money out</span></span>
            <input class="input" inputmode="decimal" [value]="d.amountStr" placeholder="e.g. -84.50"
                   (input)="patch({ amountStr: value($event) })">
          </label>

          @if (store.bankAccounts().length) {
            <label class="field mt">
              <span class="kicker">Bank account <span class="hint">· optional</span></span>
              <select class="input acct" [value]="d.bankAccountId ?? ''"
                      (change)="patch({ bankAccountId: selectAccount($event) })">
                <option value="">— None —</option>
                @for (a of store.bankAccounts(); track a.id) {
                  <option [value]="a.id">{{ a.name }}</option>
                }
              </select>
            </label>
          }

          <div class="field mt">
            <span class="kicker">Categories</span>
            @for (m of store.mains(); track m.id) {
              <div class="cat-main">{{ m.name }}</div>
              <div class="chips">
                @for (s of store.subsOf(m.id); track s.id) {
                  <button class="chip" [class.on]="d.catIds.includes(s.id)" (click)="store.toggleDraftCat(s.id)">{{ s.name }}</button>
                }
              </div>
            }
          </div>

          <div class="dialog-actions">
            @if (d.id != null) {
              <button class="btn btn-ghost del" (click)="store.askDeleteFromDialog()">Delete task</button>
            }
            <span class="spacer"></span>
            <button class="btn btn-secondary" (click)="close()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!d.title.trim()" (click)="store.saveTask()">Save task</button>
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
      { label: 'Today', iso: toISO(now) },
      { label: 'Tomorrow', iso: toISO(addDays(now, 1)) },
      { label: 'Next week', iso: toISO(addDays(now, 7)) },
    ];
  });

  humanDate(): string {
    const due = this.store.taskDialog()?.due;
    return due ? dueLabel(due) : 'No date — living dangerously';
  }

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  selectAccount(e: Event): string | null { return (e.target as HTMLSelectElement).value || null; }
  patch(p: Parameters<TaskStore['updateDialog']>[0]): void { this.store.updateDialog(p); }
  close(): void { this.store.taskDialog.set(null); }
}
