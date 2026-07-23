import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { TaskStore } from '../../core/task.store';
import { fmtMoney } from '../../core/money-util';
import { ReportBucket } from '../../models';

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
          <div class="seg">
            <button class="seg-opt" [class.active]="store.repMode() === 'main'"
                    (click)="store.setRepMode('main')">{{ store.t('report.byMain') }}</button>
            <button class="seg-opt" [class.active]="store.repMode() === 'sub'"
                    (click)="store.setRepMode('sub')">{{ store.t('report.bySub') }}</button>
          </div>
          <div class="sel-actions">
            <button class="btn btn-ghost" (click)="store.repAll()">{{ store.t('report.all') }}</button>
            <button class="btn btn-ghost" (click)="store.repNone()">{{ store.t('report.none') }}</button>
          </div>
        </div>
        @if (store.repMode() === 'main') {
          <div class="sel-row">
            <div class="chips">
              @for (m of store.mains(); track m.id) {
                <button class="chip" [class.on]="isSel(m.id)" (click)="store.repToggle(m.id)">{{ m.name }}</button>
              }
              <button class="chip" [class.on]="isSel('__none__')" (click)="store.repToggle('__none__')">{{ store.t('report.uncategorized') }}</button>
            </div>
          </div>
        } @else {
          @for (m of store.mains(); track m.id) {
            <div class="sel-row">
              <span class="sel-label">{{ m.name }}</span>
              <div class="chips">
                @for (s of store.subsOf(m.id); track s.id) {
                  <button class="chip" [class.on]="isSel(s.id)" (click)="store.repToggle(s.id)">{{ s.name }}</button>
                }
              </div>
            </div>
          }
          <div class="sel-row">
            <span class="sel-label">{{ store.t('report.other') }}</span>
            <div class="chips">
              <button class="chip" [class.on]="isSel('__none__')" (click)="store.repToggle('__none__')">{{ store.t('report.uncategorized') }}</button>
            </div>
          </div>
        }
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
            <div class="chart-head">
              <div class="kicker chart-kicker">
                {{ store.t(store.repChart() === 'cumulative' ? 'report.runningBalance' : 'report.netOverTime') }} · {{ granLabel(store.repChart() === 'bars' ? r.granularity : 'day') }}
              </div>
              <div class="seg">
                <button class="seg-opt" [class.active]="store.repChart() === 'bars'"
                        (click)="store.setRepChart('bars')">{{ store.t('report.chart.bars') }}</button>
                <button class="seg-opt" [class.active]="store.repChart() === 'line'"
                        (click)="store.setRepChart('line')">{{ store.t('report.chart.line') }}</button>
                <button class="seg-opt" [class.active]="store.repChart() === 'cumulative'"
                        (click)="store.setRepChart('cumulative')">{{ store.t('report.chart.cumulative') }}</button>
              </div>
            </div>

            @if (store.repChart() === 'bars') {
              <div class="chart">
                @for (b of r.buckets; track $index) {
                  <div class="bucket">
                    @if (multiColor()) {
                      <div class="pos-area"><div class="stack up">
                        @for (seg of segsUp(b); track seg.ci) {
                          <div class="seg-block" [style.height.%]="seg.pct" [style.background]="catColor(seg.ci)"></div>
                        }
                      </div></div>
                      <div class="axis"></div>
                      <div class="neg-area"><div class="stack down">
                        @for (seg of segsDown(b); track seg.ci) {
                          <div class="seg-block" [style.height.%]="seg.pct" [style.background]="catColor(seg.ci)"></div>
                        }
                      </div></div>
                    } @else {
                      <div class="pos-area"><div class="bar pos" [style.height.%]="b.net > 0 ? b.net / maxBucket() * 100 : 0"></div></div>
                      <div class="axis"></div>
                      <div class="neg-area"><div class="bar neg" [style.height.%]="b.net < 0 ? -b.net / maxBucket() * 100 : 0"></div></div>
                    }
                    <div class="b-label" [class.hide]="!showAxisLabel($index)">{{ b.label }}</div>
                  </div>
                }
              </div>
            } @else {
              @if (traces(); as tg) {
                <div class="line-wrap">
                  <svg class="linechart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <line class="zero-line" x1="0" [attr.y1]="tg.zeroY" x2="100" [attr.y2]="tg.zeroY"></line>
                    @if (tg.area) {
                      <path class="area" [attr.d]="tg.area" [class.balance]="store.repChart() === 'cumulative'"></path>
                    }
                    @for (ln of tg.lines; track ln.name) {
                      <polyline class="line"
                                [class.balance]="!tg.multi && store.repChart() === 'cumulative'"
                                [class.total]="ln.total && tg.multi"
                                [style.stroke]="ln.color"
                                [attr.points]="ln.points"></polyline>
                    }
                  </svg>
                  <div class="line-labels">
                    @for (b of r.dailyBuckets; track $index) {
                      <span class="b-label" [class.hide]="!showDailyAxisLabel($index)">{{ b.label }}</span>
                    }
                  </div>
                  @if (tg.multi) {
                    <ul class="line-legend">
                      @for (ln of tg.lines; track ln.name) {
                        <li>
                          <span class="swatch" [style.background]="ln.color ?? 'var(--color-text)'"></span>
                          <span class="l-name">{{ ln.name }}</span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            }
          </section>

          <!-- net by category -->
          <section class="block">
            <div class="chart-head">
              <div class="kicker chart-kicker">{{ store.t(store.repMode() === 'sub' ? 'report.netBySubcategory' : 'report.netByCategory') }}</div>
              <div class="seg">
                <button class="seg-opt" [class.active]="store.repCatChart() === 'bars'"
                        (click)="store.setRepCatChart('bars')">{{ store.t('report.chart.bars') }}</button>
                <button class="seg-opt" [class.active]="store.repCatChart() === 'donut'"
                        (click)="store.setRepCatChart('donut')">{{ store.t('report.chart.donut') }}</button>
              </div>
            </div>

            @if (store.repCatChart() === 'bars') {
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
            } @else if (donut(); as d) {
              <div class="donut-wrap">
                <svg class="donut" viewBox="0 0 42 42" aria-hidden="true">
                  <circle class="donut-hole" cx="21" cy="21" r="15.91549431"></circle>
                  @for (s of d.slices; track s.name) {
                    <circle class="donut-seg" cx="21" cy="21" r="15.91549431"
                            [attr.stroke]="s.color"
                            [attr.stroke-dasharray]="s.dash"
                            [attr.stroke-dashoffset]="s.offset"></circle>
                  }
                  <text class="donut-center-lbl" x="21" y="19.5">{{ store.t('report.netChange') }}</text>
                  <text class="donut-center-val" x="21" y="24" [class.in]="d.total >= 0" [class.out]="d.total < 0">{{ fmt(d.total) }}</text>
                </svg>
                <ul class="donut-legend">
                  @for (s of d.slices; track s.name) {
                    <li>
                      <span class="swatch" [style.background]="s.color"></span>
                      <span class="cat-name l-name">{{ s.name }}</span>
                      <span class="l-pct">{{ s.pct }}% {{ store.t('report.chart.share') }}</span>
                      <span class="cat-net" [class.in]="s.net >= 0" [class.out]="s.net < 0">{{ fmt(s.net) }}</span>
                    </li>
                  }
                </ul>
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
    .chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .chart-kicker { margin-bottom: 0; }
    .chart { display: flex; align-items: stretch; gap: 6px; height: 200px; }
    .bucket { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pos-area { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
    .neg-area { flex: 1; display: flex; align-items: flex-start; justify-content: center; }
    .bar { width: 66%; }
    .bar.pos { background: var(--color-income); box-shadow: 0 0 12px -4px var(--color-income); }
    .bar.neg { background: var(--color-danger); box-shadow: 0 0 12px -4px var(--color-danger); }
    .stack { width: 66%; height: 100%; display: flex; }
    .stack.up { flex-direction: column-reverse; }
    .stack.down { flex-direction: column; }
    .seg-block { width: 100%; }
    .axis { height: 2px; background: var(--color-divider); }
    .b-label { text-align: center; font-family: var(--font-mono); font-size: 10px; color: var(--muted); margin-top: 6px; }
    /* Thinned-out axis ticks keep their box (alignment/spacing) but hide the text. */
    .b-label.hide { visibility: hidden; }
    /* line / balance charts */
    .line-wrap { display: flex; flex-direction: column; }
    .linechart { width: 100%; height: 200px; overflow: visible; }
    .zero-line { stroke: var(--color-divider); stroke-width: 2px; vector-effect: non-scaling-stroke; }
    .line { fill: none; stroke: var(--color-accent); stroke-width: 2px;
            stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .line.balance { stroke: var(--color-income); }
    /* The combined total line (only shown alongside per-category lines): a bolder,
       neutral stroke so it reads as the aggregate rather than another category. */
    .line.total { stroke: var(--color-text); stroke-width: 3px; }
    .area { fill: color-mix(in srgb, var(--color-accent) 16%, transparent); stroke: none; }
    .area.balance { fill: color-mix(in srgb, var(--color-income) 16%, transparent); }
    .line-labels { display: flex; margin-top: 6px; }
    .line-labels .b-label { flex: 1; min-width: 0; margin-top: 0; }
    .line-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; }
    .line-legend li { display: flex; align-items: center; gap: 7px; }
    .line-legend .l-name { width: auto; flex: none; font-size: 12px; }
    /* donut / share chart */
    .donut-wrap { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; padding-top: 6px; }
    .donut { width: 200px; height: 200px; flex: none; }
    .donut-hole { fill: transparent; stroke: var(--tint-surface); stroke-width: 5; }
    .donut-seg { fill: transparent; stroke-width: 5; }
    .donut-center-lbl { font-family: var(--font-mono); font-size: 2.6px; letter-spacing: .2px;
                        text-transform: uppercase; text-anchor: middle; fill: var(--muted); }
    .donut-center-val { font-family: var(--font-mono); font-size: 5px; font-weight: 700;
                        text-anchor: middle; fill: var(--color-text); }
    .donut-center-val.in { fill: var(--color-income); }
    .donut-center-val.out { fill: var(--color-danger); }
    .donut-legend { list-style: none; display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 240px; }
    .donut-legend li { display: flex; align-items: center; gap: 10px; }
    .l-name { width: auto; flex: 1; text-align: left; }
    .l-pct { font-family: var(--font-mono); font-size: 12px; color: var(--muted); flex: none; }
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

  // With finer granularity a range can carry dozens of buckets, so only label every
  // Nth tick (~a dozen total) — enough to read the axis without the text colliding.
  private axisStep = computed(() => {
    const n = this.store.report()?.buckets.length ?? 0;
    return Math.max(1, Math.ceil(n / 12));
  });
  showAxisLabel(i: number): boolean { return i % this.axisStep() === 0; }

  // The line/balance chart plots the daily series, which can carry a point per day
  // (hundreds over a year), so thin its axis labels to ~a dozen independently.
  private dailyAxisStep = computed(() => {
    const n = this.store.report()?.dailyBuckets.length ?? 0;
    return Math.max(1, Math.ceil(n / 12));
  });
  showDailyAxisLabel(i: number): boolean { return i % this.dailyAxisStep() === 0; }

  // SVG geometry for the line / balance charts, in a 0..100 viewBox (stretched to
  // fit via preserveAspectRatio="none"). 'line' plots each bucket's net around a
  // centred zero axis; 'cumulative' plots the running balance across the window.
  // With several categories charted we draw one line per category (b.parts[ci],
  // aligned to categoryBreakdown) plus a combined total line, all sharing one Y
  // axis; with a single category it stays the one filled line as before.
  readonly traces = computed(() => {
    const r = this.store.report();
    const buckets = r?.dailyBuckets ?? [];
    const n = buckets.length;
    if (n === 0) return null;

    const cats = r!.categoryBreakdown;
    const multi = cats.length > 1;
    const cumulative = this.store.repChart() === 'cumulative';

    // Per-bucket values for one series: raw net, or the running balance if cumulative.
    const runSeries = (pick: (b: ReportBucket) => number): number[] => {
      const vals: number[] = [];
      let run = 0;
      for (const b of buckets) { const v = pick(b); run += v; vals.push(cumulative ? run : v); }
      return vals;
    };

    // Cap how many category lines we draw: past MAX_CAT_LINES the chart turns into
    // spaghetti, so keep the biggest movers (by |net|) and fold the rest into a
    // single muted "Other" line. Kept categories stay in breakdown order (and keep
    // their palette index) so their colours still match the bars/donut below.
    const MAX_CAT_LINES = 6;
    const fold = cats.length > MAX_CAT_LINES;
    const rankedByNet = cats.map((_, ci) => ci).sort((a, b) => Math.abs(cats[b].net) - Math.abs(cats[a].net));
    const keep = new Set(fold ? rankedByNet.slice(0, MAX_CAT_LINES - 1) : rankedByNet);

    // One value-series per kept category (only when several are charted), then the
    // folded "Other" line if we capped, then the always-present combined total.
    const series: { name: string; color: string | null; total: boolean; vals: number[] }[] = [];
    if (multi) {
      cats.forEach((c, ci) => {
        if (!keep.has(ci)) return;
        series.push({ name: c.name, color: this.catColor(ci), total: false, vals: runSeries((b) => b.parts[ci] ?? 0) });
      });
      if (fold) {
        series.push({
          name: this.store.t('report.otherCats'),
          color: 'var(--muted)',
          total: false,
          vals: runSeries((b) => b.parts.reduce((s, v, ci) => (keep.has(ci) ? s : s + (v ?? 0)), 0)),
        });
      }
    }
    series.push({ name: this.store.t('report.total'), color: null, total: true, vals: runSeries((b) => b.net) });

    // Shared Y mapping across every series so the lines are directly comparable.
    const all = series.flatMap((s) => s.vals);
    let toY: (v: number) => number;
    if (cumulative) {
      const domMin = Math.min(0, ...all);
      const domMax = Math.max(0, ...all);
      const span = Math.max(1e-9, domMax - domMin);
      toY = (v) => 100 - ((v - domMin) / span) * 100;
    } else {
      const maxAbs = Math.max(1, ...all.map((v) => Math.abs(v)));
      toY = (v) => 50 - (v / maxAbs) * 50; // net 0 sits on the mid axis
    }

    const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
    const zeroY = toY(0);
    const lines = series.map((s) => ({
      name: s.name,
      color: s.color,
      total: s.total,
      points: s.vals.map((v, i) => `${x(i).toFixed(2)},${toY(v).toFixed(2)}`).join(' '),
    }));

    // The soft area fill only reads well for a single line; with several overlapping
    // category lines it would just muddy the chart, so drop it in the multi case.
    let area: string | null = null;
    if (!multi) {
      const pts = series[0].vals.map((v, i) => `${x(i).toFixed(2)},${toY(v).toFixed(2)}`);
      area = `M ${x(0).toFixed(2)},${zeroY.toFixed(2)} L ${pts.join(' L ')} L ${x(n - 1).toFixed(2)},${zeroY.toFixed(2)} Z`;
    }

    return { lines, area, multi, zeroY: zeroY.toFixed(2) };
  });

  // When stacking per-category segments a bucket can carry both inflow and outflow,
  // so scale by the largest gross positive/negative stack across all buckets (not net).
  private bucketScale = computed(() => {
    let m = 1;
    for (const b of this.store.report()?.buckets ?? []) {
      let pos = 0, neg = 0;
      for (const p of b.parts) { if (p > 0) pos += p; else neg -= p; }
      m = Math.max(m, pos, neg);
    }
    return m;
  });

  segsUp(b: ReportBucket) { return this.segs(b, +1); }
  segsDown(b: ReportBucket) { return this.segs(b, -1); }

  // Positive (sign +1) or negative (sign -1) per-category segments for one bucket,
  // as a stack-height percentage keyed by category index (for its palette color).
  private segs(b: ReportBucket, sign: number) {
    const scale = this.bucketScale();
    const out: { ci: number; pct: number }[] = [];
    b.parts.forEach((v, ci) => {
      if (Math.sign(v) === sign) out.push({ ci, pct: Math.abs(v) / scale * 100 });
    });
    return out;
  }

  private maxCat = computed(() =>
    Math.max(1, ...(this.store.report()?.categoryBreakdown ?? []).map((c) => Math.abs(c.net))));

  absPct(net: number): number { return Math.abs(net) / this.maxCat() * 50; }

  // Donut geometry: each category's share of the total net movement (by |net|),
  // as stroke-dash percentages on a circumference-100 ring. Slices start at 12
  // o'clock (offset 25) and each one is pushed on by the running total before it.
  readonly donut = computed(() => {
    const cats = this.store.report()?.categoryBreakdown ?? [];
    const totalAbs = cats.reduce((sum, c) => sum + Math.abs(c.net), 0);
    if (totalAbs <= 0) return null;
    let cum = 0;
    const slices = cats.map((c, i) => {
      const share = (Math.abs(c.net) / totalAbs) * 100;
      const slice = {
        name: c.name,
        net: c.net,
        color: this.catColor(i),
        pct: Math.round(share),
        dash: `${share.toFixed(3)} ${(100 - share).toFixed(3)}`,
        offset: (25 - cum).toFixed(3),
      };
      cum += share;
      return slice;
    });
    const total = cats.reduce((sum, c) => sum + c.net, 0);
    return { slices, total };
  });

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
