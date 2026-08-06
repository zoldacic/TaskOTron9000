import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { Todo } from '../../models';
import { fmtMoney } from '../../core/money-util';
import { AmountTotals, amountTotals, COMING_DAYS } from '../../core/todo-util';
import { IconComponent } from '../../shared/icon.component';
import { TaskRowComponent } from '../tasks/task-row.component';

interface Section {
  kind: 'over' | 'today' | 'coming' | 'done' | 'yest';
  icon: string;
  title: string;
  hint: string;
  items: Todo[];
  totals: AmountTotals | null;
}

@Component({
  selector: 'app-start-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, TaskRowComponent],
  template: `
    <div class="view">
      <header class="head">
        <div class="titles">
          <h1 class="view-title">{{ store.t('start.title') }}</h1>
          <div class="view-sub">
            {{ store.t('start.sub', {
              overdue: store.overdueTodos().length,
              today: store.dueTodayTodos().length,
              done: store.doneTodayTodos().length,
            }) }}
          </div>
        </div>
        <a class="btn btn-secondary" routerLink="/tasks">
          <app-icon name="tasks" [size]="14" /> {{ store.t('start.openTasks') }}
        </a>
      </header>

      <div class="scroll om-scroll">
        @if (allClear()) {
          <div class="empty">
            <app-icon name="check" [size]="40" />
            <h2>{{ store.t('start.empty.title') }}</h2>
            <p>{{ store.t('start.empty.body') }}</p>
          </div>
        } @else {
          @for (s of sections(); track s.kind) {
            <section class="sec" [class.over]="s.kind === 'over'" [class.today]="s.kind === 'today'"
                     [class.coming]="s.kind === 'coming'"
                     [class.done]="s.kind === 'done'" [class.yest]="s.kind === 'yest'">
              <div class="sec-head">
                <app-icon [name]="s.icon" [size]="16" class="sec-ic" />
                <h2 class="sec-title">{{ s.title }}</h2>
                <span class="sec-count">{{ s.items.length }}</span>
                <span class="sec-hint">{{ s.hint }}</span>
                @if (s.totals; as m) {
                  <span class="tot">
                    <span class="tot-k">{{ store.t('start.total') }}</span>
                    <b [class.in]="m.net >= 0" [class.out]="m.net < 0">{{ fmt(m.net) }}</b>
                  </span>
                }
              </div>
              @for (t of s.items; track t.id) {
                <app-task-row [todo]="t" />
              }
            </section>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .view { display: flex; flex-direction: column; height: 100%; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 24px 16px; }
    .head .btn { flex: none; text-decoration: none; }
    .scroll {
      flex: 1; min-height: 0; overflow-y: auto; padding: 0 24px 24px;
      background-image:
        linear-gradient(color-mix(in srgb, #93a4cc 5%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, #93a4cc 5%, transparent) 1px, transparent 1px);
      background-size: 26px 26px;
    }
    /* Each state owns one accent colour, set once and reused by every child below. */
    .sec { --sec: var(--muted); margin-bottom: 24px; border-left: 3px solid var(--sec); background: var(--sec-fill); }
    .sec.over { --sec: var(--color-danger); --sec-fill: color-mix(in srgb, var(--color-danger) 7%, transparent); }
    .sec.today { --sec: var(--color-amber); --sec-fill: color-mix(in srgb, var(--color-amber) 7%, transparent); }
    /* Ahead of today, so it gets the neutral accent rather than one of the urgency colours. */
    .sec.coming { --sec: var(--color-accent); --sec-fill: color-mix(in srgb, var(--color-accent) 7%, transparent); }
    .sec.done { --sec: var(--color-income); --sec-fill: color-mix(in srgb, var(--color-income) 7%, transparent); }
    /* Yesterday is history, not a call to action — it stays grey so today's boxes keep the colour. */
    .sec.yest { --sec: var(--muted); --sec-fill: color-mix(in srgb, var(--muted) 7%, transparent); }
    .sec-head {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px;
      padding: 12px 14px; border-bottom: 2px solid color-mix(in srgb, var(--sec) 45%, transparent);
    }
    .sec-ic { color: var(--sec); align-self: center; }
    .sec-title {
      margin: 0; font-family: var(--font-heading); font-weight: 800; font-size: 15px;
      text-transform: uppercase; letter-spacing: 0.04em; color: var(--sec);
    }
    .sec-count {
      font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 2px 7px;
      background: color-mix(in srgb, var(--sec) 20%, transparent); color: var(--sec);
    }
    .sec-hint { flex: 1; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .tot { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--font-mono); font-size: 12px; }
    .tot-k { color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .tot b { font-size: 13px; }
    .tot .in { color: var(--color-income); }
    .tot .out { color: var(--color-danger); }
    .sec app-task-row { display: block; padding: 0 6px; }
    .empty { text-align: center; padding: 80px 24px; color: var(--muted); }
    .empty h2 { font-family: var(--font-heading); font-weight: 800; text-transform: uppercase; color: var(--color-income); margin: 16px 0 8px; }
    .empty p { font-family: var(--font-mono); font-size: 13px; }

    @media (max-width: 860px) {
      .head { flex-wrap: wrap; gap: 12px; padding: 16px 16px 12px; }
      .head .btn { flex: 1 1 auto; justify-content: center; }
      .scroll { padding: 0 16px 16px; }
      /* The hint stops earning its line once the head wraps — the title says it already. */
      .sec-hint { display: none; }
      .sec-head { padding: 10px 12px; }
      .sec app-task-row { padding: 0 2px; }
    }
  `],
})
export class StartViewComponent {
  store = inject(TaskStore);

  fmt = fmtMoney;

  allClear = computed(() => this.sections().length === 0);

  // An empty section is noise next to a non-empty one; both empty is the all-clear state above.
  sections = computed<Section[]>(() => {
    const t = this.store.t;
    const build = (
      kind: Section['kind'], icon: string, title: string, hint: string, items: Todo[],
    ): Section => ({ kind, icon, title, hint, items, totals: amountTotals(items) });
    return [
      build('over', 'alert-triangle', t('start.overdue.title'), t('start.overdue.hint'),
        this.store.overdueTodos()),
      build('today', 'clock', t('start.today.title'), t('start.today.hint'),
        this.store.dueTodayTodos()),
      build('coming', 'move', t('start.coming.title'), t('start.coming.hint', { days: COMING_DAYS }),
        this.store.comingTodos()),
      build('done', 'check', t('start.done.title'), t('start.done.hint'),
        this.store.doneTodayTodos()),
      build('yest', 'calendar', t('start.yesterday.title'), t('start.yesterday.hint'),
        this.store.doneYesterdayTodos()),
    ].filter((s) => s.items.length > 0);
  });
}
