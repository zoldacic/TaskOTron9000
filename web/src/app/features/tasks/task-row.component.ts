import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { Todo } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { dueLabel, dueTone } from '../../core/date-util';
import { fmtMoney } from '../../core/money-util';

@Component({
  selector: 'app-task-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="row rule-1" [class.selected]="store.selecting() && store.isSelected(todo.id)">
      @if (store.selecting()) {
        <button class="check select" [class.on]="store.isSelected(todo.id)"
                (click)="store.toggleSelected(todo.id)" [attr.aria-label]="store.t('row.selectTask')">
          @if (store.isSelected(todo.id)) { <app-icon name="check" [size]="14" /> }
        </button>
      } @else {
        <button class="check" [class.done]="todo.done" (click)="store.toggle(todo.id)" [attr.aria-label]="store.t('row.toggleDone')">
          @if (todo.done) { <app-icon name="check" [size]="14" /> }
        </button>
      }

      <button class="main" (click)="store.selecting() ? store.toggleSelected(todo.id) : store.openEdit(todo.id)">
        <div class="title" [class.done]="todo.done">{{ todo.title }}</div>
        <div class="meta">
          @if (badge()) { <span class="due" [style.color]="dueColor()">{{ badge() }}</span> }
          @if (store.accountName(todo.bankAccountId); as acct) {
            <span class="tag tag-account"><app-icon name="upload" [size]="11" /> {{ acct }}</span>
          }
          @if (store.mainName(todo.mainId); as main) {
            <span class="tag tag-main">{{ main }}</span>
          }
          @for (id of todo.catIds; track id) {
            @if (store.subName(id); as n) { <span class="tag tag-neutral">{{ n }}</span> }
          }
        </div>
        @if (todo.note) { <div class="note">{{ todo.note }}</div> }
      </button>

      @if (todo.amount != null) {
        <span class="amount" [style.color]="todo.amount >= 0 ? 'var(--color-income)' : 'var(--color-danger)'">
          {{ fmt(todo.amount) }}
        </span>
      }
      @if (!store.selecting()) {
        <button class="btn-icon" (click)="store.openEdit(todo.id)" [attr.aria-label]="store.t('row.edit')"><app-icon name="pencil" /></button>
        <button class="btn-icon danger" (click)="store.askRemove(todo.id)" [attr.aria-label]="store.t('row.delete')"><app-icon name="trash" /></button>
      }
    </div>
  `,
  styles: [`
    .row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 8px; }
    .row:hover { background: var(--tint-hover); }
    .check {
      flex: none; width: 22px; height: 22px; margin-top: 1px; padding: 0; display: grid; place-items: center;
      cursor: pointer; border: 2px solid var(--color-divider); background: transparent; color: #fff;
    }
    .check.done { border-color: var(--color-accent); background: var(--color-accent); box-shadow: 0 0 10px -2px var(--color-accent); }
    .check.select { border-radius: 5px; }
    .check.select.on { border-color: var(--color-accent); background: var(--color-accent); box-shadow: 0 0 10px -2px var(--color-accent); }
    .row.selected { background: var(--accent-fill); }
    .main { flex: 1; min-width: 0; text-align: left; background: transparent; border: 0; cursor: pointer; padding: 0; color: inherit; }
    .title { font-size: 15px; line-height: 1.3; }
    .title.done { text-decoration: line-through; color: color-mix(in srgb, var(--color-text) 42%, transparent); }
    .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .note { margin-top: 6px; font-size: 13px; line-height: 1.4; color: var(--muted); white-space: pre-wrap; }
    .due {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .amount { flex: none; font-family: var(--font-mono); font-size: 14px; font-weight: 700; white-space: nowrap; align-self: center; }
  `],
})
export class TaskRowComponent {
  @Input({ required: true }) todo!: Todo;
  store = inject(TaskStore);

  fmt = fmtMoney;

  private isTxn(): boolean { return this.todo.dateKind === 'transaction'; }

  badge(): string {
    const t = this.todo;
    if (!t.due) return '';
    const label = dueLabel(t.due, this.store.lang());
    if (this.isTxn()) return this.store.t('row.txnPrefix') + ' ' + label;
    return dueTone(t.due, t.done) === 'over' ? label + ' · ' + this.store.t('row.overdueSuffix') : label;
  }

  dueColor(): string {
    const t = this.todo;
    if (!t.due || this.isTxn()) return 'var(--muted)';
    const tone = dueTone(t.due, t.done);
    return tone === 'over' ? 'var(--color-danger)' : tone === 'today' ? 'var(--color-amber)' : 'var(--muted)';
  }
}
