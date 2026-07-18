import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  {
    path: 'tasks',
    loadComponent: () => import('./features/tasks/tasks-view.component').then((m) => m.TasksViewComponent),
  },
  {
    path: 'categories',
    loadComponent: () => import('./features/categories/categories-view.component').then((m) => m.CategoriesViewComponent),
  },
  {
    path: 'import',
    loadComponent: () => import('./features/import/import-view.component').then((m) => m.ImportViewComponent),
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/report/report-view.component').then((m) => m.ReportViewComponent),
  },
  { path: '**', redirectTo: 'tasks' },
];
