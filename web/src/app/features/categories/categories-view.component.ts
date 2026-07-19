import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-categories-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="view">
      <header class="head">
        <h1 class="view-title">Categories</h1>
        <div class="view-sub">Organise tasks into main categories and sub categories.</div>
      </header>

      <div class="cols">
        <!-- main categories -->
        <section class="col mains">
          <div class="kicker col-kicker">Main categories</div>
          @for (m of store.mains(); track m.id) {
            <div class="main-row" [class.sel]="store.selectedMain() === m.id" (click)="store.selectMain(m.id)">
              <span class="name">{{ m.name }}</span>
              <span class="sub-count">{{ store.subsOf(m.id).length }} subs</span>
              <button class="btn-icon" (click)="rename('main', m.id, m.name); $event.stopPropagation()" aria-label="Rename"><app-icon name="pencil" /></button>
              <button class="btn-icon danger" (click)="store.askRemoveMain(m.id); $event.stopPropagation()" aria-label="Delete"><app-icon name="trash" /></button>
            </div>
          }
          <div class="add">
            <input class="input" placeholder="New main category…" [value]="store.newMain()"
                   (input)="store.newMain.set(value($event))" (keydown.enter)="store.addMain()">
            <button class="btn btn-secondary" [disabled]="!store.newMain().trim()" (click)="store.addMain()">Add</button>
          </div>
        </section>

        <!-- sub categories -->
        <section class="col subs">
          <div class="kicker col-kicker">Sub categories of <span class="accent">{{ selMainName() }}</span></div>
          @if (store.selectedMain(); as mid) {
            @if (store.subsOf(mid).length === 0) {
              <p class="empty">No sub categories yet — add one below.</p>
            } @else {
              @for (s of store.subsOf(mid); track s.id) {
                <div class="sub-row rule-1">
                  <span class="dot"></span>
                  <span class="name">{{ s.name }}</span>
                  <span class="task-count">{{ s.taskCount }} tasks</span>
                  <button class="btn-icon" (click)="rename('sub', s.id, s.name)" aria-label="Rename"><app-icon name="pencil" /></button>
                  <button class="btn-icon danger" (click)="store.askRemoveSub(s.id)" aria-label="Delete"><app-icon name="trash" /></button>
                </div>
              }
            }
            <div class="add sub-add">
              <input class="input" placeholder="New sub category…" [value]="store.newSub()"
                     (input)="store.newSub.set(value($event))" (keydown.enter)="store.addSub()">
              <button class="btn btn-secondary" [disabled]="!store.newSub().trim()" (click)="store.addSub()">Add</button>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .view { display: flex; flex-direction: column; height: 100%; }
    .head { padding: 24px 24px 16px; }
    .cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px 1fr; }
    .col { padding: 20px 24px; overflow-y: auto; }
    .mains { border-right: 2px solid var(--color-divider); }
    .col-kicker { margin-bottom: 16px; }
    .accent { color: var(--color-accent); }
    .main-row {
      display: flex; align-items: center; gap: 8px; padding: 10px; cursor: pointer;
      border: 1px solid transparent; margin-bottom: 4px;
    }
    .main-row.sel { border-color: var(--color-accent); background: var(--accent-fill); }
    .main-row .name { flex: 1; font-weight: 700; }
    .sub-count, .task-count { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
    .sub-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; }
    .sub-row .dot { width: 8px; height: 8px; background: var(--color-accent); flex: none; }
    .sub-row .name { flex: 1; }
    .add { display: flex; gap: 10px; margin-top: 16px; }
    .sub-add { max-width: 420px; }
    .empty { color: var(--muted); font-family: var(--font-mono); font-size: 13px; }
  `],
})
export class CategoriesViewComponent {
  store = inject(TaskStore);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  rename(kind: 'main' | 'sub', id: string, value: string): void { this.store.openRename(kind, id, value); }

  selMainName = computed(() =>
    this.store.mains().find((m) => m.id === this.store.selectedMain())?.name ?? '—');
}
