// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { linearBins } from '../analysis';
import { escapeHtml, formatNumber, formatRecovery, shortCountry, shortRegion } from '../format';
import { C_VISITOR, regionColour } from '../palette';
import type { Country, Dataset } from '../types';
import { sparkline } from '../utils/svg';
import type { ViewContext } from './types';

type SortKey = 'v12' | 'vRecovery' | 'r12' | 'name';

export function renderExplorer(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const sort = (ctx.getState('expSort', 'v12') as SortKey);
  const q = ctx.getState('expQ', '');
  const region = ctx.getState('expRegion', 'all');
  const bin = ctx.getState('expBin', ''); // "lo,hi" recovery filter, or ''

  const regions = [...new Map(data.countries.map((c) => [c.region, c.regionName])).entries()]
    .filter(([code]) => code) as Array<[string, string]>;

  root.innerHTML = `
    <div class="view-head">
      <h2>Explore every country</h2>
      <p>Search, sort and filter all ${data.meta.counts.countries} reported source countries. The histogram shows
        how far each has recovered against 2019 — click a bar to filter the table to it.</p>
    </div>

    <div class="panel" style="margin-bottom:var(--space-lg)">
      <h3>Recovery distribution</h3>
      <p class="panel-sub">Number of countries by how their last 12 months compare to 2019. Click a bar to filter.</p>
      <div id="exp-hist"></div>
    </div>

    <div class="view-controls">
      <label class="control search-inline">Search
        <input class="search-input" id="exp-search" type="search" value="${escapeHtml(q)}" placeholder="Country…" aria-label="Search countries" />
      </label>
      <label class="control">Region
        <select id="exp-region">
          <option value="all" ${region === 'all' ? 'selected' : ''}>All regions</option>
          ${regions.map(([code, name]) => `<option value="${escapeHtml(code)}" ${region === code ? 'selected' : ''}>${escapeHtml(shortRegion(name))}</option>`).join('')}
        </select>
      </label>
      <label class="control">Sort by
        <select id="exp-sort">
          <option value="v12" ${sort === 'v12' ? 'selected' : ''}>Visitors (12 mo)</option>
          <option value="vRecovery" ${sort === 'vRecovery' ? 'selected' : ''}>Recovery vs 2019</option>
          <option value="r12" ${sort === 'r12' ? 'selected' : ''}>Residents returning</option>
          <option value="name" ${sort === 'name' ? 'selected' : ''}>Name (A–Z)</option>
        </select>
      </label>
      ${bin ? `<button class="btn" id="exp-clear">Clear recovery filter ✕</button>` : ''}
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th class="col-rank">#</th><th class="col-name">Country</th><th class="col-hide-sm">Region</th>
          <th class="num">Visitors (12 mo)</th><th class="num">Recovery</th>
          <th class="num col-hide-sm">Residents back</th><th class="col-hide-md">Trend</th>
        </tr></thead>
        <tbody id="exp-body"></tbody>
      </table>
    </div>
    <p class="view-foot" id="exp-count"></p>
  `;

  drawHist(root, data, ctx, bin);
  drawBody(root, data, ctx, { sort, q, region, bin });

  const searchEl = root.querySelector('#exp-search') as HTMLInputElement;
  let timer: ReturnType<typeof setTimeout>;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { ctx.setState('expQ', searchEl.value); drawBody(root, data, ctx, { sort, q: searchEl.value, region, bin }); }, 250);
  });
  root.querySelector('#exp-region')?.addEventListener('change', (e) => { ctx.setState('expRegion', (e.target as HTMLSelectElement).value); renderExplorer(root, data, ctx); });
  root.querySelector('#exp-sort')?.addEventListener('change', (e) => { ctx.setState('expSort', (e.target as HTMLSelectElement).value); renderExplorer(root, data, ctx); });
  root.querySelector('#exp-clear')?.addEventListener('click', () => { ctx.setState('expBin', ''); renderExplorer(root, data, ctx); });
}

function filtered(data: Dataset, o: { sort: SortKey; q: string; region: string; bin: string }): Country[] {
  const needle = o.q.trim().toLowerCase();
  let rows = data.countries.filter((c) => {
    if (o.region !== 'all' && c.region !== o.region) return false;
    if (needle && !shortCountry(c.n).toLowerCase().includes(needle)) return false;
    if (o.bin) {
      const [lo, hi] = o.bin.split(',').map(Number);
      const r = c.vRecovery;
      if (r === null || r < lo || r >= hi) return false;
    }
    return true;
  });
  rows = rows.sort((a, b) =>
    o.sort === 'name' ? shortCountry(a.n).localeCompare(shortCountry(b.n))
      : o.sort === 'vRecovery' ? (b.vRecovery ?? -1) - (a.vRecovery ?? -1)
      : (b[o.sort] as number) - (a[o.sort] as number));
  return rows;
}

function drawBody(root: HTMLElement, data: Dataset, ctx: ViewContext, o: { sort: SortKey; q: string; region: string; bin: string }): void {
  const rows = filtered(data, o);
  const body = root.querySelector('#exp-body') as HTMLElement;
  body.innerHTML = rows.length ? rows.map((c) => `
    <tr class="clickable" data-open-country="${escapeHtml(c.c)}" tabindex="0" role="button">
      <td class="col-rank">${c.rank}</td>
      <td class="col-name"><span class="row-name"><span class="rank-swatch" style="background:${regionColour(c.region)}"></span>${escapeHtml(shortCountry(c.n))}</span></td>
      <td class="col-hide-sm muted">${escapeHtml(shortRegion(c.regionName))}</td>
      <td class="num mono">${escapeHtml(formatNumber(c.v12))}</td>
      <td class="num mono ${(c.vRecovery ?? 0) >= 1 ? 'pos' : 'neg'}">${escapeHtml(formatRecovery(c.vRecovery))}</td>
      <td class="num mono col-hide-sm">${escapeHtml(formatNumber(c.r12))}</td>
      <td class="col-hide-md spark-cell">${sparkline(c.vSeries, { colour: C_VISITOR })}</td>
    </tr>`).join('') : `<tr><td colspan="7" class="empty-cell">No countries match.</td></tr>`;

  (root.querySelector('#exp-count') as HTMLElement).textContent =
    `${rows.length} of ${data.meta.counts.countries} countries${o.bin ? ' (recovery filtered)' : ''}.`;

  body.querySelectorAll<HTMLElement>('[data-open-country]').forEach((el) => {
    const go = () => ctx.openCountry(el.dataset.openCountry as string);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

function drawHist(root: HTMLElement, data: Dataset, ctx: ViewContext, activeBin: string): void {
  const host = root.querySelector('#exp-hist') as HTMLElement;
  const values = data.countries.map((c) => c.vRecovery).filter((v): v is number => v !== null).map((v) => Math.min(v, 2));
  const bins = linearBins(values, 0, 2, 16);
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  const w = 900; const h = 190; const pad = { t: 8, r: 10, b: 30, l: 30 };
  const iw = w - pad.l - pad.r; const ih = h - pad.t - pad.b;
  const bw = iw / bins.length;

  const bars = bins.map((b, i) => {
    const bh = (b.n / maxN) * ih;
    const x = pad.l + i * bw;
    const active = activeBin === `${b.lo.toFixed(3)},${b.hi.toFixed(3)}`;
    const over = b.lo >= 1;
    return `<rect class="hist-bar" x="${x + 1}" y="${pad.t + ih - bh}" width="${bw - 2}" height="${bh}"
      fill="${active ? '#12263f' : over ? C_VISITOR : '#c26a1a'}" fill-opacity="${active ? 1 : 0.82}"
      data-lo="${b.lo.toFixed(3)}" data-hi="${b.hi.toFixed(3)}"
      data-tip="${(b.lo * 100).toFixed(0)}–${(b.hi * 100).toFixed(0)}% of 2019: ${b.n} ${b.n === 1 ? 'country' : 'countries'}" />`;
  }).join('');
  const marks = [0, 0.5, 1, 1.5, 2].map((v) => {
    const x = pad.l + (v / 2) * iw;
    return `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t + ih}" stroke="${v === 1 ? 'var(--border-strong)' : 'var(--border-subtle)'}" ${v === 1 ? 'stroke-dasharray="3 2"' : ''} />
      <text x="${x}" y="${h - 8}" text-anchor="middle" class="axis-label">${(v * 100).toFixed(0)}%</text>`;
  }).join('');

  host.innerHTML = `<div class="chart-scroll"><svg viewBox="0 0 ${w} ${h}" class="histogram" preserveAspectRatio="xMidYMid meet"
    role="img" aria-label="Distribution of country recovery vs 2019">${marks}${bars}
    <text x="${pad.l}" y="${pad.t + 4}" class="axis-label">countries</text></svg></div>`;

  host.querySelectorAll<SVGRectElement>('.hist-bar').forEach((rect) =>
    rect.addEventListener('click', () => {
      const key = `${rect.dataset.lo},${rect.dataset.hi}`;
      ctx.setState('expBin', activeBin === key ? '' : key);
      renderExplorer(root, data, ctx);
    }),
  );
}
