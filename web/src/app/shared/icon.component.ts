import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Inline Lucide-style SVG icons (matching the prototype, which inlines SVGs).
 * Avoids a runtime dependency — lucide-angular does not yet support Angular 22.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" [attr.stroke-width]="strokeWidth"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name) {
        @case ('check') { <path d="M20 6 9 17l-5-5" /> }
        @case ('tasks') {
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        }
        @case ('folder') {
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        }
        @case ('upload') {
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5" />
          <path d="M12 3v12" />
        }
        @case ('bar-chart') {
          <path d="M3 3v18h18" />
          <path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
        }
        @case ('calendar') {
          <path d="M8 2v4" /><path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        }
        @case ('receipt') {
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        }
        @case ('pencil') {
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
        }
        @case ('trash') {
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M10 11v6" /><path d="M14 11v6" />
        }
        @case ('plus') { <path d="M5 12h14" /><path d="M12 5v14" /> }
        @case ('x') { <path d="M18 6 6 18" /><path d="m6 6 12 12" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('square') { <rect x="4" y="4" width="16" height="16" /> }
        @case ('star') {
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
        }
        @case ('list') {
          <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
          <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
        }
        @case ('grid') {
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        }
      }
    </svg>
  `,
})
export class IconComponent {
  @Input() name!: string;
  @Input() size = 16;
  @Input() strokeWidth = 2;
}
