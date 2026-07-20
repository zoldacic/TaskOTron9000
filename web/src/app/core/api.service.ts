import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  BankAccount, Categories, ImportCommitRow, ImportRow, Main, Report, SavedQuery, Sub, TaskQuery,
  TitleDefault, Todo, TodoWrite,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = API_BASE;

  // ---- tasks ----
  getTodos(): Observable<Todo[]> {
    return this.http.get<Todo[]>(`${this.base}/api/todos`);
  }
  createTodo(body: TodoWrite): Observable<Todo> {
    return this.http.post<Todo>(`${this.base}/api/todos`, body);
  }
  updateTodo(id: number, body: TodoWrite): Observable<Todo> {
    return this.http.put<Todo>(`${this.base}/api/todos/${id}`, body);
  }
  toggleTodo(id: number): Observable<Todo> {
    return this.http.patch<Todo>(`${this.base}/api/todos/${id}/toggle`, {});
  }
  deleteTodo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/todos/${id}`);
  }
  bulkDeleteTodos(ids: number[]): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(`${this.base}/api/todos/bulk-delete`, { ids });
  }

  // ---- categories ----
  getCategories(): Observable<Categories> {
    return this.http.get<Categories>(`${this.base}/api/categories`);
  }
  addMain(name: string): Observable<Main> {
    return this.http.post<Main>(`${this.base}/api/mains`, { name });
  }
  renameMain(id: string, name: string): Observable<Main> {
    return this.http.put<Main>(`${this.base}/api/mains/${id}`, { name });
  }
  deleteMain(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/mains/${id}`);
  }
  addSub(mainId: string, name: string): Observable<Sub> {
    return this.http.post<Sub>(`${this.base}/api/subs`, { mainId, name });
  }
  renameSub(id: string, name: string): Observable<Sub> {
    return this.http.put<Sub>(`${this.base}/api/subs/${id}`, { name });
  }
  deleteSub(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/subs/${id}`);
  }

  // ---- bank accounts ----
  getBankAccounts(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.base}/api/bank-accounts`);
  }
  addBankAccount(name: string): Observable<BankAccount> {
    return this.http.post<BankAccount>(`${this.base}/api/bank-accounts`, { name });
  }
  deleteBankAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/bank-accounts/${id}`);
  }

  // ---- saved queries ----
  getSavedQueries(): Observable<SavedQuery[]> {
    return this.http.get<SavedQuery[]>(`${this.base}/api/saved-queries`);
  }
  addSavedQuery(name: string, query: TaskQuery): Observable<SavedQuery> {
    return this.http.post<SavedQuery>(`${this.base}/api/saved-queries`, { name, query });
  }
  updateSavedQuery(id: string, name: string, query: TaskQuery): Observable<SavedQuery> {
    return this.http.put<SavedQuery>(`${this.base}/api/saved-queries/${id}`, { name, query });
  }
  deleteSavedQuery(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/saved-queries/${id}`);
  }

  // ---- title defaults ----
  getTitleDefaults(): Observable<TitleDefault[]> {
    return this.http.get<TitleDefault[]>(`${this.base}/api/title-defaults`);
  }
  putTitleDefault(normalizedTitle: string, catIds: string[]): Observable<TitleDefault> {
    return this.http.put<TitleDefault>(
      `${this.base}/api/title-defaults/${encodeURIComponent(normalizedTitle)}`, { catIds });
  }
  deleteTitleDefault(normalizedTitle: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/api/title-defaults/${encodeURIComponent(normalizedTitle)}`);
  }

  // ---- import ----
  parseImport(text: string): Observable<ImportRow[]> {
    return this.http.post<ImportRow[]>(`${this.base}/api/import/parse`, { text });
  }
  commitImport(rows: ImportCommitRow[]): Observable<Todo[]> {
    return this.http.post<Todo[]>(`${this.base}/api/import/commit`, { rows });
  }

  // ---- reports ----
  // `categories` null => all; empty array => none selected.
  getReport(from: string, to: string, categories: string[] | null): Observable<Report> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (categories !== null) params = params.set('categories', categories.join(','));
    return this.http.get<Report>(`${this.base}/api/report`, { params });
  }
}
