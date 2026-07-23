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
        <h1 class="view-title">{{ store.t('cat.title') }}</h1>
        <div class="view-sub">{{ store.t('cat.sub') }}</div>
      </header>

      <div class="cols">
        <!-- main categories -->
        <section class="col mains">
          <div class="kicker col-kicker">{{ store.t('cat.mainCategories') }}</div>
          @for (m of store.mains(); track m.id) {
            <div class="main-row" [class.sel]="store.selectedMain() === m.id" (click)="store.selectMain(m.id)">
              <span class="name">{{ m.name }}</span>
              <span class="sub-count">{{ store.t('cat.subsCount', { count: store.subsOf(m.id).length }) }}</span>
              <button class="btn-icon" (click)="rename('main', m.id, m.name); $event.stopPropagation()" [attr.aria-label]="store.t('cat.rename')"><app-icon name="pencil" /></button>
              <button class="btn-icon danger" (click)="store.askRemoveMain(m.id); $event.stopPropagation()" [attr.aria-label]="store.t('cat.delete')"><app-icon name="trash" /></button>
            </div>
          }
          <div class="add">
            <input class="input" [placeholder]="store.t('cat.newMainPlaceholder')" [value]="store.newMain()"
                   (input)="store.newMain.set(value($event))" (keydown.enter)="store.addMain()">
            <button class="btn btn-secondary" [disabled]="!store.newMain().trim()" (click)="store.addMain()">{{ store.t('cat.add') }}</button>
          </div>
          @if (store.catError(); as e) { <p class="cat-error">{{ e }}</p> }
        </section>

        <!-- sub categories -->
        <section class="col subs">
          <div class="kicker col-kicker">{{ store.t('cat.subsOf') }} <span class="accent">{{ selMainName() }}</span></div>
          @if (store.selectedMain(); as mid) {
            @if (store.subsOf(mid).length === 0) {
              <p class="empty">{{ store.t('cat.noSubs') }}</p>
            } @else {
              @for (s of store.subsOf(mid); track s.id) {
                <div class="sub-row rule-1">
                  <span class="dot"></span>
                  <span class="name">{{ s.name }}</span>
                  <span class="task-count">{{ store.t('cat.tasksCount', { count: s.taskCount }) }}</span>
                  <button class="btn-icon" (click)="rename('sub', s.id, s.name)" [attr.aria-label]="store.t('cat.rename')"><app-icon name="pencil" /></button>
                  <button class="btn-icon danger" (click)="store.askRemoveSub(s.id)" [attr.aria-label]="store.t('cat.delete')"><app-icon name="trash" /></button>
                </div>
              }
            }
            <div class="add sub-add">
              <input class="input" [placeholder]="store.t('cat.newSubPlaceholder')" [value]="store.newSub()"
                     (input)="store.newSub.set(value($event))" (keydown.enter)="store.addSub()">
              <button class="btn btn-secondary" [disabled]="!store.newSub().trim()" (click)="store.addSub()">{{ store.t('cat.add') }}</button>
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
    .cat-error { color: var(--color-danger); font-size: 12px; margin-top: 10px; }

    @media (max-width: 760px) {
      .head { padding: 16px 16px 12px; }
      /* Stack the two columns and scroll them as one panel on narrow screens. */
      .cols { grid-template-columns: 1fr; overflow-y: auto; }
      .col { overflow-y: visible; padding: 16px; }
      .mains { border-right: 0; border-bottom: 2px solid var(--color-divider); }
    }
  `],
})
export class CategoriesViewComponent {
  store = inject(TaskStore);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }
  rename(kind: 'main' | 'sub', id: string, value: string): void { this.store.openRename(kind, id, value); }

  selMainName = computed(() =>
    this.store.mains().find((m) => m.id === this.store.selectedMain())?.name ?? '—');
}
