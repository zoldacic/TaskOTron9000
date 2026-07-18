import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import {
  Categories, DateKind, ImportCommitRow, ImportRow, Main, Report, Sub, TitleDefault, Todo,
} from '../models';
import { matches, sortTodos, Filter } from './todo-util';
import { toISO, addDays, startOfToday, diffDays } from './date-util';

export interface TaskDraft {
  id: number | null;
  title: string;
  due: string | null;
  catIds: string[];
  amountStr: string;
  dateKind: DateKind;
}
export interface CatDraft {
  kind: 'main' | 'sub';
  id: string;
  value: string;
}
export interface ImportCatDraft {
  key: number;
  title: string;
  catIds: string[];
  applyAll: boolean;
  remember: boolean;
}

const SMART: Filter[] = ['all', 'today', 'upcoming', 'done'];
const isSmart = (f: Filter) => SMART.includes(f);

const SAMPLE_IMPORT = [
  '2026-07-15\tACME CORP PAYROLL\t+4200.00',
  '2026-07-14\tWHOLE FOODS MARKET\t-76.20',
  '2026-07-13\tSHELL FUEL 22817\t-52.40',
  '2026-07-12\tNETFLIX.COM\t-15.99',
  '2026-07-11\tTRANSFER FROM SAVINGS\t+500.00',
  '2026-07-10\tCITY POWER & LIGHT\t-84.50',
  '2026-07-08\tSTARBUCKS #4471\t-6.75',
  '2026-07-06\tAPARTMENT RENT\t-1650.00',
].join('\n');

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private api = inject(ApiService);

  // ---- data ----
  readonly todos = signal<Todo[]>([]);
  readonly mains = signal<Main[]>([]);
  readonly subs = signal<Sub[]>([]);
  readonly titleDefaults = signal<TitleDefault[]>([]);

  // ---- view state ----
  readonly filter = signal<Filter>('all');
  readonly layout = signal<'list' | 'grouped'>('list');
  readonly quickAdd = signal('');
  readonly selectedMain = signal<string | null>(null);
  readonly newMain = signal('');
  readonly newSub = signal('');

  // ---- dialogs ----
  readonly taskDialog = signal<TaskDraft | null>(null);
  readonly catDialog = signal<CatDraft | null>(null);
  readonly importCat = signal<ImportCatDraft | null>(null);

  // ---- import ----
  readonly importText = signal('');
  readonly importRows = signal<ImportRow[] | null>(null);

  // ---- reports ----
  readonly repStart = signal('2026-07-01');
  readonly repEnd = signal('2026-07-31');
  readonly repSel = signal<string[] | null>(null); // null = all
  readonly report = signal<Report | null>(null);

  // ---- computed ----
  readonly visibleTodos = computed(() =>
    sortTodos(this.todos().filter((t) => matches(t, this.filter()))));

  readonly pendingCount = computed(() => this.todos().filter((t) => !t.done).length);

  readonly counts = computed(() => {
    const all = this.todos();
    const active = (t: Todo) => !t.done && !!t.due && t.dateKind !== 'transaction';
    return {
      all: all.length,
      today: all.filter((t) => active(t) && diffDays(t.due!) <= 0).length,
      upcoming: all.filter((t) => active(t) && diffDays(t.due!) > 0).length,
      done: all.filter((t) => t.done).length,
    };
  });

  subName(id: string): string {
    return this.subs().find((s) => s.id === id)?.name ?? '';
  }
  subsOf(mainId: string): Sub[] {
    return this.subs().filter((s) => s.mainId === mainId);
  }

  // ---- loading ----
  async loadAll(): Promise<void> {
    await Promise.all([this.refreshTodos(), this.refreshCategories(), this.refreshTitleDefaults()]);
    if (this.selectedMain() === null) this.selectedMain.set(this.mains()[0]?.id ?? null);
  }
  async refreshTodos(): Promise<void> {
    this.todos.set(await firstValueFrom(this.api.getTodos()));
  }
  async refreshCategories(): Promise<void> {
    const c: Categories = await firstValueFrom(this.api.getCategories());
    this.mains.set(c.mains);
    this.subs.set(c.subs);
  }
  async refreshTitleDefaults(): Promise<void> {
    this.titleDefaults.set(await firstValueFrom(this.api.getTitleDefaults()));
  }

  // ---- tasks ----
  async toggle(id: number): Promise<void> {
    await firstValueFrom(this.api.toggleTodo(id));
    await this.refreshTodos();
  }
  async remove(id: number): Promise<void> {
    await firstValueFrom(this.api.deleteTodo(id));
    await this.refreshTodos();
  }

  private inheritedCatIds(): string[] {
    const f = this.filter();
    return isSmart(f) ? [] : [f];
  }

  async addQuick(): Promise<void> {
    const title = this.quickAdd().trim();
    if (!title) return;
    await firstValueFrom(this.api.createTodo({
      title, due: null, amount: null, dateKind: 'due', catIds: this.inheritedCatIds(),
    }));
    this.quickAdd.set('');
    await this.refreshTodos();
  }

  openNew(): void {
    const due = this.filter() === 'today' ? toISO(startOfToday()) : null;
    this.taskDialog.set({
      id: null, title: '', due, catIds: this.inheritedCatIds(), amountStr: '', dateKind: 'due',
    });
  }
  openEdit(id: number): void {
    const t = this.todos().find((x) => x.id === id);
    if (!t) return;
    this.taskDialog.set({
      id, title: t.title, due: t.due, catIds: [...t.catIds],
      amountStr: t.amount == null ? '' : String(t.amount), dateKind: t.dateKind ?? 'due',
    });
  }
  updateDialog(patch: Partial<TaskDraft>): void {
    const d = this.taskDialog();
    if (d) this.taskDialog.set({ ...d, ...patch });
  }
  toggleDraftCat(subId: string): void {
    const d = this.taskDialog();
    if (!d) return;
    const has = d.catIds.includes(subId);
    this.updateDialog({ catIds: has ? d.catIds.filter((x) => x !== subId) : [...d.catIds, subId] });
  }
  async saveTask(): Promise<void> {
    const d = this.taskDialog();
    if (!d || !d.title.trim()) return;
    const parsed = d.amountStr.trim() !== '' ? parseFloat(d.amountStr) : NaN;
    const amount = Number.isNaN(parsed) ? null : parsed;
    const body = { title: d.title.trim(), due: d.due, amount, dateKind: d.dateKind, catIds: d.catIds };
    if (d.id == null) await firstValueFrom(this.api.createTodo(body));
    else await firstValueFrom(this.api.updateTodo(d.id, body));
    this.taskDialog.set(null);
    await this.refreshTodos();
  }
  async deleteFromDialog(): Promise<void> {
    const d = this.taskDialog();
    if (d?.id != null) await this.remove(d.id);
    this.taskDialog.set(null);
  }

  // ---- categories ----
  selectMain(id: string): void { this.selectedMain.set(id); }

  async addMain(): Promise<void> {
    const name = this.newMain().trim();
    if (!name) return;
    const created = await firstValueFrom(this.api.addMain(name));
    this.newMain.set('');
    await this.refreshCategories();
    this.selectedMain.set(created.id);
  }
  async addSub(): Promise<void> {
    const name = this.newSub().trim();
    const mainId = this.selectedMain();
    if (!name || !mainId) return;
    await firstValueFrom(this.api.addSub(mainId, name));
    this.newSub.set('');
    await this.refreshCategories();
  }
  async removeMain(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteMain(id));
    if (this.filter() === id) this.filter.set('all');
    await Promise.all([this.refreshCategories(), this.refreshTodos()]);
    if (this.selectedMain() === id) this.selectedMain.set(this.mains()[0]?.id ?? null);
  }
  async removeSub(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteSub(id));
    if (this.filter() === id) this.filter.set('all');
    await Promise.all([this.refreshCategories(), this.refreshTodos(), this.refreshTitleDefaults()]);
  }
  openRename(kind: 'main' | 'sub', id: string, value: string): void {
    this.catDialog.set({ kind, id, value });
  }
  async saveCat(): Promise<void> {
    const c = this.catDialog();
    const v = c?.value.trim();
    if (!c || !v) return;
    if (c.kind === 'main') await firstValueFrom(this.api.renameMain(c.id, v));
    else await firstValueFrom(this.api.renameSub(c.id, v));
    this.catDialog.set(null);
    await this.refreshCategories();
  }

  // ---- import ----
  loadSampleImport(): void { this.importText.set(SAMPLE_IMPORT); this.importRows.set(null); }
  clearImport(): void { this.importText.set(''); this.importRows.set(null); }
  async parseImport(): Promise<void> {
    this.importRows.set(await firstValueFrom(this.api.parseImport(this.importText())));
  }
  async commitImport(): Promise<void> {
    const rows = (this.importRows() ?? []).filter((r) => r.ok);
    if (!rows.length) return;
    const body: ImportCommitRow[] = rows.map((r) => ({
      title: r.title, date: r.date, amount: r.amount, catIds: r.catIds,
    }));
    await firstValueFrom(this.api.commitImport(body));
    this.importText.set('');
    this.importRows.set(null);
    this.filter.set('all');
    await this.refreshTodos();
  }
  openImportCat(key: number): void {
    const r = (this.importRows() ?? []).find((x) => x.key === key);
    if (!r) return;
    const norm = r.title.trim().toLowerCase();
    this.importCat.set({
      key, title: r.title, catIds: [...(r.catIds ?? [])], applyAll: false,
      remember: this.titleDefaults().some((d) => d.normalizedTitle === norm),
    });
  }
  toggleImportCat(id: string): void {
    const c = this.importCat();
    if (!c) return;
    const has = c.catIds.includes(id);
    this.importCat.set({ ...c, catIds: has ? c.catIds.filter((x) => x !== id) : [...c.catIds, id] });
  }
  setImportCatFlag(k: 'applyAll' | 'remember', v: boolean): void {
    const c = this.importCat();
    if (c) this.importCat.set({ ...c, [k]: v });
  }
  async saveImportCat(): Promise<void> {
    const c = this.importCat();
    if (!c) return;
    const norm = c.title.trim().toLowerCase();
    // Apply to this row (and same-title rows if requested).
    this.importRows.set((this.importRows() ?? []).map((r) =>
      r.key === c.key || (c.applyAll && r.title.trim().toLowerCase() === norm)
        ? { ...r, catIds: [...c.catIds] } : r));
    // Persist / clear the remembered default.
    if (c.remember) await firstValueFrom(this.api.putTitleDefault(norm, c.catIds));
    else await firstValueFrom(this.api.deleteTitleDefault(norm));
    this.importCat.set(null);
    await this.refreshTitleDefaults();
  }

  // ---- reports ----
  async loadReport(): Promise<void> {
    this.report.set(await firstValueFrom(
      this.api.getReport(this.repStart(), this.repEnd(), this.repSel())));
  }
  allSubIds(): string[] { return this.subs().map((s) => s.id); }
  repToggleSub(id: string): void {
    const base = [...this.allSubIds(), '__none__'];
    const cur = this.repSel() == null ? [...base] : [...this.repSel()!];
    const i = cur.indexOf(id);
    if (i >= 0) cur.splice(i, 1); else cur.push(id);
    this.repSel.set(cur);
    void this.loadReport();
  }
  repAll(): void { this.repSel.set(null); void this.loadReport(); }
  repNone(): void { this.repSel.set([]); void this.loadReport(); }
  setRange(from: string, to: string): void {
    this.repStart.set(from);
    this.repEnd.set(to);
    void this.loadReport();
  }
  quickRange(kind: 'month' | 'last30' | 'year'): void {
    const now = startOfToday();
    if (kind === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.setRange(toISO(s), toISO(e));
    } else if (kind === 'last30') {
      this.setRange(toISO(addDays(now, -29)), toISO(now));
    } else {
      this.setRange(toISO(new Date(now.getFullYear(), 0, 1)), toISO(new Date(now.getFullYear(), 11, 31)));
    }
  }
}
