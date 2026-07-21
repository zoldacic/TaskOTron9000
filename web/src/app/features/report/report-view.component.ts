import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { fmtMoney } from '../../core/money-util';

@Component({
  selector: 'app-report-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view om-scroll">
      <header class="head">
        <h1 class="view-title">{{ store.t('report.title') }}</h1>
        <div class="view-sub">{{ store.t('report.sub') }}</div>
      </header>

      <!-- range -->
      <section class="block rule-2">
        <div class="range">
          <label class="field"><span class="kicker">{{ store.t('report.from') }}</span>
            <input class="input date" type="date" [value]="store.repStart()"
                   (change)="store.setRange(value($event), store.repEnd())"></label>
          <label class="field"><span class="kicker">{{ store.t('report.to') }}</span>
            <input class="input date" type="date" [value]="store.repEnd()"
                   (change)="store.setRange(store.repStart(), value($event))"></label>
          <div class="quick">
            <button class="btn" (click)="store.quickRange('month')">{{ store.t('report.thisMonth') }}</button>
            <button class="btn" (click)="store.quickRange('last30')">{{ store.t('report.last30') }}</button>
            <button class="btn" (click)="store.quickRange('year')">{{ store.t('report.year') }}</button>
          </div>
        </div>
      </section>

      <!-- category selection -->
      <section class="block rule-2">
        <div class="sel-head">
          <span class="kicker">{{ store.t('report.categories') }}</span>
          <div class="sel-actions">
            <button class="btn btn-ghost" (click)="store.repAll()">{{ store.t('report.all') }}</button>
            <button class="btn btn-ghost" (click)="store.repNone()">{{ store.t('report.none') }}</button>
          </div>
        </div>
        @for (m of store.mains(); track m.id) {
          <div class="sel-row">
            <span class="sel-label">{{ m.name }}</span>
            <div class="chips">
              @for (s of store.subsOf(m.id); track s.id) {
                <button class="chip" [class.on]="isSel(s.id)" (click)="store.repToggleSub(s.id)">{{ s.name }}</button>
              }
            </div>
          </div>
        }
        <div class="sel-row">
          <span class="sel-label">{{ store.t('report.other') }}</span>
          <div class="chips">
            <button class="chip" [class.on]="isSel('__none__')" (click)="store.repToggleSub('__none__')">{{ store.t('report.uncategorized') }}</button>
          </div>
        </div>
      </section>

      @if (store.report(); as r) {
        <!-- stat cards -->
        <section class="stats">
          <div class="stat"><span class="kicker">{{ store.t('report.moneyIn') }}</span><span class="fig in">{{ fmt(r.moneyIn) }}</span></div>
          <div class="stat"><span class="kicker">{{ store.t('report.moneyOut') }}</span><span class="fig out">{{ fmt(r.moneyOut) }}</span></div>
          <div class="stat"><span class="kicker">{{ store.t('report.netChange') }}</span><span class="fig" [class.in]="r.net >= 0" [class.out]="r.net < 0">{{ fmt(r.net) }}</span></div>
        </section>

        @if (r.categoryBreakdown.length === 0) {
          <div class="empty">
            <h2>{{ store.t('report.emptyTitle') }}</h2>
            <p>{{ store.t('report.emptyBody') }}</p>
          </div>
        } @else {
          <!-- net over time -->
          <section class="block">
            <div class="kicker chart-kicker">{{ store.t('report.netOverTime') }} · {{ granLabel(r.granularity) }}</div>
            <div class="chart">
              @for (b of r.buckets; track $index) {
                <div class="bucket">
                  <div class="pos-area"><div class="bar pos" [style.height.%]="b.net > 0 ? b.net / maxBucket() * 100 : 0"></div></div>
                  <div class="axis"></div>
                  <div class="neg-area"><div class="bar neg" [style.height.%]="b.net < 0 ? -b.net / maxBucket() * 100 : 0"></div></div>
                  <div class="b-label">{{ b.label }}</div>
                </div>
              }
            </div>
          </section>

          <!-- net by category -->
          <section class="block">
            <div class="kicker chart-kicker">{{ store.t('report.netByCategory') }}</div>
            @for (c of r.categoryBreakdown; track c.name; let i = $index) {
              <div class="cat-bar">
                @if (multiColor()) {
                  <span class="swatch" [style.background]="catColor(i)"></span>
                }
                <span class="cat-name">{{ c.name }}</span>
                <div class="track">
                  <div class="track-axis"></div>
                  <div class="cbar" [class.pos]="c.net >= 0" [class.neg]="c.net < 0"
                       [style.background]="barColor(i)"
                       [style.width.%]="absPct(c.net)"
                       [style.left]="c.net >= 0 ? '50%' : null" [style.right]="c.net < 0 ? '50%' : null"></div>
                </div>
                <span class="cat-net" [class.in]="c.net >= 0" [class.out]="c.net < 0">{{ fmt(c.net) }}</span>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .view { height: 100%; overflow-y: auto; padding-bottom: 40px; }
    .head { padding: 24px 24px 16px; }
    .block { padding: 18px 24px; }
    .range { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .date { max-width: 190px; font-family: var(--font-mono); }
    .quick { display: flex; gap: 8px; }
    .sel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .sel-actions { display: flex; gap: 4px; }
    .sel-row { display: flex; align-items: flex-start; gap: 12px; padding: 6px 0; }
    .sel-label { width: 84px; flex: none; font-weight: 700; font-size: 13px; padding-top: 5px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; background: var(--color-divider); margin: 8px 24px; }
    .stat { background: var(--color-bg); padding: 20px; display: flex; flex-direction: column; gap: 10px; }
    .fig { font-family: var(--font-mono); font-size: 26px; font-weight: 700; }
    .in { color: var(--color-income); }
    .out { color: var(--color-danger); }
    .chart-kicker { margin-bottom: 16px; }
    .chart { display: flex; align-items: stretch; gap: 6px; height: 200px; }
    .bucket { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pos-area { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
    .neg-area { flex: 1; display: flex; align-items: flex-start; justify-content: center; }
    .bar { width: 66%; }
    .bar.pos { background: var(--color-income); box-shadow: 0 0 12px -4px var(--color-income); }
    .bar.neg { background: var(--color-danger); box-shadow: 0 0 12px -4px var(--color-danger); }
    .axis { height: 2px; background: var(--color-divider); }
    .b-label { text-align: center; font-family: var(--font-mono); font-size: 10px; color: var(--muted); margin-top: 6px; }
    .cat-bar { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .swatch { width: 10px; height: 10px; flex: none; border-radius: 2px; }
    .cat-name { width: 110px; flex: none; text-align: right; font-size: 13px; }
    .track { flex: 1; position: relative; height: 22px; background: var(--tint-surface); }
    .track-axis { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--color-divider); }
    .cbar { position: absolute; top: 3px; bottom: 3px; }
    .cbar.pos { background: var(--color-income); }
    .cbar.neg { background: var(--color-danger); }
    .cat-net { width: 90px; flex: none; font-family: var(--font-mono); font-size: 13px; font-weight: 700; text-align: right; }
    .empty { text-align: center; padding: 60px 24px; color: var(--muted); }
    .empty h2 { font-family: var(--font-heading); font-weight: 800; text-transform: uppercase; color: var(--color-text); margin-bottom: 8px; }
    .empty p { font-family: var(--font-mono); font-size: 13px; }
  `],
})
export class ReportViewComponent implements OnInit {
  store = inject(TaskStore);
  fmt = fmtMoney;

  ngOnInit(): void { void this.store.loadReport(); }

  value(e: Event): string { return (e.target as HTMLInputElement).value; }

  isSel(id: string): boolean {
    const sel = this.store.repSel();
    return sel === null ? true : sel.includes(id);
  }

  granLabel(g: string): string {
    return this.store.t(g === 'day' ? 'report.gran.daily' : g === 'week' ? 'report.gran.weekly' : 'report.gran.monthly');
  }

  maxBucket = computed(() =>
    Math.max(1, ...(this.store.report()?.buckets ?? []).map((b) => Math.abs(b.net))));

  private maxCat = computed(() =>
    Math.max(1, ...(this.store.report()?.categoryBreakdown ?? []).map((c) => Math.abs(c.net))));

  absPct(net: number): number { return Math.abs(net) / this.maxCat() * 50; }

  // Distinct per-category colors, used when more than one category is charted.
  private readonly palette = [
    '#3b82f6', // accent blue
    '#37e07a', // income green
    '#ffb020', // amber
    '#a855f7', // purple
    '#14b8a6', // teal
    '#ec4899', // pink
    '#f97316', // orange
    '#ff3b1e', // red
  ];

  multiColor = computed(() => (this.store.report()?.categoryBreakdown.length ?? 0) > 1);

  catColor(index: number): string { return this.palette[index % this.palette.length]; }

  // Override the bar background with a per-category color only when charting
  // several categories; otherwise fall back to the .pos/.neg income/danger tint.
  barColor(index: number): string | null { return this.multiColor() ? this.catColor(index) : null; }
}
