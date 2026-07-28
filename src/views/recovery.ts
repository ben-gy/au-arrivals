// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { rollingMean } from '../analysis';
import { covidBand } from '../components/drawer';
import { escapeHtml, formatCount, formatNumber, formatPercent, formatPeriodLong, formatRecovery, shortRegion } from '../format';
import { gloss } from '../glossary';
import { C_RETURN, C_VISITOR, regionColour } from '../palette';
import type { Dataset } from '../types';
import { lineChart } from '../utils/svg';
import type { ViewContext } from './types';

type Smooth = 'monthly' | 'avg';
type Which = 'both' | 'vis' | 'ret';

export function renderRecovery(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const smooth = (ctx.getState('recSmooth', 'monthly') as Smooth);
  const which = (ctx.getState('recWhich', 'both') as Which);
  const h = data.meta.headline;
  const periods = data.national.periods;

  const vis = smooth === 'avg' ? rollingMean(data.national.visitors, 12) : data.national.visitors;
  const ret = smooth === 'avg' ? rollingMean(data.national.returns, 12) : data.national.returns;
  const series = [];
  if (which !== 'ret') series.push({ values: vis, colour: C_VISITOR, label: 'Visitors arriving' });
  if (which !== 'vis') series.push({ values: ret, colour: C_RETURN, label: 'Residents returning' });

  const regions = [...data.regions].filter((r) => r.vRecovery !== null).sort((a, b) => (b.vRecovery ?? 0) - (a.vRecovery ?? 0));

  root.innerHTML = `
    <div class="view-head">
      <h2>The cliff and the recovery</h2>
      <p>
        Half a century of short-term arrivals in one line. The travel year has always had its rhythm — a
        summer peak, a winter dip — but nothing in the record compares to
        ${escapeHtml(monthLabel(h.troughMonth))}, when visitor arrivals fell
        <strong>${escapeHtml(formatPercent(h.troughDrop ?? 0, 1))}</strong> to
        <strong>${escapeHtml(formatNumber(h.troughValue))}</strong> and the border closed.
      </p>
    </div>

    <div class="view-controls">
      <div class="segmented" role="tablist" aria-label="Which travellers">
        ${seg('recWhich', 'both', which, 'Both')}
        ${seg('recWhich', 'vis', which, 'Visitors arriving')}
        ${seg('recWhich', 'ret', which, 'Residents returning')}
      </div>
      <div class="segmented" role="tablist" aria-label="Smoothing">
        ${seg('recSmooth', 'monthly', smooth, 'Monthly')}
        ${seg('recSmooth', 'avg', smooth, '12-month average')}
      </div>
      <span class="control-note">
        ${smooth === 'monthly'
          ? gloss('original', 'Original monthly counts') + ' — the seasonal swing is real, not noise.'
          : 'Each point is the trailing 12-month average, which strips out the seasonal swing to show the trend.'}
      </span>
    </div>

    <div class="chart-scroll">
      ${lineChart(series, periods, { width: 1000, height: 400, minZero: true, bands: covidBand(periods) })}
    </div>
    <div class="legend">
      ${which !== 'ret' ? `<span class="legend-item"><span class="legend-line" style="background:${C_VISITOR}"></span>Visitors arriving</span>` : ''}
      ${which !== 'vis' ? `<span class="legend-item"><span class="legend-line" style="background:${C_RETURN}"></span>Residents returning</span>` : ''}
      <span class="legend-item"><span class="legend-swatch" style="background:var(--covid-band)"></span>Border closed (Feb 2020 – Feb 2022)</span>
    </div>

    <div class="callout">
      <h3>Is tourism back yet?</h3>
      <p>
        Over the last 12 months, ${escapeHtml(formatNumber(h.visitors12))} short-term visitors arrived —
        ${escapeHtml(formatRecovery(h.recovery12))} of the same months in 2019.
      </p>
      <div class="gauge" role="img" aria-label="Recovery ${escapeHtml(formatRecovery(h.recovery12))} of 2019">
        <div class="gauge-track">
          <div class="gauge-fill" style="width:${Math.min(100, (h.recovery12 ?? 0) * 100).toFixed(1)}%;
            background:${(h.recovery12 ?? 0) >= 1 ? C_VISITOR : '#c26a1a'}"></div>
          <div class="gauge-marker" style="left:100%" data-tip="2019 level (100%)"></div>
        </div>
        <div class="gauge-labels"><span>0</span><span>${escapeHtml(formatRecovery(h.recovery12))}</span><span>2019 = 100%</span></div>
      </div>
    </div>

    <div class="panel">
      <h3>Recovery by region</h3>
      <p class="panel-sub">Visitors from each region, last 12 months as a share of the same months in 2019.</p>
      <div class="bar-list">
        ${regions.map((r) => {
          const rec = r.vRecovery ?? 0;
          return `<div class="bar-row" data-tip="${escapeHtml(shortRegion(r.n))}: ${escapeHtml(formatNumber(r.v12))} visitors, ${escapeHtml(formatRecovery(r.vRecovery))} of 2019">
            <span class="bar-label">${escapeHtml(shortRegion(r.n))}</span>
            <span class="bar-track gauge-track-100">
              <span class="bar-fill" style="width:${Math.min(100, rec * 100 * 0.62).toFixed(1)}%;background:${regionColour(r.c)}"></span>
              <span class="track-100-mark" style="left:62%"></span>
            </span>
            <span class="bar-value ${rec >= 1 ? 'pos' : ''}">${escapeHtml(formatRecovery(r.vRecovery))}</span>
            <span class="bar-sub">${escapeHtml(formatCount(r.v12))}</span>
          </div>`;
        }).join('')}
      </div>
      <p class="view-foot">The tick marks the 2019 level. Bars past it have more than recovered; bars short of it have not.
        <button class="text-link" data-goto="countries">Compare individual countries →</button></p>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('.seg[data-key]').forEach((btn) =>
    btn.addEventListener('click', () => {
      ctx.setState(btn.dataset.key as string, btn.dataset.val as string);
      renderRecovery(root, data, ctx);
    }),
  );
  root.querySelectorAll<HTMLElement>('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => ctx.goTo(el.dataset.goto as string)),
  );
}

function seg(key: string, val: string, current: string, label: string): string {
  return `<button class="seg ${val === current ? 'active' : ''}" data-key="${key}" data-val="${val}"
    role="tab" aria-selected="${val === current}">${label}</button>`;
}

function monthLabel(period: string | null): string {
  return period ? formatPeriodLong(period) : '—';
}
