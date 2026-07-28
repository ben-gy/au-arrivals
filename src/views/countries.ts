// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { recoverySet } from '../analysis';
import { escapeHtml, formatCount, formatNumber, formatRecovery, shortCountry } from '../format';
import { gloss } from '../glossary';
import { regionColour } from '../palette';
import type { Country, Dataset } from '../types';
import { lineChart } from '../utils/svg';
import type { ViewContext } from './types';

const DEFAULT = ['6101', '1201', '8104', '21', '7103']; // China, NZ, USA, UK, India
const LINE_COLOURS = ['#0f766e', '#c2410c', '#7c3aed', '#0369a1', '#b45309', '#be185d'];

export function renderCountries(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const selected = parseSel(ctx.getState('compare', DEFAULT.join(',')), data);
  const periods = data.national.periods;

  root.innerHTML = `
    <div class="view-head">
      <h2>Compare countries over time</h2>
      <p>
        Every source country recovered differently. Each line below is one country’s visitor arrivals as a
        percentage of its own ${gloss('recovery', '2019 average')} — so a small market and a huge one can be
        compared on the same axis. The dashed line is the 2019 level: above it a country sends more visitors
        than before COVID, below it fewer.
      </p>
    </div>

    <div class="view-controls">
      <div class="compare-search">
        <input class="search-input" id="cmp-search" type="search" autocomplete="off"
          placeholder="Add a country to compare…" aria-label="Add a country" />
        <div class="search-results" id="cmp-results" role="listbox"></div>
      </div>
      <div class="chip-row" id="cmp-chips"></div>
    </div>

    <div class="chart-wrap chart-scroll" id="cmp-chart"></div>
    <div class="legend" id="cmp-legend"></div>

    <div class="panel-grid" style="margin-top:var(--space-2xl)">
      <div class="panel">
        <h3>Recovered the most</h3>
        <p class="panel-sub">Sizeable markets sending the highest share of their 2019 visitors. Click to open.</p>
        <ol class="rank-list" id="movers-up"></ol>
      </div>
      <div class="panel">
        <h3>Still furthest below 2019</h3>
        <p class="panel-sub">Sizeable markets that have recovered the least. Click to open.</p>
        <ol class="rank-list" id="movers-down"></ol>
      </div>
    </div>
  `;

  drawChart(root.querySelector('#cmp-chart') as HTMLElement, root.querySelector('#cmp-legend') as HTMLElement, selected, periods);
  drawChips(root, selected, data, ctx);
  mountSearch(root, selected, data, ctx);
  drawMovers(root, data, ctx);

  root.querySelectorAll<HTMLElement>('[data-open-country]').forEach((el) => {
    const go = () => ctx.openCountry(el.dataset.openCountry as string);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

function drawChart(host: HTMLElement, legendEl: HTMLElement, selected: Country[], periods: string[]): void {
  const base2019 = (c: Country): number => {
    let sum = 0; let n = 0;
    periods.forEach((p, i) => { if (p.startsWith('2019-') && Number.isFinite(c.vSeries[i] as number)) { sum += c.vSeries[i] as number; n++; } });
    return n ? sum / n : 0;
  };
  const usable = selected.filter((c) => base2019(c) > 0);
  const series = usable.map((c, i) => {
    const b = base2019(c);
    return {
      values: c.vSeries.map((v) => (v === null || !Number.isFinite(v) ? null : (v / b) * 100)),
      colour: LINE_COLOURS[i % LINE_COLOURS.length],
      label: shortCountry(c.n),
    };
  });
  // 2019 reference line at 100.
  series.push({ values: periods.map(() => 100), colour: '#b3ada2', label: '2019 level', dash: true } as never);

  if (!series.length) {
    host.innerHTML = '<div class="empty-state">Select a country with 2019 data to compare.</div>';
    legendEl.innerHTML = '';
    return;
  }
  // Only show from 2015 so the rebased detail is legible (full history compresses it).
  const startIdx = Math.max(0, periods.indexOf('2015-01'));
  const p2 = periods.slice(startIdx);
  const s2 = series.map((s) => ({ ...s, values: (s.values as (number | null)[]).slice(startIdx) }));
  host.innerHTML = lineChart(s2, p2, { width: 1000, height: 380, fmt: (v) => `${v.toFixed(0)}%` });
  legendEl.innerHTML = usable.map((c, i) =>
    `<span class="legend-item"><span class="legend-line" style="background:${LINE_COLOURS[i % LINE_COLOURS.length]}"></span>${escapeHtml(shortCountry(c.n))}</span>`,
  ).join('') + '<span class="legend-item"><span class="legend-line dashed" style="background:#b3ada2"></span>2019 level</span>';
}

function drawChips(root: HTMLElement, selected: Country[], data: Dataset, ctx: ViewContext): void {
  const host = root.querySelector('#cmp-chips') as HTMLElement;
  host.innerHTML = selected.map((c, i) =>
    `<span class="chip-pill" style="border-color:${LINE_COLOURS[i % LINE_COLOURS.length]}">
      <span class="chip-dot" style="background:${LINE_COLOURS[i % LINE_COLOURS.length]}"></span>
      ${escapeHtml(shortCountry(c.n))}
      <button class="chip-x" data-remove="${escapeHtml(c.c)}" aria-label="Remove ${escapeHtml(shortCountry(c.n))}">×</button>
    </span>`).join('') || '<span class="muted">No countries selected.</span>';
  host.querySelectorAll<HTMLElement>('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = selected.filter((c) => c.c !== btn.dataset.remove).map((c) => c.c);
      ctx.setState('compare', next.join(','));
      renderCountries(root, data, ctx);
    }),
  );
}

function mountSearch(root: HTMLElement, selected: Country[], data: Dataset, ctx: ViewContext): void {
  const input = root.querySelector('#cmp-search') as HTMLInputElement;
  const results = root.querySelector('#cmp-results') as HTMLElement;
  const selectedCodes = new Set(selected.map((c) => c.c));

  const close = () => results.classList.remove('open');
  const add = (code: string) => {
    if (selectedCodes.has(code) || selected.length >= 6) return;
    ctx.setState('compare', [...selected.map((c) => c.c), code].join(','));
    renderCountries(root, data, ctx);
  };
  const search = (q: string) => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) { close(); return; }
    const hits = data.countries
      .filter((c) => !selectedCodes.has(c.c) && shortCountry(c.n).toLowerCase().includes(needle))
      .slice(0, 8);
    results.innerHTML = hits.length
      ? hits.map((c) => `<div class="search-item" data-code="${escapeHtml(c.c)}" role="option">
          <span class="sr-dot" style="background:${regionColour(c.region)}"></span>
          <span class="sr-name">${escapeHtml(shortCountry(c.n))}</span>
          <span class="sr-meta mono">${escapeHtml(formatCount(c.v12))}</span></div>`).join('')
      : '<div class="search-empty">No match.</div>';
    results.classList.add('open');
    results.querySelectorAll<HTMLElement>('.search-item[data-code]').forEach((el) =>
      el.addEventListener('click', () => add(el.dataset.code as string)));
  };
  let timer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(input.value), 200); });
  document.addEventListener('click', (e) => { if (!(e.target as Element).closest('.compare-search')) close(); });
}

function drawMovers(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const set = recoverySet(data.countries, 40000);
  const up = [...set].sort((a, b) => (b.vRecovery ?? 0) - (a.vRecovery ?? 0)).slice(0, 8);
  const down = [...set].sort((a, b) => (a.vRecovery ?? 9) - (b.vRecovery ?? 9)).slice(0, 8);
  const row = (c: Country) => `<li class="rank-item" data-open-country="${escapeHtml(c.c)}" tabindex="0" role="button"
      data-tip="${escapeHtml(shortCountry(c.n))}: ${escapeHtml(formatNumber(c.v12))} visitors, ${escapeHtml(formatRecovery(c.vRecovery))} of 2019">
    <span class="rank-swatch" style="background:${regionColour(c.region)}"></span>
    <span class="rank-name">${escapeHtml(shortCountry(c.n))}</span>
    <span class="rank-meta ${(c.vRecovery ?? 0) >= 1 ? 'pos' : 'neg'}">${escapeHtml(formatRecovery(c.vRecovery))}</span>
    <span class="rank-value">${escapeHtml(formatCount(c.v12))}</span></li>`;
  (root.querySelector('#movers-up') as HTMLElement).innerHTML = up.map(row).join('');
  (root.querySelector('#movers-down') as HTMLElement).innerHTML = down.map(row).join('');
  void ctx;
}

function parseSel(csv: string, data: Dataset): Country[] {
  return csv.split(',').map((c) => data.byCode.get(c.trim())).filter((c): c is Country => !!c);
}
