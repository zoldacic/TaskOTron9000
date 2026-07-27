import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { Todo } from '../../models';
import { fmtMoney } from '../../core/money-util';
import { amountTotals } from '../../core/todo-util';
import { IconComponent } from '../../shared/icon.component';
import { TaskRowComponent } from './task-row.component';
import { QueryPanelComponent } from './query-panel.component';

@Component({
  selector: 'app-tasks-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TaskRowComponent, QueryPanelComponent],
  template: `
    <div class="view">
      <header class="head">
        <div class="titles">
          <h1 class="view-title">{{ titleInfo().title }}</h1>
          <div class="view-sub">{{ titleInfo().subtitle }}</div>
          @if (queryTotals(); as m) {
            <div class="totals">
              @if (m.income > 0) {
                <span class="tot"><span class="tot-k">{{ store.t('tasks.queryTotal.in') }}</span>
                  <b class="in">{{ fmt(m.income) }}</b></span>
              }
              @if (m.spend < 0) {
                <span class="tot"><span class="tot-k">{{ store.t('tasks.queryTotal.out') }}</span>
                  <b class="out">{{ fmt(m.spend) }}</b></span>
              }
              <span class="tot"><span class="tot-k">{{ store.t('tasks.queryTotal.net') }}</span>
                <b [class.in]="m.net >= 0" [class.out]="m.net < 0">{{ fmt(m.net) }}</b></span>
            </div>
          }
        </div>
        <div class="actions">
          <div class="seg">
            <button class="seg-opt" [class.active]="store.layout() === 'list'" (click)="store.layout.set('list')">
              <app-icon name="list" [size]="14" /> {{ store.t('tasks.layout.list') }}
            </button>
            <button class="seg-opt" [class.active]="store.layout() === 'grouped'" (click)="store.layout.set('grouped')">
              <app-icon name="grid" [size]="14" /> {{ store.t('tasks.layout.grouped') }}
            </button>
          </div>
          <button class="btn btn-secondary" [class.on]="store.queryPanelOpen()" (click)="store.toggleQueryPanel()">
            <app-icon name="filter" [size]="14" /> {{ store.t('tasks.filters') }}
            @if (activeCount() > 0) { <span class="badge">{{ activeCount() }}</span> }
          </button>
          @if (store.selecting()) {
            <button class="btn btn-secondary" (click)="store.stopSelecting()"><app-icon name="x" [size]="14" /> {{ store.t('tasks.selectDone') }}</button>
          } @else {
            <button class="btn btn-secondary" (click)="store.startSelecting()"><app-icon name="check" [size]="14" /> {{ store.t('tasks.select') }}</button>
          }
          <button class="btn btn-primary" (click)="store.openNew()"><app-icon name="plus" [size]="16" /> {{ store.t('tasks.new') }}</button>
        </div>
      </header>

      <div class="search">
        <app-icon name="search" [size]="16" class="search-ic" />
        <input class="input" [placeholder]="store.t('tasks.searchPlaceholder')" [value]="store.queryDraft().text"
               (input)="store.patchQuery({ text: value($event) })">
        @if (store.queryActive()) {
          <button class="btn btn-ghost clear" (click)="store.clearQuery()"><app-icon name="x" [size]="14" /> {{ store.t('tasks.clear') }}</button>
        }
      </div>

      @if (store.queryPanelOpen()) {
        <app-query-panel />
      }

      @if (store.selecting()) {
        <div class="selbar">
          <button class="btn btn-ghost" (click)="store.toggleSelectAllVisible()">
            <app-icon [name]="store.allVisibleSelected() ? 'x' : 'check'" [size]="14" />
            {{ store.allVisibleSelected() ? store.t('tasks.clearAll') : store.t('tasks.selectAll') }}
          </button>
          <span class="selcount">{{ store.t('tasks.selectedCount', { count: store.selectedCount() }) }}</span>
          <span class="spacer"></span>
          <button class="btn btn-danger" [disabled]="store.selectedCount() === 0" (click)="store.askRemoveSelected()">
            <app-icon name="trash" [size]="14" /> {{ store.t('tasks.delete') }}
          </button>
        </div>
      }

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
    .btn.on { border-color: var(--color-accent); color: var(--color-accent); background: var(--accent-fill); }
    .badge {
      font-family: var(--font-mono); font-size: 11px; min-width: 18px; text-align: center;
      padding: 1px 5px; background: var(--color-accent); color: #fff;
    }
    .totals { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; }
    .tot { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--font-mono); font-size: 12px; }
    .tot-k { color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .tot b { font-size: 13px; font-weight: 700; }
    .tot .in { color: var(--color-income); }
    .tot .out { color: var(--color-danger); }
    .search { display: flex; align-items: center; gap: 10px; padding: 0 24px 16px; }
    .search .input { flex: 1; }
    .search-ic { color: var(--muted); flex: none; }
    .search .clear { flex: none; color: var(--muted); }
    .search .clear:hover { color: var(--color-accent); }
    .selbar {
      display: flex; align-items: center; gap: 12px; margin: 0 24px 16px; padding: 8px 12px;
      border: 1px solid var(--color-accent); background: var(--accent-fill);
    }
    .selbar .spacer { flex: 1; }
    .selcount { font-family: var(--font-mono); font-size: 12px; color: var(--muted-strong); }
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

    @media (max-width: 860px) {
      .head { flex-wrap: wrap; gap: 12px; padding: 16px 16px 12px; }
      .actions { width: 100%; flex-wrap: wrap; gap: 8px; }
      .search { padding: 0 16px 12px; }
      .selbar { margin: 0 16px 12px; flex-wrap: wrap; }
      .scroll { padding: 0 16px 16px; }
    }
    @media (max-width: 480px) {
      /* Let each control grow to share the row evenly instead of overflowing. */
      .actions .btn, .actions .seg { flex: 1 1 auto; justify-content: center; }
    }
  `],
})
export class TasksViewComponent {
  store = inject(TaskStore);

  fmt = fmtMoney;

  value(e: Event): string { return (e.target as HTMLInputElement).value; }

  // Money summary for query results — null when no query is active or nothing matched has an
  // amount, so the strip stays hidden for purely non-monetary result sets.
  queryTotals = computed(() =>
    this.store.queryActive() ? amountTotals(this.store.visibleTodos()) : null);

  // Count of active query criteria — drives the Filters badge.
  activeCount = computed(() => {
    const q = this.store.queryDraft();
    let n = 0;
    if (q.text.trim()) n++;
    if (q.catIds.length) n++;
    if (q.dueFrom != null || q.dueTo != null) n++;
    if (q.dateKind !== 'any') n++;
    if (q.amountKind !== 'any') n++;
    if (q.amountMin != null || q.amountMax != null) n++;
    if (q.bankAccountId != null) n++;
    return n;
  });

  titleInfo = computed(() => {
    const t = this.store.t;
    if (this.store.queryActive()) {
      const id = this.store.appliedQueryId();
      const saved = id && this.store.savedQueries().find((s) => s.id === id);
      const n = this.store.visibleTodos().length;
      return {
        title: saved ? saved.name : t('tasks.title.queryResults'),
        subtitle: t(n === 1 ? 'tasks.sub.queryMatchOne' : 'tasks.sub.queryMatchMany', { count: n }),
      };
    }
    const f = this.store.filter();
    if (f === 'all') return { title: t('tasks.title.all'), subtitle: t('tasks.sub.all') };
    if (f === 'today') return { title: t('tasks.title.today'), subtitle: t('tasks.sub.today') };
    if (f === 'upcoming') return { title: t('tasks.title.upcoming'), subtitle: t('tasks.sub.upcoming') };
    if (f === 'done') return { title: t('tasks.title.done'), subtitle: t('tasks.sub.done') };
    const s = this.store.subs().find((x) => x.id === f);
    const m = s && this.store.mains().find((x) => x.id === s.mainId);
    return {
      title: s?.name ?? t('tasks.title.category'),
      subtitle: m ? t('tasks.sub.categorySector', { main: m.name }) : t('tasks.sub.category'),
    };
  });

  emptyInfo = computed(() => {
    const t = this.store.t;
    if (this.store.queryActive()) {
      return { title: t('tasks.empty.query.title'), body: t('tasks.empty.query.body') };
    }
    const f = this.store.filter();
    if (f === 'today') return { title: t('tasks.empty.today.title'), body: t('tasks.empty.today.body') };
    if (f === 'done') return { title: t('tasks.empty.done.title'), body: t('tasks.empty.done.body') };
    if (f === 'upcoming') return { title: t('tasks.empty.upcoming.title'), body: t('tasks.empty.upcoming.body') };
    return { title: t('tasks.empty.all.title'), body: t('tasks.empty.all.body') };
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
    if (uncat.length) out.push({ title: this.store.t('tasks.groupNoCategory'), items: uncat });
    return out;
  });
}
