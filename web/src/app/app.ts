import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaskStore } from './core/task.store';
import { TitleBarComponent } from './shell/title-bar.component';
import { SidebarComponent } from './shell/sidebar.component';
import { TaskDialogComponent } from './dialogs/task-dialog.component';
import { CategoryRenameDialogComponent } from './dialogs/category-rename-dialog.component';
import { ImportCatDialogComponent } from './dialogs/import-cat-dialog.component';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog.component';
import { SaveQueryDialogComponent } from './dialogs/save-query-dialog.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, TitleBarComponent, SidebarComponent,
    TaskDialogComponent, CategoryRenameDialogComponent, ImportCatDialogComponent,
    ConfirmDialogComponent, SaveQueryDialogComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private store = inject(TaskStore);

  ngOnInit(): void {
    void this.store.loadAll();
  }
}
