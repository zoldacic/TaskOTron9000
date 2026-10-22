import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TaskStore } from '../core/task.store';
import { calculateNote, hasCalculation } from '../core/note-calc';
import { IconComponent } from './icon.component';

/** "Calculate" button under a note textarea; shown only while the note contains `==`. */
@Component({
  selector: 'app-note-calc-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (hasCalculation(note())) {
      <button type="button" class="btn calc" [title]="store.t('note.calculateHint')"
              (click)="calculated.emit(calculateNote(note()))">
        <app-icon name="calculator" [size]="14" /> {{ store.t('note.calculate') }}
      </button>
    }
  `,
  styles: [`
    :host { display: flex; justify-content: flex-end; }
    .calc { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 6px 12px; font-size: 12px; }
  `],
})
export class NoteCalcButtonComponent {
  store = inject(TaskStore);
  note = input.required<string>();
  calculated = output<string>();

  protected hasCalculation = hasCalculation;
  protected calculateNote = calculateNote;
}
