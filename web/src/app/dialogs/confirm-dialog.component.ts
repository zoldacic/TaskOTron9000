import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.confirm(); as c) {
      <div class="dialog-backdrop" (click)="store.cancelConfirm()">
        <div class="dialog narrow" (click)="$event.stopPropagation()"
             (keydown.escape)="store.cancelConfirm()">
          <h2 class="dialog-title">{{ c.title }}</h2>
          <p class="msg">{{ c.message }}</p>
          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="store.cancelConfirm()">{{ store.t('common.cancel') }}</button>
            <button class="btn" [class.btn-primary]="c.confirmKind === 'primary'"
                    [class.btn-danger]="c.confirmKind !== 'primary'"
                    (click)="store.runConfirm()" autofocus>{{ c.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .narrow { width: 380px; }
    .msg { margin: 4px 0 4px; color: var(--muted-strong); line-height: 1.45; }
  `],
})
export class ConfirmDialogComponent {
  store = inject(TaskStore);
}
