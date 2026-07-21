import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-category-rename-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.catDialog(); as c) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog narrow" (click)="$event.stopPropagation()">
          <h2 class="dialog-title">{{ store.t(c.kind === 'main' ? 'dialog.rename.titleMain' : 'dialog.rename.titleSub') }}</h2>
          <label class="field">
            <span class="kicker">{{ store.t('dialog.rename.name') }}</span>
            <input class="input" [value]="c.value" (input)="patch($event)"
                   (keydown.enter)="store.saveCat()" autofocus>
          </label>
          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!c.value.trim()" (click)="store.saveCat()">{{ store.t('common.save') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`.narrow { width: 380px; }`],
})
export class CategoryRenameDialogComponent {
  store = inject(TaskStore);

  patch(e: Event): void {
    const c = this.store.catDialog();
    if (c) this.store.catDialog.set({ ...c, value: (e.target as HTMLInputElement).value });
  }
  close(): void { this.store.catDialog.set(null); }
}
