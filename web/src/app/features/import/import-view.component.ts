import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { BankAccount, ImportRow } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { fmtMoney } from '../../core/money-util';
import { BANK_FILE_TYPES, BankFileType, parseBankFile } from '../../core/bank-import';

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
                <option [value]="m.id">{{ m.name }}</option>
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
            <label class="file-label">{{ store.t('import.importFile') }}
              <select class="input file-type" [value]="fileType()" (change)="fileType.set(selectValue($event))">
                @for (t of fileTypes; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </label>
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
            <div class="table">
              <div class="thead">
                <span>{{ store.t('import.colTitle') }}</span><span>{{ store.t('import.colDate') }}</span><span>{{ store.t('import.colAmount') }}</span>
              </div>
              @for (r of store.importRows(); track r.key) {
                <div class="trow rule-1" [style.opacity]="r.ok ? 1 : 0.45">
                  <div class="cells">
                    <span class="t-title" [title]="r.title">{{ r.title }}</span>
                    <span class="t-date">{{ r.date ?? '—' }}</span>
                    <span class="t-amount" [style.color]="amountColor(r)">{{ amountLabel(r) }}</span>
                  </div>
                  <div class="row-cats">
                    <button class="cat-edit" (click)="store.openImportCat(r.key)">{{ store.t('import.editCategories') }}</button>
                    @if (r.amount != null) {
                      <button class="cat-edit" (click)="store.openImportSplit(r.key)">{{ store.t('import.split') }}</button>
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
            </div>
            <div class="foot">
              <span class="ready">{{ store.t('import.rowsReady', { ok: okCount(), total: store.importRows()!.length }) }}</span>
              <button class="btn btn-primary" [disabled]="okCount() === 0" (click)="commit()">{{ store.t('import.importAsTasks') }}</button>
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
    .file-type { width: auto; padding: 6px 10px; }
    .file-error { color: var(--color-danger); font-size: 12px; }
    .help { color: var(--muted); font-size: 12px; margin-top: 12px; }
    .empty-box {
      border: 1px dashed var(--color-divider); padding: 40px 24px; text-align: center;
      color: var(--muted); font-family: var(--font-mono); font-size: 13px; line-height: 1.6;
    }
    .table { border: 1px solid var(--color-divider); }
    .thead, .cells { display: grid; grid-template-columns: 1fr 92px 96px; gap: 10px; align-items: center; }
    .thead { padding: 10px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); border-bottom: 2px solid var(--color-divider); }
    .trow { padding: 10px; }
    .t-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
    .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
    .ready { font-family: var(--font-mono); font-size: 13px; color: var(--muted); }
  `],
})
export class ImportViewComponent {
  store = inject(TaskStore);
  private router = inject(Router);

  readonly fileTypes = BANK_FILE_TYPES;
  readonly fileType = signal<BankFileType>(BANK_FILE_TYPES[0]);
  readonly fileError = signal<string | null>(null);

  readonly selectedAccount = computed<BankAccount | null>(() =>
    this.store.bankAccounts().find((a) => a.id === this.store.importAccountId()) ?? null);
  selectAccount(e: Event): string | null { return (e.target as HTMLSelectElement).value || null; }

  async commit(): Promise<void> {
    await this.store.commitImport();
    void this.router.navigate(['/tasks']); // jump to Tasks view, like the prototype
  }

  async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    this.fileError.set(null);
    if (!file) return;
    try {
      const rows = parseBankFile(this.fileType(), await file.text());
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

  selectValue(e: Event): BankFileType { return (e.target as HTMLSelectElement).value as BankFileType; }
  selectValueStr(e: Event): string { return (e.target as HTMLSelectElement).value; }
  value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }
  amountLabel(r: ImportRow): string { return r.amount != null ? fmtMoney(r.amount) : this.store.t('import.amountNone'); }
  amountColor(r: ImportRow): string {
    return r.amount == null ? 'var(--muted-strong)' : r.amount >= 0 ? 'var(--color-income)' : 'var(--color-danger)';
  }
  isDefault(r: ImportRow): boolean {
    const norm = r.title.trim().toLowerCase();
    return this.store.titleDefaults().some((d) => d.normalizedTitle === norm);
  }
  okCount = computed(() => (this.store.importRows() ?? []).filter((r) => r.ok).length);
}
