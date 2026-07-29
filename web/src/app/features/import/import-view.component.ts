import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { BankAccount, ImportRow } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { fmtMoney } from '../../core/money-util';
import { decodeBankFile, detectBankFileType, parseBankFile } from '../../core/bank-import';

// Preview filter on whether a row already carries subcategories.
type SubFilter = 'any' | 'has' | 'none';
// Preview filter on whether a saved task already covers the row.
type DupFilter = 'any' | 'only' | 'none';

@Component({
  selector: 'app-import-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="view">
      <header class="head">
        <h1 class="view-title">{{ store.t('import.title') }}</h1>
        <div class="view-sub">{{ store.t('import.sub') }}</div>
      </header>

      <div class="cols">
        <!-- paste -->
        <section class="col">
          <div class="kicker col-kicker">{{ store.t('import.pasteTransactions') }}</div>
          <div class="acct-field">
            <span class="acct-label">{{ store.t('import.mainCategory') }}</span>
            <select class="input acct-select" [value]="store.importMainId() ?? ''"
                    (change)="store.setImportMain(selectValueStr($event) || null)">
              @for (m of store.mains(); track m.id) {
                <option [value]="m.id" [selected]="m.id === store.importMainId()">{{ m.name }}</option>
              }
            </select>
            <span class="acct-hint">{{ store.t('import.mainCategoryHint') }}</span>
          </div>
          <div class="acct-field">
            <span class="acct-label">{{ store.t('import.bankAccount') }}</span>
            <div class="acct-row">
              <select class="input acct-select" [value]="store.importAccountId() ?? ''"
                      (change)="store.importAccountId.set(selectAccount($event))">
                <option value="">{{ store.t('import.none') }}</option>
                @for (a of store.bankAccounts(); track a.id) {
                  <option [value]="a.id">{{ a.name }}</option>
                }
              </select>
              @if (selectedAccount(); as a) {
                <button class="btn btn-ghost acct-del" [disabled]="a.taskCount > 0"
                        [title]="a.taskCount > 0
                          ? store.t(a.taskCount === 1 ? 'import.accountUsedOne' : 'import.accountUsedMany', { count: a.taskCount })
                          : store.t('import.deleteAccount')"
                        (click)="store.removeBankAccount(a.id)">{{ store.t('import.delete') }}</button>
              }
            </div>
            <div class="acct-add">
              <input class="input acct-new" type="text" [placeholder]="store.t('import.addAccountPlaceholder')"
                     [value]="store.newBankAccount()" (input)="store.newBankAccount.set(value($event))"
                     (keyup.enter)="store.addBankAccount()">
              <button class="btn btn-secondary" [disabled]="!store.newBankAccount().trim()"
                      (click)="store.addBankAccount()">{{ store.t('import.add') }}</button>
            </div>
            @if (store.bankAccountError(); as e) { <span class="file-error">{{ e }}</span> }
          </div>
          <div class="file-import">
            <span class="file-label">{{ store.t('import.importFile') }}</span>
            <input #fileInput type="file" accept=".csv,text/csv" hidden (change)="onFile($event)" />
            <button class="btn btn-secondary" (click)="fileInput.click()">{{ store.t('import.chooseFile') }}</button>
            @if (fileError()) { <span class="file-error">{{ fileError() }}</span> }
          </div>
          <textarea class="input paste" placeholder="2026-07-15    ACME CORP PAYROLL    +4200.00"
                    [value]="store.importText()" (input)="store.importText.set(value($event))"></textarea>
          <div class="buttons">
            <button class="btn btn-primary" [disabled]="!store.importText().trim()" (click)="store.parseImport()">{{ store.t('import.parseRows') }}</button>
            <button class="btn btn-secondary" (click)="store.loadSampleImport()">{{ store.t('import.loadSample') }}</button>
            <button class="btn btn-ghost" (click)="store.clearImport()">{{ store.t('import.clear') }}</button>
          </div>
          <p class="help">{{ store.t('import.help') }}</p>
        </section>

        <!-- preview -->
        <section class="col">
          <div class="kicker col-kicker">{{ store.t('import.preview') }}</div>
          @if (store.importRows() === null) {
            <div class="empty-box">{{ store.t('import.nothingParsedBefore') }}<b>{{ store.t('import.parseRows') }}</b>{{ store.t('import.nothingParsedAfter') }}</div>
          } @else {
            <div class="filters">
              <input class="input filter" type="text" [placeholder]="store.t('import.filterTitle')"
                     [value]="titleFilter()" (input)="titleFilter.set(value($event))" />
              <div class="seg filter-seg">
                @for (o of subFilterOptions; track o.value) {
                  <button type="button" class="seg-opt" [class.active]="subFilter() === o.value"
                          (click)="subFilter.set(o.value)">{{ store.t(o.label) }}</button>
                }
              </div>
              <div class="seg filter-seg">
                @for (o of dupFilterOptions; track o.value) {
                  <button type="button" class="seg-opt" [class.active]="dupFilter() === o.value"
                          (click)="dupFilter.set(o.value)">{{ store.t(o.label) }}</button>
                }
              </div>
              @if (dupCount() > 0) {
                <span class="tag tag-warn" [title]="store.t('import.duplicateHint')">
                  <app-icon name="alert-triangle" [size]="11" />
                  {{ store.t('import.duplicateCount', { count: dupCount() }) }}
                </span>
              }
            </div>
            <div class="table">
              <div class="thead">
                <input type="checkbox" class="sel-box" [title]="store.t('import.selectAll')"
                       [checked]="allVisibleSelected()" [indeterminate]="someVisibleSelected()"
                       [disabled]="visibleOkCount() === 0" (change)="setAllVisibleSelected(checked($event))" />
                <button type="button" class="sort-h" [class.active]="sortCol() === 'title'" (click)="toggleSort('title')">
                  {{ store.t('import.colTitle') }}<span class="sort-caret">{{ sortCaret('title') }}</span>
                </button>
                <button type="button" class="sort-h" [class.active]="sortCol() === 'date'" (click)="toggleSort('date')">
                  {{ store.t('import.colDate') }}<span class="sort-caret">{{ sortCaret('date') }}</span>
                </button>
                <button type="button" class="sort-h sort-h-end" [class.active]="sortCol() === 'amount'" (click)="toggleSort('amount')">
                  {{ store.t('import.colAmount') }}<span class="sort-caret">{{ sortCaret('amount') }}</span>
                </button>
                <span></span>
              </div>
              @for (r of filteredRows(); track r.key) {
                <div class="trow rule-1" [class.dup]="isDuplicate(r)"
                     [style.opacity]="r.ok ? (isSelected(r) ? 1 : 0.5) : 0.45">
                  <div class="cells">
                    <input type="checkbox" class="sel-box" [checked]="isSelected(r)" [disabled]="!r.ok"
                           [title]="store.t('import.selectRow')" (change)="store.toggleImportSelected(r.key)" />
                    <span class="t-title" [title]="r.title">{{ r.title }}</span>
                    <span class="t-date">{{ r.date ?? '—' }}</span>
                    <span class="t-amount" [style.color]="amountColor(r)">{{ amountLabel(r) }}</span>
                    <button type="button" class="btn-icon danger row-del" [title]="store.t('import.removeRow')"
                            (click)="store.removeImportRows([r.key])">
                      <app-icon name="trash" [size]="13" />
                    </button>
                  </div>
                  <div class="row-cats">
                    <button class="cat-edit" (click)="store.openImportCat(r.key)">{{ store.t('import.editCategories') }}</button>
                    @if (r.amount != null) {
                      <button class="cat-edit" (click)="store.openImportSplit(r.key)">{{ store.t('import.split') }}</button>
                    }
                    @if (isDuplicate(r)) {
                      <span class="tag tag-warn" [title]="store.t('import.duplicateHint')">
                        <app-icon name="alert-triangle" [size]="11" /> {{ store.t('import.duplicate') }}
                      </span>
                    }
                    @if (store.mainName(r.mainId); as mn) { <span class="tag tag-main">{{ mn }}</span> }
                    @for (id of r.catIds; track id) {
                      @if (store.subName(id); as n) { <span class="tag tag-neutral">{{ n }}</span> }
                    }
                    @if (isDefault(r)) { <span class="saved"><app-icon name="star" [size]="12" /> {{ store.t('import.saved') }}</span> }
                  </div>
                  @if (r.note) { <div class="row-note">{{ r.note }}</div> }
                </div>
              }
              @if (filterHidesEverything()) {
                <div class="filter-empty">
                  @if (titleFilter().trim()) {
                    {{ store.t('import.filterNoMatch', { query: titleFilter().trim() }) }}
                  } @else {
                    {{ store.t('import.filterNoMatchFilters') }}
                  }
                </div>
              }
            </div>
            <div class="foot">
              <span class="ready">{{ store.t('import.rowsSelected', { selected: selectedCount(), ok: okCount() }) }}</span>
              <div class="foot-actions">
                <button class="btn btn-ghost foot-del" [disabled]="selectedCount() === 0"
                        [title]="store.t('import.deleteSelectedHint')" (click)="deleteSelected()">
                  <app-icon name="trash" [size]="14" /> {{ store.t('import.deleteSelected') }}
                </button>
                <button class="btn btn-ghost" [disabled]="rowCount() === 0"
                        [title]="store.t('import.clearPreviewHint')" (click)="store.clearImportPreview()">
                  <app-icon name="x" [size]="14" /> {{ store.t('import.clearPreview') }}
                </button>
                <button class="btn btn-primary" [disabled]="selectedCount() === 0" (click)="commit()">{{ store.t('import.importSelected', { count: selectedCount() }) }}</button>
              </div>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .view { display: flex; flex-direction: column; height: 100%; }
    .head { padding: 24px 24px 16px; }
    .cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 4px 24px 24px; overflow-y: auto; }
    .col-kicker { margin-bottom: 12px; }
    .paste { height: 300px; resize: vertical; font-family: var(--font-mono); font-size: 13px; line-height: 1.5; }
    .buttons { display: flex; gap: 10px; margin-top: 14px; }
    .acct-field { display: block; margin-bottom: 12px; }
    .acct-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .acct-hint { display: block; font-size: 11px; color: var(--muted-strong); margin-top: 6px; }
    .tag-main { background: color-mix(in srgb, var(--color-accent) 14%, transparent); color: var(--color-accent); }
    .acct-row { display: flex; align-items: center; gap: 8px; }
    .acct-select { max-width: 280px; }
    .acct-del { padding: 6px 12px; font-size: 12px; color: var(--muted); }
    .acct-del:not(:disabled):hover { color: var(--color-danger); }
    .acct-del:disabled { opacity: 0.4; cursor: not-allowed; }
    .acct-add { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .acct-new { max-width: 210px; }
    .file-import { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .file-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
    .file-error { color: var(--color-danger); font-size: 12px; }
    .help { color: var(--muted); font-size: 12px; margin-top: 12px; }
    .empty-box {
      border: 1px dashed var(--color-divider); padding: 40px 24px; text-align: center;
      color: var(--muted); font-family: var(--font-mono); font-size: 13px; line-height: 1.6;
    }
    .filters { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
    .filter { flex: 1 1 180px; min-width: 0; }
    .filter-seg { flex: 0 0 auto; }
    .filter-seg .seg-opt { font-size: 11px; padding: 7px 10px; }
    .filter-empty { padding: 24px; text-align: center; color: var(--muted); font-family: var(--font-mono); font-size: 12px; }
    .table { border: 1px solid var(--color-divider); }
    .thead, .cells { display: grid; grid-template-columns: 20px 1fr 92px 96px 22px; gap: 10px; align-items: center; }
    .sel-box { width: 15px; height: 15px; margin: 0; cursor: pointer; accent-color: var(--color-accent); }
    .sel-box:disabled { cursor: not-allowed; }
    .thead { padding: 10px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); border-bottom: 2px solid var(--color-divider); }
    .sort-h {
      display: inline-flex; align-items: center; gap: 4px; padding: 0; min-width: 0;
      background: transparent; border: 0; cursor: pointer;
      font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; text-align: left;
    }
    .sort-h:hover { color: var(--color-text); }
    .sort-h.active { color: var(--color-text); }
    .sort-h-end { justify-self: end; text-align: right; }
    .sort-caret { font-size: 9px; opacity: 0.7; }
    .trow { padding: 10px; }
    /* Rows a saved task already covers get an amber edge so they read as flagged at a glance. */
    .trow.dup { border-left: 2px solid var(--color-amber); padding-left: 8px; }
    .t-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-del { width: 20px; height: 20px; }
    .t-date { font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    .t-amount { font-family: var(--font-mono); font-size: 13px; font-weight: 700; text-align: right; }
    .row-cats { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .row-note { margin-top: 6px; font-size: 12px; line-height: 1.4; color: var(--muted); white-space: pre-wrap; }
    .cat-edit {
      border: 1px dashed var(--color-divider); background: transparent; color: var(--muted);
      font-size: 11px; padding: 3px 8px; cursor: pointer;
    }
    .cat-edit:hover { color: var(--color-text); }
    .saved { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 11px; color: var(--color-accent); }
    /* The action group wraps to its own line rather than squeezing the count onto two. */
    .foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .foot-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .foot-del:not(:disabled):hover { color: var(--color-danger); }
    .ready { font-family: var(--font-mono); font-size: 13px; color: var(--muted); white-space: nowrap; }

    @media (max-width: 760px) {
      .head { padding: 16px 16px 12px; }
      /* Paste and preview panels stack vertically on narrow screens. */
      .cols { grid-template-columns: 1fr; gap: 20px; padding: 4px 16px 24px; }
      .acct-select, .acct-new { max-width: none; }
      /* Let the subcategory filter drop below the title box rather than squeeze it. */
      .filter { flex-basis: 100%; }
      .buttons { flex-wrap: wrap; }
      .foot { flex-wrap: wrap; gap: 10px; }
      .foot-actions { flex: 1 1 100%; flex-wrap: wrap; }
      .foot .btn { flex: 1 1 auto; justify-content: center; }
    }
    @media (max-width: 420px) {
      /* Tighten fixed columns so the title keeps usable width on the smallest screens. */
      .thead, .cells { grid-template-columns: 16px 1fr 66px 74px 20px; gap: 6px; }
      .t-date, .t-amount { font-size: 11px; }
    }
  `],
})
export class ImportViewComponent {
  store = inject(TaskStore);
  private router = inject(Router);

  readonly fileError = signal<string | null>(null);

  readonly sortCol = signal<'title' | 'date' | 'amount' | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly titleFilter = signal('');

  readonly subFilterOptions = [
    { value: 'any', label: 'import.filterSubAny' },
    { value: 'has', label: 'import.filterSubHas' },
    { value: 'none', label: 'import.filterSubNone' },
  ] as const;
  readonly subFilter = signal<SubFilter>('any');

  readonly dupFilterOptions = [
    { value: 'any', label: 'import.filterDupAny' },
    { value: 'only', label: 'import.filterDupOnly' },
    { value: 'none', label: 'import.filterDupNone' },
  ] as const;
  readonly dupFilter = signal<DupFilter>('any');

  readonly sortedRows = computed<ImportRow[]>(() => {
    const rows = this.store.importRows() ?? [];
    const col = this.sortCol();
    if (!col) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (col === 'title') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * dir;
      }
      if (col === 'date') {
        return this.nullCmp(a.date, b.date, dir, (x, y) => x.localeCompare(y));
      }
      return this.nullCmp(a.amount, b.amount, dir, (x, y) => x - y);
    });
  });

  // Preview rows narrowed by the title text, the has/no-subcategory filter and the duplicate filter.
  readonly filteredRows = computed<ImportRow[]>(() => {
    const q = this.titleFilter().trim().toLowerCase();
    const sub = this.subFilter();
    const dup = this.dupFilter();
    let rows = this.sortedRows();
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    if (sub !== 'any') rows = rows.filter((r) => (r.catIds.length > 0) === (sub === 'has'));
    if (dup !== 'any') {
      const dups = this.store.importDuplicates();
      rows = rows.filter((r) => dups.has(r.key) === (dup === 'only'));
    }
    return rows;
  });

  // True when rows were parsed but every one of them is hidden by the active filters.
  readonly filterHidesEverything = computed(() =>
    this.sortedRows().length > 0 && this.filteredRows().length === 0);

  // Compares two values, keeping empty (null) values last regardless of sort direction.
  private nullCmp<T>(a: T | null, b: T | null, dir: number, cmp: (x: T, y: T) => number): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return cmp(a, b) * dir;
  }

  toggleSort(col: 'title' | 'date' | 'amount'): void {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
  }

  sortCaret(col: 'title' | 'date' | 'amount'): string {
    if (this.sortCol() !== col) return '';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  readonly selectedAccount = computed<BankAccount | null>(() =>
    this.store.bankAccounts().find((a) => a.id === this.store.importAccountId()) ?? null);
  selectAccount(e: Event): string | null { return (e.target as HTMLSelectElement).value || null; }

  async commit(): Promise<void> {
    const done = await this.store.commitImport();
    // Only leave the import view once nothing is left; otherwise stay to finish the rest.
    if (done) void this.router.navigate(['/tasks']);
  }

  async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    this.fileError.set(null);
    if (!file) return;
    try {
      // The bank is read off the file's header row — each one needs its own decoding.
      const bytes = await file.arrayBuffer();
      const type = detectBankFileType(bytes);
      if (type === null) {
        this.fileError.set(this.store.t('import.fileUnknownFormat', { name: file.name }));
        return;
      }
      const rows = parseBankFile(type, decodeBankFile(type, bytes));
      if (rows.length === 0) {
        this.fileError.set(this.store.t('import.fileNoRows', { name: file.name }));
      } else {
        this.store.appendImportRows(rows);
      }
    } catch {
      this.fileError.set(this.store.t('import.fileReadError', { name: file.name }));
    } finally {
      input.value = ''; // let the same file be re-selected
    }
  }

  selectValueStr(e: Event): string { return (e.target as HTMLSelectElement).value; }
  checked(e: Event): boolean { return (e.target as HTMLInputElement).checked; }
  value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }
  isSelected(r: ImportRow): boolean { return this.store.importSelected().has(r.key); }
  isDuplicate(r: ImportRow): boolean { return this.store.importDuplicates().has(r.key); }
  dupCount = computed(() => this.store.importDuplicates().size);
  amountLabel(r: ImportRow): string { return r.amount != null ? fmtMoney(r.amount) : this.store.t('import.amountNone'); }
  amountColor(r: ImportRow): string {
    return r.amount == null ? 'var(--muted-strong)' : r.amount >= 0 ? 'var(--color-income)' : 'var(--color-danger)';
  }
  isDefault(r: ImportRow): boolean {
    const norm = r.title.trim().toLowerCase();
    return this.store.titleDefaults().some((d) => d.normalizedTitle && norm.includes(d.normalizedTitle));
  }
  rowCount = computed(() => (this.store.importRows() ?? []).length);
  okCount = computed(() => (this.store.importRows() ?? []).filter((r) => r.ok).length);
  selectedCount = computed(() =>
    (this.store.importRows() ?? []).filter((r) => r.ok && this.store.importSelected().has(r.key)).length);

  // Drops the whole selection — including rows the filters currently hide — the same set
  // "Import selected" would act on. Nothing is saved yet, so no confirmation is needed.
  deleteSelected(): void {
    this.store.removeImportRows(this.store.importSelected());
  }

  // Importable rows currently shown under the title filter — what select-all acts on.
  private visibleOkRows = computed<ImportRow[]>(() => this.filteredRows().filter((r) => r.ok));
  visibleOkCount = computed(() => this.visibleOkRows().length);
  private visibleSelectedCount = computed(() => {
    const sel = this.store.importSelected();
    return this.visibleOkRows().filter((r) => sel.has(r.key)).length;
  });
  // Header checkbox: ticked when every shown importable row is picked, dashed when only some are.
  allVisibleSelected = computed(() => this.visibleOkCount() > 0 && this.visibleSelectedCount() === this.visibleOkCount());
  someVisibleSelected = computed(() => this.visibleSelectedCount() > 0 && this.visibleSelectedCount() < this.visibleOkCount());

  // Select-all toggles only the rows currently shown by the filter, leaving hidden rows untouched.
  setAllVisibleSelected(on: boolean): void {
    this.store.setImportSelected(this.visibleOkRows().map((r) => r.key), on);
  }
}
