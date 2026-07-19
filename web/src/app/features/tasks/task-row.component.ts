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
    <div class="row rule-1">
      <button class="check" [class.done]="todo.done" (click)="store.toggle(todo.id)" aria-label="Toggle done">
        @if (todo.done) { <app-icon name="check" [size]="14" /> }
      </button>

      <button class="main" (click)="store.openEdit(todo.id)">
        <div class="title" [class.done]="todo.done">{{ todo.title }}</div>
        <div class="meta">
          @if (badge()) { <span class="due" [style.color]="dueColor()">{{ badge() }}</span> }
          @for (id of todo.catIds; track id) {
            @if (store.subName(id); as n) { <span class="tag tag-neutral">{{ n }}</span> }
          }
        </div>
      </button>

      @if (todo.amount != null) {
        <span class="amount" [style.color]="todo.amount >= 0 ? 'var(--color-income)' : 'var(--color-accent)'">
          {{ fmt(todo.amount) }}
        </span>
      }
      <button class="btn-icon" (click)="store.openEdit(todo.id)" aria-label="Edit"><app-icon name="pencil" /></button>
      <button class="btn-icon danger" (click)="store.askRemove(todo.id)" aria-label="Delete"><app-icon name="trash" /></button>
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
    .main { flex: 1; min-width: 0; text-align: left; background: transparent; border: 0; cursor: pointer; padding: 0; color: inherit; }
    .title { font-size: 15px; line-height: 1.3; }
    .title.done { text-decoration: line-through; color: color-mix(in srgb, var(--color-text) 42%, transparent); }
    .meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
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
    if (this.isTxn()) return 'Txn ' + dueLabel(t.due);
    return dueTone(t.due, t.done) === 'over' ? dueLabel(t.due) + ' · overdue' : dueLabel(t.due);
  }

  dueColor(): string {
    const t = this.todo;
    if (!t.due || this.isTxn()) return 'var(--muted)';
    const tone = dueTone(t.due, t.done);
    return tone === 'over' ? 'var(--color-accent)' : tone === 'today' ? 'var(--color-amber)' : 'var(--muted)';
  }
}
