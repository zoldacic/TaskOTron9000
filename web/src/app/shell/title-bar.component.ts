import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-title-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="bar rule-2">
      <div class="left">
        <div class="logo"></div>
        <span class="name">TASK-O-TRON 9000</span>
        <span class="status">
          <span class="dot"></span>{{ store.pendingCount() }} PENDING · SYSTEM ONLINE
        </span>
      </div>
      <div class="win">
        <button aria-label="Minimize"><app-icon name="minus" [size]="14" /></button>
        <button aria-label="Maximize"><app-icon name="square" [size]="12" /></button>
        <button class="close" aria-label="Close"><app-icon name="x" [size]="14" /></button>
      </div>
    </div>
  `,
  styles: [`
    .bar {
      height: 40px;
      flex: none;
      display: flex;
      align-items: center;
      background: var(--color-surface);
      user-select: none;
    }
    .left { display: flex; align-items: center; gap: 10px; padding: 0 14px; flex: 1; min-width: 0; }
    .logo {
      width: 16px; height: 16px; flex: none;
      background: var(--color-accent);
      box-shadow: 0 0 12px -1px var(--color-accent);
    }
    .name {
      font-family: var(--font-heading); font-weight: 800; font-size: 13px;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .status {
      display: inline-flex; align-items: center; gap: 7px;
      font-family: var(--font-mono); font-size: 11px; white-space: nowrap; color: var(--muted);
    }
    .dot {
      width: 7px; height: 7px; background: var(--color-income);
      box-shadow: 0 0 8px var(--color-income); animation: omBlink 1.8s ease-in-out infinite;
    }
    .win { display: flex; height: 100%; }
    .win button {
      width: 46px; height: 100%; border: 0; background: transparent;
      color: var(--color-text); cursor: pointer; display: grid; place-items: center;
    }
    .win button:hover { background: color-mix(in srgb, var(--color-text) 9%, transparent); }
    .win button.close:hover { background: var(--color-accent); color: var(--color-bg); }
  `],
})
export class TitleBarComponent {
  store = inject(TaskStore);
}
