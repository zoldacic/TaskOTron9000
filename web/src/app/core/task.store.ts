import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import {
  BankAccount, Categories, DateKind, ImportCommitRow, ImportRow, Main, Report, SavedQuery, Sub,
  TaskQuery, TitleDefault, Todo,
} from '../models';
import { matches, sortTodos, Filter } from './todo-util';
import { emptyQuery, isEmptyQuery, matchesQuery } from './task-query';
import { toISO, addDays, startOfToday, diffDays } from './date-util';
import { I18nService } from './i18n/i18n.service';
import { TranslationKey } from './i18n/en';
import { TParams } from './i18n/types';

export interface TaskDraft {
  id: number | null;
  title: string;
  due: string | null;
  mainId: string; // required single main category
  catIds: string[];
  amountStr: string;
  dateKind: DateKind;
  bankAccountId: string | null;
  note: string;
}
export interface CatDraft {
  kind: 'main' | 'sub';
  id: string;
  value: string;
}
export interface ImportCatDraft {
  key: number;
  title: string;
  /** Substring "Apply to all" matches on (case-insensitive). Defaults to the full title. */
  match: string;
  mainId: string; // required single main category (radio behaviour)
  catIds: string[];
  note: string;
  applyAll: boolean;
  remember: boolean;
}
export interface Confirm {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => void | Promise<void>;
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
  private i18n = inject(I18nService);

  // ---- i18n facade (every component already injects `store`, so templates use store.t(...)) ----
  readonly lang = this.i18n.lang;
  setLang = (l: Parameters<I18nService['setLang']>[0]): void => this.i18n.setLang(l);
  t = (key: TranslationKey, params?: TParams): string => this.i18n.t(key, params);

  // ---- data ----
  readonly todos = signal<Todo[]>([]);
  readonly mains = signal<Main[]>([]);
  readonly subs = signal<Sub[]>([]);
  readonly titleDefaults = signal<TitleDefault[]>([]);
  readonly bankAccounts = signal<BankAccount[]>([]);
  readonly savedQueries = signal<SavedQuery[]>([]);

  // ---- view state ----
  readonly filter = signal<Filter>('all');

  // ---- querying ----
  // activeQuery non-null => the composable query drives visibleTodos, overriding `filter`.
  readonly activeQuery = signal<TaskQuery | null>(null);
  readonly queryDraft = signal<TaskQuery>(emptyQuery());
  readonly queryPanelOpen = signal(false);
  readonly appliedQueryId = signal<string | null>(null); // which saved query is applied (sidebar highlight)
  readonly saveQueryName = signal<string | null>(null); // non-null => "name this query" dialog open
  readonly saveQueryError = signal<string | null>(null);
  readonly layout = signal<'list' | 'grouped'>('list');
  readonly quickAdd = signal('');
  readonly selectedMain = signal<string | null>(null);
  readonly newMain = signal('');
  readonly newSub = signal('');
  readonly catError = signal<string | null>(null); // e.g. main-in-use on delete

  // ---- selection (multi-select for bulk actions) ----
  readonly selecting = signal(false);
  readonly selectedIds = signal<Set<number>>(new Set());

  // ---- dialogs ----
  readonly taskDialog = signal<TaskDraft | null>(null);
  readonly expandedMains = signal<Set<string>>(new Set());
  readonly catDialog = signal<CatDraft | null>(null);
  readonly importCat = signal<ImportCatDraft | null>(null);
  readonly confirm = signal<Confirm | null>(null);

  // ---- import ----
  readonly importText = signal('');
  readonly importAccountId = signal<string | null>(null);
  readonly importMainId = signal<string | null>(null); // batch default main for imported tasks
  readonly importRows = signal<ImportRow[] | null>(null);

  // ---- bank accounts ----
  readonly newBankAccount = signal('');
  readonly bankAccountError = signal<string | null>(null);

  // ---- reports ----
  readonly repStart = signal('2026-07-01');
  readonly repEnd = signal('2026-07-31');
  // Selection grain: 'main' → repSel holds main ids; 'sub' → repSel holds sub ids.
  readonly repMode = signal<'main' | 'sub'>('main');
  readonly repSel = signal<string[] | null>(null); // null = all
  readonly report = signal<Report | null>(null);

  // ---- computed ----
  readonly visibleTodos = computed(() => {
    const q = this.activeQuery();
    const list = q
      ? this.todos().filter((t) => matchesQuery(t, q))
      : this.todos().filter((t) => matches(t, this.filter()));
    return sortTodos(list);
  });

  readonly queryActive = computed(() => this.activeQuery() !== null);

  readonly pendingCount = computed(() => this.todos().filter((t) => !t.done).length);

  readonly selectedCount = computed(() => this.selectedIds().size);
  // True when every currently-visible task is selected (and there is at least one).
  readonly allVisibleSelected = computed(() => {
    const vis = this.visibleTodos();
    if (vis.length === 0) return false;
    const sel = this.selectedIds();
    return vis.every((t) => sel.has(t.id));
  });

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
  mainName(id: string | null): string {
    return id ? this.mains().find((m) => m.id === id)?.name ?? '' : '';
  }
  accountName(id: string | null): string {
    return id ? this.bankAccounts().find((a) => a.id === id)?.name ?? '' : '';
  }
  subsOf(mainId: string): Sub[] {
    return this.subs().filter((s) => s.mainId === mainId);
  }
  /** The main a sub belongs to, or null if unknown. */
  mainOfSub(subId: string): string | null {
    return this.subs().find((s) => s.id === subId)?.mainId ?? null;
  }
  /** First main id (default for the required single category). */
  firstMainId(): string { return this.mains()[0]?.id ?? ''; }

  // ---- loading ----
  async loadAll(): Promise<void> {
    await Promise.all([
      this.refreshTodos(), this.refreshCategories(), this.refreshTitleDefaults(),
      this.refreshBankAccounts(), this.refreshSavedQueries(),
    ]);
    if (this.selectedMain() === null) this.selectedMain.set(this.mains()[0]?.id ?? null);
  }
  async refreshTodos(): Promise<void> {
    this.todos.set(await firstValueFrom(this.api.getTodos()));
  }
  async refreshCategories(): Promise<void> {
    const c: Categories = await firstValueFrom(this.api.getCategories());
    this.mains.set(c.mains);
    this.subs.set(c.subs);
    // Default the import main to the first category once one is known / if it vanished.
    if (!this.importMainId() || !c.mains.some((m) => m.id === this.importMainId())) {
      this.importMainId.set(c.mains[0]?.id ?? null);
    }
  }
  async refreshTitleDefaults(): Promise<void> {
    this.titleDefaults.set(await firstValueFrom(this.api.getTitleDefaults()));
  }
  async refreshBankAccounts(): Promise<void> {
    this.bankAccounts.set(await firstValueFrom(this.api.getBankAccounts()));
  }
  async refreshSavedQueries(): Promise<void> {
    this.savedQueries.set(await firstValueFrom(this.api.getSavedQueries()));
  }

  // ---- confirm ----
  private ask(c: Confirm): void { this.confirm.set(c); }
  cancelConfirm(): void { this.confirm.set(null); }
  async runConfirm(): Promise<void> {
    const c = this.confirm();
    if (!c) return;
    this.confirm.set(null);
    await c.run();
  }

  // ---- querying ----
  /** Select a smart-list / category filter, leaving any active query behind. */
  pickFilter(f: Filter): void {
    this.activeQuery.set(null);
    this.appliedQueryId.set(null);
    this.queryDraft.set(emptyQuery());
    this.filter.set(f);
  }
  toggleQueryPanel(): void { this.queryPanelOpen.update((v) => !v); }
  /** Patch the working query; applies live (empty draft falls back to the smart-list filter). */
  patchQuery(patch: Partial<TaskQuery>): void {
    const d = { ...this.queryDraft(), ...patch };
    this.queryDraft.set(d);
    this.appliedQueryId.set(null); // hand-editing detaches from a named saved query
    this.activeQuery.set(isEmptyQuery(d) ? null : d);
  }
  toggleQueryCat(subId: string): void {
    const d = this.queryDraft();
    const has = d.catIds.includes(subId);
    this.patchQuery({ catIds: has ? d.catIds.filter((x) => x !== subId) : [...d.catIds, subId] });
  }
  clearQuery(): void {
    this.queryDraft.set(emptyQuery());
    this.activeQuery.set(null);
    this.appliedQueryId.set(null);
  }
  applySavedQuery(id: string): void {
    const sq = this.savedQueries().find((q) => q.id === id);
    if (!sq) return;
    this.queryDraft.set({ ...sq.query });
    this.activeQuery.set(isEmptyQuery(sq.query) ? null : { ...sq.query });
    this.appliedQueryId.set(id);
  }
  openSaveQuery(): void {
    if (isEmptyQuery(this.queryDraft())) return;
    this.saveQueryError.set(null);
    this.saveQueryName.set('');
  }
  cancelSaveQuery(): void { this.saveQueryName.set(null); }
  async confirmSaveQuery(): Promise<void> {
    const name = (this.saveQueryName() ?? '').trim();
    const q = this.queryDraft();
    if (!name || isEmptyQuery(q)) return;
    this.saveQueryError.set(null);
    try {
      const created = await firstValueFrom(this.api.addSavedQuery(name, q));
      this.saveQueryName.set(null);
      await this.refreshSavedQueries();
      this.appliedQueryId.set(created.id);
    } catch {
      this.saveQueryError.set(this.t('query.error.save', { name }));
    }
  }
  async removeSavedQuery(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteSavedQuery(id));
    if (this.appliedQueryId() === id) this.appliedQueryId.set(null);
    await this.refreshSavedQueries();
  }
  askRemoveSavedQuery(id: string): void {
    const q = this.savedQueries().find((x) => x.id === id);
    const name = q?.name ? `“${q.name}”` : this.t('confirm.thisSavedQuery');
    this.ask({
      title: this.t('confirm.deleteSavedQuery.title'),
      message: this.t('confirm.deleteSavedQuery.message', { name }),
      confirmLabel: this.t('confirm.deleteSavedQuery.confirm'),
      run: () => this.removeSavedQuery(id),
    });
  }

  // ---- selection ----
  isSelected(id: number): boolean { return this.selectedIds().has(id); }
  toggleSelected(id: number): void {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }
  /** Enter selection mode (optionally pre-selecting one task). */
  startSelecting(id?: number): void {
    this.selecting.set(true);
    if (id != null) this.selectedIds.set(new Set([id]));
  }
  /** Leave selection mode and drop any selection. */
  stopSelecting(): void {
    this.selecting.set(false);
    this.selectedIds.set(new Set());
  }
  clearSelection(): void { this.selectedIds.set(new Set()); }
  /** Select all visible tasks, or clear if they're already all selected. */
  toggleSelectAllVisible(): void {
    if (this.allVisibleSelected()) this.selectedIds.set(new Set());
    else this.selectedIds.set(new Set(this.visibleTodos().map((t) => t.id)));
  }
  async removeSelected(): Promise<void> {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    await firstValueFrom(this.api.bulkDeleteTodos(ids));
    this.stopSelecting();
    await this.refreshTodos();
  }
  askRemoveSelected(): void {
    const n = this.selectedIds().size;
    if (n === 0) return;
    if (n === 1) {
      this.ask({
        title: this.t('confirm.deleteTask.title'),
        message: this.t('confirm.deleteTask.message', { name: this.t('confirm.thisTask') }),
        confirmLabel: this.t('confirm.deleteTask.confirm'),
        run: () => this.removeSelected(),
      });
      return;
    }
    this.ask({
      title: this.t('confirm.deleteTasks.title'),
      message: this.t('confirm.deleteTasks.message', { count: n }),
      confirmLabel: this.t('confirm.deleteTasks.confirm', { count: n }),
      run: () => this.removeSelected(),
    });
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
  askRemove(id: number): void {
    const t = this.todos().find((x) => x.id === id);
    const name = t?.title.trim() ? `“${t.title.trim()}”` : this.t('confirm.thisTask');
    this.ask({
      title: this.t('confirm.deleteTask.title'),
      message: this.t('confirm.deleteTask.message', { name }),
      confirmLabel: this.t('confirm.deleteTask.confirm'),
      run: () => this.remove(id),
    });
  }
  askDeleteFromDialog(): void {
    const d = this.taskDialog();
    const name = d?.title.trim() ? `“${d.title.trim()}”` : this.t('confirm.thisTask');
    this.ask({
      title: this.t('confirm.deleteTask.title'),
      message: this.t('confirm.deleteTask.message', { name }),
      confirmLabel: this.t('confirm.deleteTask.confirm'),
      run: () => this.deleteFromDialog(),
    });
  }

  private inheritedCatIds(): string[] {
    const f = this.filter();
    return isSmart(f) ? [] : [f];
  }
  /** Default main when creating a task: the filtered sub's main, else the first main. */
  private inheritedMainId(): string {
    const f = this.filter();
    return (!isSmart(f) && this.mainOfSub(f)) || this.firstMainId();
  }

  async addQuick(): Promise<void> {
    const title = this.quickAdd().trim();
    if (!title) return;
    await firstValueFrom(this.api.createTodo({
      title, due: null, amount: null, dateKind: 'due',
      mainId: this.inheritedMainId(), catIds: this.inheritedCatIds(), bankAccountId: null, note: null,
    }));
    this.quickAdd.set('');
    await this.refreshTodos();
  }

  openNew(): void {
    const due = this.filter() === 'today' ? toISO(startOfToday()) : null;
    const catIds = this.inheritedCatIds();
    this.expandedMains.set(this.mainsWithSelection(catIds));
    this.taskDialog.set({
      id: null, title: '', due, mainId: this.inheritedMainId(), catIds, amountStr: '', dateKind: 'due',
      bankAccountId: null, note: '',
    });
  }
  openEdit(id: number): void {
    const t = this.todos().find((x) => x.id === id);
    if (!t) return;
    this.expandedMains.set(this.mainsWithSelection(t.catIds));
    this.taskDialog.set({
      id, title: t.title, due: t.due, mainId: t.mainId || this.firstMainId(), catIds: [...t.catIds],
      amountStr: t.amount == null ? '' : String(t.amount), dateKind: t.dateKind ?? 'due',
      bankAccountId: t.bankAccountId, note: t.note ?? '',
    });
  }
  isMainExpanded(id: string): boolean { return this.expandedMains().has(id); }
  toggleMainExpand(id: string): void {
    const next = new Set(this.expandedMains());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.expandedMains.set(next);
  }
  private mainsWithSelection(catIds: string[]): Set<string> {
    return new Set(this.subs().filter((s) => catIds.includes(s.id)).map((s) => s.mainId));
  }
  updateDialog(patch: Partial<TaskDraft>): void {
    const d = this.taskDialog();
    if (d) this.taskDialog.set({ ...d, ...patch });
  }
  /** Select the required single main category (radio behaviour). */
  setDraftMain(mainId: string): void {
    this.updateDialog({ mainId });
  }
  toggleDraftCat(subId: string): void {
    const d = this.taskDialog();
    if (!d) return;
    const has = d.catIds.includes(subId);
    this.updateDialog({ catIds: has ? d.catIds.filter((x) => x !== subId) : [...d.catIds, subId] });
  }
  async saveTask(): Promise<void> {
    const d = this.taskDialog();
    if (!d || !d.title.trim() || !d.mainId) return;
    const parsed = d.amountStr.trim() !== '' ? parseFloat(d.amountStr) : NaN;
    const amount = Number.isNaN(parsed) ? null : parsed;
    const note = d.note.trim() || null;
    const body = {
      title: d.title.trim(), due: d.due, amount, dateKind: d.dateKind,
      mainId: d.mainId, catIds: d.catIds, bankAccountId: d.bankAccountId, note,
    };
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
    this.catError.set(null);
    try {
      await firstValueFrom(this.api.deleteMain(id));
    } catch {
      // Blocked (409) when the main is still a task's required category.
      this.catError.set(this.t('cat.error.mainInUse'));
      return;
    }
    if (this.filter() === id) this.filter.set('all');
    await Promise.all([this.refreshCategories(), this.refreshTodos()]);
    if (this.selectedMain() === id) this.selectedMain.set(this.mains()[0]?.id ?? null);
  }
  askRemoveMain(id: string): void {
    const m = this.mains().find((x) => x.id === id);
    const name = m?.name ? `“${m.name}”` : this.t('confirm.thisCategory');
    const subCount = this.subsOf(id).length;
    const note = subCount === 0 ? ''
      : this.t(subCount === 1 ? 'confirm.deleteMain.noteOne' : 'confirm.deleteMain.noteMany', { count: subCount });
    this.ask({
      title: this.t('confirm.deleteMain.title'),
      message: this.t('confirm.deleteMain.message', { name, note }),
      confirmLabel: this.t('confirm.deleteMain.confirm'),
      run: () => this.removeMain(id),
    });
  }
  async removeSub(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteSub(id));
    if (this.filter() === id) this.filter.set('all');
    await Promise.all([this.refreshCategories(), this.refreshTodos(), this.refreshTitleDefaults()]);
  }
  askRemoveSub(id: string): void {
    const s = this.subs().find((x) => x.id === id);
    const name = s?.name ? `“${s.name}”` : this.t('confirm.thisSubCategory');
    const note = s && s.taskCount > 0
      ? this.t(s.taskCount === 1 ? 'confirm.deleteSub.noteOne' : 'confirm.deleteSub.noteMany', { count: s.taskCount })
      : '';
    this.ask({
      title: this.t('confirm.deleteSub.title'),
      message: this.t('confirm.deleteSub.message', { name, note }),
      confirmLabel: this.t('confirm.deleteSub.confirm'),
      run: () => this.removeSub(id),
    });
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
  /** Appends parsed rows (each already `date\ttitle\tamount`) to the import text box. */
  appendImportRows(rows: string[]): void {
    if (rows.length === 0) return;
    const cur = this.importText();
    const sep = cur && !cur.endsWith('\n') ? '\n' : '';
    this.importText.set(cur + sep + rows.join('\n'));
  }
  async parseImport(): Promise<void> {
    const rows = await firstValueFrom(this.api.parseImport(this.importText()));
    // Each row needs a main: keep any remembered from a title default, else the batch default.
    const def = this.importMainId() ?? this.firstMainId();
    this.importRows.set(rows.map((r) => ({ ...r, mainId: r.mainId ?? def, note: r.note ?? '' })));
  }
  /** Set the batch default main and apply it to every parsed row. */
  setImportMain(mainId: string | null): void {
    this.importMainId.set(mainId);
    const rows = this.importRows();
    if (mainId && rows) this.importRows.set(rows.map((r) => ({ ...r, mainId })));
  }
  async commitImport(): Promise<void> {
    const rows = (this.importRows() ?? []).filter((r) => r.ok);
    if (!rows.length) return;
    const bankAccountId = this.importAccountId();
    const fallback = this.importMainId() ?? this.firstMainId();
    const body: ImportCommitRow[] = rows.map((r) => ({
      title: r.title, date: r.date, amount: r.amount,
      mainId: r.mainId ?? fallback, catIds: r.catIds, bankAccountId,
      note: (r.note ?? '').trim() || null,
    }));
    await firstValueFrom(this.api.commitImport(body));
    this.importText.set('');
    this.importRows.set(null);
    this.filter.set('all');
    // Imported tasks now use this account, so refresh usage counts too.
    await Promise.all([this.refreshTodos(), this.refreshBankAccounts()]);
  }

  // ---- bank accounts ----
  /** Adds a new bank account and selects it for import. */
  async addBankAccount(): Promise<void> {
    const name = this.newBankAccount().trim();
    if (!name) return;
    this.bankAccountError.set(null);
    try {
      const created = await firstValueFrom(this.api.addBankAccount(name));
      this.newBankAccount.set('');
      await this.refreshBankAccounts();
      this.importAccountId.set(created.id);
    } catch {
      this.bankAccountError.set(this.t('bank.error.add', { name }));
    }
  }
  /** Deletes a bank account. Only unused accounts can be removed (enforced by the API). */
  async removeBankAccount(id: string): Promise<void> {
    this.bankAccountError.set(null);
    try {
      await firstValueFrom(this.api.deleteBankAccount(id));
      if (this.importAccountId() === id) this.importAccountId.set(null);
      await this.refreshBankAccounts();
    } catch {
      this.bankAccountError.set(this.t('bank.error.delete'));
    }
  }
  openImportCat(key: number): void {
    const r = (this.importRows() ?? []).find((x) => x.key === key);
    if (!r) return;
    const norm = r.title.trim().toLowerCase();
    this.importCat.set({
      key, title: r.title, match: r.title,
      mainId: r.mainId || this.importMainId() || this.firstMainId(),
      catIds: [...(r.catIds ?? [])], note: r.note ?? '', applyAll: false,
      remember: this.titleDefaults().some((d) => d.normalizedTitle === norm),
    });
  }
  /** Narrow the "apply to all" match to a selected part of the title (empty resets to the full title). */
  setImportCatMatch(text: string): void {
    const c = this.importCat();
    if (!c) return;
    const m = text.trim();
    this.importCat.set({ ...c, match: m || c.title });
  }
  /** Select the required single main category for the import row (radio behaviour). */
  setImportCatMain(mainId: string): void {
    const c = this.importCat();
    if (c) this.importCat.set({ ...c, mainId });
  }
  setImportCatNote(note: string): void {
    const c = this.importCat();
    if (c) this.importCat.set({ ...c, note });
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
    if (!c || !c.mainId) return;
    const norm = c.title.trim().toLowerCase();
    const match = c.match.trim().toLowerCase();
    // Apply the main + subs + note to this row (and rows whose title contains the match, if requested).
    this.importRows.set((this.importRows() ?? []).map((r) =>
      r.key === c.key || (c.applyAll && match !== '' && r.title.trim().toLowerCase().includes(match))
        ? { ...r, mainId: c.mainId, catIds: [...c.catIds], note: c.note } : r));
    // Close now: the row change above is applied, so persistence below must not gate the dialog.
    this.importCat.set(null);
    // Persist / clear the remembered default (main + subs).
    if (c.remember) await firstValueFrom(this.api.putTitleDefault(norm, c.catIds, c.mainId));
    else await firstValueFrom(this.api.deleteTitleDefault(norm));
    await this.refreshTitleDefaults();
  }

  // ---- reports ----
  async loadReport(): Promise<void> {
    this.report.set(await firstValueFrom(
      this.api.getReport(this.repStart(), this.repEnd(), this.repSel(), this.repMode())));
  }
  allSubIds(): string[] { return this.subs().map((s) => s.id); }
  /** Every selectable id in the current grain, plus the "uncategorized" pseudo-id. */
  private repUniverse(): string[] {
    const ids = this.repMode() === 'main'
      ? this.mains().map((m) => m.id)
      : this.allSubIds();
    return [...ids, '__none__'];
  }
  /** Toggle a single main/sub id in the current grain. */
  repToggle(id: string): void {
    const cur = this.repSel() == null ? [...this.repUniverse()] : [...this.repSel()!];
    const i = cur.indexOf(id);
    if (i >= 0) cur.splice(i, 1); else cur.push(id);
    this.repSel.set(cur);
    void this.loadReport();
  }
  /** Switch selection grain; resets to "all" since ids live in different namespaces. */
  setRepMode(mode: 'main' | 'sub'): void {
    if (this.repMode() === mode) return;
    this.repMode.set(mode);
    this.repSel.set(null);
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
