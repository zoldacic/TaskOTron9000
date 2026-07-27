import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-move-sub-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.moveSubDialog(); as d) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog narrow" (click)="$event.stopPropagation()" (keydown.escape)="close()">
          <h2 class="dialog-title">{{ store.t('dialog.moveSub.title') }}</h2>
          <p class="msg">{{ store.t('dialog.moveSub.intro', { sub: d.name, main: store.mainName(d.fromMainId) }) }}</p>

          <label class="field mt">
            <span class="kicker">{{ store.t('dialog.moveSub.moveTo') }}</span>
            <select class="input" [value]="d.toMainId" (change)="setTarget($event)" autofocus>
              @for (m of store.moveSubTargets(); track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
          </label>

          @if (d.affected > 0) {
            <label class="check mt">
              <input type="checkbox" [checked]="d.reassign" (change)="setReassign($event)">
              <span>{{ store.t(d.affected === 1 ? 'dialog.moveSub.reassignOne' : 'dialog.moveSub.reassignMany', { count: d.affected, main: store.mainName(d.toMainId) }) }}</span>
            </label>
          }

          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="close()">{{ store.t('common.cancel') }}</button>
            <button class="btn btn-primary" [disabled]="!d.toMainId" (click)="store.saveMoveSub()">{{ store.t('dialog.moveSub.move') }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .narrow { width: 400px; }
    .msg { margin: 4px 0 4px; color: var(--muted-strong); line-height: 1.45; }
    .mt { margin-top: 16px; }
    .check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; cursor: pointer; line-height: 1.4; }
    .check input { accent-color: var(--color-accent); width: 16px; height: 16px; margin-top: 1px; flex: none; }
  `],
})
export class MoveSubDialogComponent {
  store = inject(TaskStore);

  setTarget(e: Event): void { this.store.updateMoveSub({ toMainId: (e.target as HTMLSelectElement).value }); }
  setReassign(e: Event): void { this.store.updateMoveSub({ reassign: (e.target as HTMLInputElement).checked }); }
  close(): void { this.store.moveSubDialog.set(null); }
}
