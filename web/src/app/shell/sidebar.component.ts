import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TaskStore } from '../core/task.store';
import { Filter } from '../core/todo-util';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <aside class="sidebar om-scroll">
      <!-- nav -->
      <nav class="section rule-2">
        <a class="nav" routerLink="/tasks" routerLinkActive="active">
          <app-icon name="tasks" /><span>Tasks</span>
        </a>
        <a class="nav" routerLink="/categories" routerLinkActive="active">
          <app-icon name="folder" /><span>Manage categories</span>
        </a>
        <a class="nav" routerLink="/import" routerLinkActive="active">
          <app-icon name="upload" /><span>Import bank file</span>
        </a>
        <a class="nav" routerLink="/reports" routerLinkActive="active">
          <app-icon name="bar-chart" /><span>Spending report</span>
        </a>
      </nav>

      <!-- smart lists -->
      <div class="section rule-2">
        <div class="kicker sec-kicker">Lists</div>
        @for (f of smartFilters(); track f.key) {
          <button class="filter" [class.active]="store.filter() === f.key" (click)="pick(f.key)">
            <span class="sq" [style.background]="f.dot"></span>
            <span class="label">{{ f.label }}</span>
            <span class="count">{{ f.count }}</span>
          </button>
        }
      </div>

      <!-- category tree -->
      <div class="section">
        <div class="kicker sec-kicker">Categories</div>
        @for (m of store.mains(); track m.id) {
          <div class="main-label">{{ m.name }}</div>
          @for (s of store.subsOf(m.id); track s.id) {
            <button class="filter sub" [class.active]="store.filter() === s.id" (click)="pick(s.id)">
              <span class="label">{{ s.name }}</span>
              <span class="count">{{ s.taskCount }}</span>
            </button>
          }
        }
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 248px; flex: none; height: 100%; overflow-y: auto;
      background: var(--color-surface);
      border-right: 2px solid var(--color-divider);
      display: flex; flex-direction: column;
    }
    .section { padding: 10px; }
    .sec-kicker { padding: 6px 8px 10px; }
    .nav {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 10px; border: 0; cursor: pointer; text-decoration: none;
      font-family: var(--font-heading); font-weight: 800; font-size: 13px;
      text-transform: uppercase; letter-spacing: 0.04em;
      background: transparent; color: var(--color-text);
    }
    .nav:hover { background: var(--tint-hover); }
    .nav.active { background: var(--accent-fill); color: var(--color-accent); box-shadow: inset 3px 0 0 var(--color-accent); }
    .filter {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 7px 8px; border: 0; cursor: pointer; text-align: left;
      font-size: 13px; background: transparent; color: var(--color-text);
    }
    .filter:hover { background: var(--tint-hover); }
    .filter.active { background: var(--accent-fill); color: var(--color-accent); box-shadow: inset 3px 0 0 var(--color-accent); }
    .filter.sub { padding-left: 14px; }
    .sq { width: 9px; height: 9px; flex: none; }
    .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count {
      font-family: var(--font-mono); font-size: 11px; min-width: 20px; text-align: right;
      color: var(--muted-strong);
    }
    .filter.active .count { color: var(--color-accent); }
    .main-label {
      font-weight: 700; font-size: 13px; padding: 10px 8px 4px;
    }
  `],
})
export class SidebarComponent {
  store = inject(TaskStore);
  private router = inject(Router);

  smartFilters() {
    const c = this.store.counts();
    return [
      { key: 'all' as Filter, label: 'All tasks', count: c.all, dot: 'var(--color-neutral-500)' },
      { key: 'today' as Filter, label: 'Today', count: c.today, dot: 'var(--color-accent)' },
      { key: 'upcoming' as Filter, label: 'Upcoming', count: c.upcoming, dot: 'var(--color-accent-400)' },
      { key: 'done' as Filter, label: 'Completed', count: c.done, dot: 'var(--color-neutral-400)' },
    ];
  }

  pick(f: Filter): void {
    this.store.filter.set(f);
    void this.router.navigate(['/tasks']);
  }
}
