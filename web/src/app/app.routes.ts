import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'start' },
  {
    path: 'start',
    loadComponent: () => import('./features/start/start-view.component').then((m) => m.StartViewComponent),
  },
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
  {
    path: 'ask',
    loadComponent: () => import('./features/ask/ask-view.component').then((m) => m.AskViewComponent),
  },
  { path: '**', redirectTo: 'start' },
];
