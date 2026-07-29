import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';
import {
  AskEvent, AskMessage, AskStatus, BankAccount, Categories, ImportCommitRow, ImportRow, Main,
  Report, SavedQuery, Sub, TaskQuery, TitleDefault, Todo, TodoWrite,
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
  // Apply a main category (+ optional subs) to the given tasks by id.
  bulkCategorizeTodos(ids: number[], mainId: string, catIds: string[]): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.base}/api/todos/bulk-categorize`, { ids, mainId, catIds });
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
  // Move a sub to another main; reassignTasks also realigns tasks + import defaults under the old main.
  moveSub(id: string, mainId: string, reassignTasks: boolean): Observable<Sub> {
    return this.http.put<Sub>(`${this.base}/api/subs/${id}/main`, { mainId, reassignTasks });
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
  putTitleDefault(match: string, catIds: string[], mainId: string | null): Observable<TitleDefault> {
    // Match travels in the body (not the URL path) so titles with '/' aren't mangled.
    return this.http.put<TitleDefault>(`${this.base}/api/title-defaults`, { match, catIds, mainId });
  }
  deleteTitleDefault(match: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/title-defaults`, { params: { match } });
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
  getReport(from: string, to: string, categories: string[] | null, groupBy: 'main' | 'sub'): Observable<Report> {
    let params = new HttpParams().set('from', from).set('to', to).set('groupBy', groupBy);
    if (categories !== null) params = params.set('categories', categories.join(','));
    return this.http.get<Report>(`${this.base}/api/report`, { params });
  }

  // ---- ask claude ----
  getAskStatus(): Observable<AskStatus> {
    return this.http.get<AskStatus>(`${this.base}/api/ask/status`);
  }
  /**
   * Streams an answer, calling `onEvent` for each event as it arrives — text
   * chunks, the lookups Claude runs, and any failure.
   *
   * Uses fetch rather than HttpClient because we need the body as it downloads,
   * not the whole response at the end. The server sends newline-delimited JSON;
   * a network chunk can split a line, so partial lines are held back until the
   * newline arrives. Abort via `signal` to stop generating.
   */
  async streamAsk(
    messages: AskMessage[],
    onEvent: (e: AskEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`${this.base}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map((m) => ({ role: m.role, content: m.content })) }),
      signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(detail || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const drain = (flush = false) => {
      const lines = buffer.split('\n');
      // The trailing piece is incomplete until the stream ends.
      buffer = flush ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          onEvent(JSON.parse(line) as AskEvent);
        } catch {
          // A malformed line is not worth killing the answer over.
        }
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // stream: true keeps multi-byte characters intact across chunk boundaries.
      buffer += decoder.decode(value, { stream: true });
      drain();
    }
    drain(true);
  }
}
