import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { Todo } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { TaskRowComponent } from './task-row.component';

@Component({
  selector: 'app-tasks-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TaskRowComponent],
  template: `
    <div class="view">
      <header class="head">
        <div class="titles">
          <h1 class="view-title">{{ titleInfo().title }}</h1>
          <div class="view-sub">{{ titleInfo().subtitle }}</div>
        </div>
        <div class="actions">
          <div class="seg">
            <button class="seg-opt" [class.active]="store.layout() === 'list'" (click)="store.layout.set('list')">
              <app-icon name="list" [size]="14" /> List
            </button>
            <button class="seg-opt" [class.active]="store.layout() === 'grouped'" (click)="store.layout.set('grouped')">
              <app-icon name="grid" [size]="14" /> Grouped
            </button>
          </div>
          <button class="btn btn-primary" (click)="store.openNew()"><app-icon name="plus" [size]="16" /> New task</button>
        </div>
      </header>

      <div class="quick">
        <input class="input" placeholder="Log a task before it logs you…" [value]="store.quickAdd()"
               (input)="store.quickAdd.set(value($event))" (keydown.enter)="store.addQuick()">
        <button class="btn btn-secondary" [disabled]="!store.quickAdd().trim()" (click)="store.addQuick()">Add</button>
      </div>

      <div class="scroll om-scroll">
        @if (store.visibleTodos().length === 0) {
          <div class="empty">
            <app-icon name="tasks" [size]="40" />
            <h2>{{ emptyInfo().title }}</h2>
            <p>{{ emptyInfo().body }}</p>
          </div>
        } @else if (store.layout() === 'list') {
          @for (t of store.visibleTodos(); track t.id) {
            <app-task-row [todo]="t" />
          }
        } @else {
          @for (g of groups(); track g.title) {
            <div class="group-head rule-2">
              <span>{{ g.title }}</span><span class="count">{{ g.items.length }}</span>
            </div>
            @for (t of g.items; track t.id) {
              <app-task-row [todo]="t" />
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .view { display: flex; flex-direction: column; height: 100%; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 24px 16px; }
    .actions { display: flex; align-items: center; gap: 12px; }
    .quick { display: flex; gap: 10px; padding: 0 24px 16px; }
    .scroll {
      flex: 1; min-height: 0; overflow-y: auto; padding: 0 24px 24px;
      background-image:
        linear-gradient(color-mix(in srgb, #93a4cc 5%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, #93a4cc 5%, transparent) 1px, transparent 1px);
      background-size: 26px 26px;
    }
    .group-head {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 18px 8px 8px; margin-top: 6px;
      font-family: var(--font-heading); font-weight: 800; font-size: 14px;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .group-head .count { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .empty { text-align: center; padding: 80px 24px; color: var(--muted); }
    .empty h2 { font-family: var(--font-heading); font-weight: 800; text-transform: uppercase; color: var(--color-text); margin: 16px 0 8px; }
    .empty p { font-family: var(--font-mono); font-size: 13px; }
  `],
})
export class TasksViewComponent {
  store = inject(TaskStore);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }

  titleInfo = computed(() => {
    const f = this.store.filter();
    if (f === 'all') return { title: 'All tasks', subtitle: 'Everything on your plate (and then some)' };
    if (f === 'today') return { title: 'Today', subtitle: 'Due today + everything you’re avoiding' };
    if (f === 'upcoming') return { title: 'Upcoming', subtitle: 'A.k.a. future-you’s problem' };
    if (f === 'done') return { title: 'Completed', subtitle: 'Trophies for the shelf' };
    const s = this.store.subs().find((x) => x.id === f);
    const m = s && this.store.mains().find((x) => x.id === s.mainId);
    return { title: s?.name ?? 'Category', subtitle: m ? `${m.name} · sector` : 'Category' };
  });

  emptyInfo = computed(() => {
    const f = this.store.filter();
    if (f === 'today') return { title: 'All clear for today', body: 'Zero tasks due. Go outside. Touch grass. We’ll wait.' };
    if (f === 'done') return { title: 'Nothing completed. Yet.', body: 'Bold strategy. We’re rooting for you.' };
    if (f === 'upcoming') return { title: 'The future is empty', body: 'No upcoming tasks. Ominous, but relaxing.' };
    return { title: 'Inbox zero, you absolute legend', body: 'Nothing queued. The machines are idle and slightly bored.' };
  });

  groups = computed(() => {
    const visible = this.store.visibleTodos();
    const out: { title: string; items: Todo[] }[] = [];
    for (const m of this.store.mains()) {
      const subIds = this.store.subsOf(m.id).map((s) => s.id);
      const items = visible.filter((t) => t.catIds.some((c) => subIds.includes(c)));
      if (items.length) out.push({ title: m.name, items });
    }
    const uncat = visible.filter((t) => t.catIds.length === 0);
    if (uncat.length) out.push({ title: 'No category', items: uncat });
    return out;
  });
}
