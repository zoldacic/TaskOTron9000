import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';

@Component({
  selector: 'app-save-query-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.saveQueryName() !== null) {
      <div class="dialog-backdrop" (click)="store.cancelSaveQuery()">
        <div class="dialog narrow" (click)="$event.stopPropagation()"
             (keydown.escape)="store.cancelSaveQuery()">
          <h2 class="dialog-title">Save query</h2>
          <p class="msg">Name this query so you can reapply it later from the sidebar.</p>
          <input class="input" [value]="store.saveQueryName() ?? ''" placeholder="e.g. July groceries"
                 (input)="store.saveQueryName.set(value($event))"
                 (keydown.enter)="store.confirmSaveQuery()" autofocus>
          @if (store.saveQueryError(); as err) {
            <p class="err">{{ err }}</p>
          }
          <div class="dialog-actions">
            <button class="btn btn-secondary" (click)="store.cancelSaveQuery()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!(store.saveQueryName() ?? '').trim()"
                    (click)="store.confirmSaveQuery()">Save query</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .narrow { width: 380px; }
    .msg { margin: 4px 0 12px; color: var(--muted-strong); line-height: 1.45; }
    .err { margin: 8px 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-accent); }
  `],
})
export class SaveQueryDialogComponent {
  store = inject(TaskStore);
  value(e: Event): string { return (e.target as HTMLInputElement).value; }
}
