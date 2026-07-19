import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TaskStore } from '../../core/task.store';
import { ImportRow } from '../../models';
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
        <h1 class="view-title">Import bank file</h1>
        <div class="view-sub">Paste a statement — one transaction per line. Each row becomes a task.</div>
      </header>

      <div class="cols">
        <!-- paste -->
        <section class="col">
          <div class="kicker col-kicker">Paste transactions</div>
          <textarea class="input paste" placeholder="2026-07-15    ACME CORP PAYROLL    +4200.00"
                    [value]="store.importText()" (input)="store.importText.set(value($event))"></textarea>
          <div class="buttons">
            <button class="btn btn-primary" [disabled]="!store.importText().trim()" (click)="store.parseImport()">Parse rows</button>
            <button class="btn btn-secondary" (click)="store.loadSampleImport()">Load sample</button>
            <button class="btn btn-ghost" (click)="store.clearImport()">Clear</button>
          </div>
          <div class="file-import">
            <label class="file-label">Import file
              <select class="input file-type" [value]="fileType()" (change)="fileType.set(selectValue($event))">
                @for (t of fileTypes; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </label>
            <input #fileInput type="file" accept=".csv,text/csv" hidden (change)="onFile($event)" />
            <button class="btn btn-secondary" (click)="fileInput.click()">Choose file…</button>
            @if (fileError()) { <span class="file-error">{{ fileError() }}</span> }
          </div>
          <p class="help">Dates and amounts are auto-detected (currency symbols, +/- signs and thousands separators are handled). Importing a file appends its rows to the box above.</p>
        </section>

        <!-- preview -->
        <section class="col">
          <div class="kicker col-kicker">Preview</div>
          @if (store.importRows() === null) {
            <div class="empty-box">Nothing parsed yet. Paste some lines (or load the sample) and hit <b>Parse rows</b>.</div>
          } @else {
            <div class="table">
              <div class="thead">
                <span>Title</span><span>Date</span><span>Amount</span>
              </div>
              @for (r of store.importRows(); track r.key) {
                <div class="trow rule-1" [style.opacity]="r.ok ? 1 : 0.45">
                  <div class="cells">
                    <span class="t-title" [title]="r.title">{{ r.title }}</span>
                    <span class="t-date">{{ r.date ?? '—' }}</span>
                    <span class="t-amount" [style.color]="amountColor(r)">{{ amountLabel(r) }}</span>
                  </div>
                  <div class="row-cats">
                    <button class="cat-edit" (click)="store.openImportCat(r.key)">{{ r.catIds.length ? 'Edit categories' : '+ categories' }}</button>
                    @for (id of r.catIds; track id) {
                      @if (store.subName(id); as n) { <span class="tag tag-neutral">{{ n }}</span> }
                    }
                    @if (isDefault(r)) { <span class="saved"><app-icon name="star" [size]="12" /> saved</span> }
                  </div>
                </div>
              }
            </div>
            <div class="foot">
              <span class="ready">{{ okCount() }} / {{ store.importRows()!.length }} rows ready</span>
              <button class="btn btn-primary" [disabled]="okCount() === 0" (click)="commit()">Import as tasks</button>
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
    .file-import { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .file-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
    .file-type { width: auto; padding: 6px 10px; }
    .file-error { color: var(--color-accent); font-size: 12px; }
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
        this.fileError.set(`No rows found in “${file.name}”.`);
      } else {
        this.store.appendImportRows(rows);
      }
    } catch {
      this.fileError.set(`Couldn’t read “${file.name}”.`);
    } finally {
      input.value = ''; // let the same file be re-selected
    }
  }

  selectValue(e: Event): BankFileType { return (e.target as HTMLSelectElement).value as BankFileType; }
  value(e: Event): string { return (e.target as HTMLTextAreaElement).value; }
  amountLabel(r: ImportRow): string { return r.amount != null ? fmtMoney(r.amount) : 'no amount'; }
  amountColor(r: ImportRow): string {
    return r.amount == null ? 'var(--muted-strong)' : r.amount >= 0 ? 'var(--color-income)' : 'var(--color-accent)';
  }
  isDefault(r: ImportRow): boolean {
    const norm = r.title.trim().toLowerCase();
    return this.store.titleDefaults().some((d) => d.normalizedTitle === norm);
  }
  okCount = computed(() => (this.store.importRows() ?? []).filter((r) => r.ok).length);
}
