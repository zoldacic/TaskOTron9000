import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-import-cat-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.importCat(); as c) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ store.t('dialog.importCat.title') }}</h2>
          <p class="dialog-sub">{{ c.title }}</p>

          <!-- required single main category -->
          <div class="field">
            <span class="kicker">{{ store.t('dialog.importCat.category') }} <span class="req">*</span></span>
            <div class="chips">
              @for (m of store.mains(); track m.id) {
                <button class="chip main" [class.on]="c.mainId === m.id"
                        (click)="store.setImportCatMain(m.id)">{{ m.name }}</button>
              }
            </div>
          </div>

          <!-- optional subcategories; may belong to any main -->
          <div class="field">
            <span class="kicker">{{ store.t('dialog.importCat.subcategories') }} <span class="hint">{{ store.t('dialog.task.optional') }}</span></span>
            @for (m of store.mains(); track m.id) {
              <div class="cat-main">{{ m.name }}</div>
              <div class="chips">
                @for (s of store.subsOf(m.id); track s.id) {
                  <button class="chip" [class.on]="c.catIds.includes(s.id)" (click)="store.toggleImportCat(s.id)">{{ s.name }}</button>
                }
              </div>
            }
          </div>

          <label class="check">
            <input type="checkbox" [checked]="c.applyAll" (change)="flag('applyAll', $event)">
            <span>{{ store.t('dialog.importCat.applyAll', { count: sameTitleCount(), title: c.title }) }}</span>
          </label>
          <label class="check">
            <input type="checkbox" [checked]="c.remember" (change)="flag('remember', $event)">
            <span>{{ store.t('dialog.importCat.remember') }}</span>
          </label>

          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!c.mainId" (click)="store.saveImportCat()">{{ store.t('dialog.importCat.apply') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .field { margin-top: var(--space-4); }
    .req { color: var(--color-accent); }
    .hint { text-transform: none; letter-spacing: 0; color: var(--muted-strong); }
    .cat-main { font-weight: 700; font-size: 12px; margin: 10px 0 6px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip.main.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 16%, transparent); }
    .check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; cursor: pointer; }
    .check input { accent-color: var(--color-accent); width: 16px; height: 16px; }
  `],
})
export class ImportCatDialogComponent {
  store = inject(TaskStore);

  sameTitleCount(): number {
    const c = this.store.importCat();
    if (!c) return 0;
    const norm = c.title.trim().toLowerCase();
    return (this.store.importRows() ?? []).filter((r) => r.title.trim().toLowerCase() === norm).length;
  }

  flag(k: 'applyAll' | 'remember', e: Event): void {
    this.store.setImportCatFlag(k, (e.target as HTMLInputElement).checked);
  }
  close(): void { this.store.importCat.set(null); }
}
