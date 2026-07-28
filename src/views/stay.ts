// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, formatCount, formatNumber, formatPercent } from '../format';
import { gloss } from '../glossary';
import { DURATION_COLOURS } from '../palette';
import type { Dataset } from '../types';
import { stackedArea } from '../utils/svg';
import type { ViewContext } from './types';

type Who = 'visitors' | 'returns';

export function renderStay(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const who = (ctx.getState('stayWho', 'visitors') as Who);
  const list = data.durations[who];
  const periods = data.durations.periods;
  const colourAt = (i: number) => DURATION_COLOURS[i % DURATION_COLOURS.length];

  const total12 = list.reduce((a, r) => a + r.v12, 0) || 1;
  const maxShare = Math.max(...list.map((r) => Math.max(r.share12, r.share2019)), 0.01);

  const total = periods.map((_, i) => list.reduce((a, r) => a + (Number(r.series[i]) || 0), 0));
  const startIdx = Math.max(0, total.findIndex((t) => t > 0));
  const series = list.map((r, i) => ({ code: r.c, name: r.n, colour: colourAt(i), values: r.series.slice(startIdx) }));

  const whoLabel = who === 'visitors' ? 'visitors' : 'returning residents';

  root.innerHTML = `
    <div class="view-head">
      <h2>How long they stay</h2>
      <p>
        The ${gloss('lengthOfStay', 'length of stay')} ${escapeHtml(whoLabel)} intend, from under a week to
        almost a year. Most short-term travel is brief — but the long tail (students, working holidaymakers)
        is where a lot of the economic weight sits.
      </p>
    </div>

    <div class="view-controls">
      <div class="segmented" role="tablist" aria-label="Traveller">
        ${seg('stayWho', 'visitors', who, 'Visitors arriving')}
        ${seg('stayWho', 'returns', who, 'Residents returning')}
      </div>
      <span class="control-note">Bands run shortest (teal) to longest (magenta) intended stay.</span>
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h3>Distribution now, vs 2019</h3>
        <p class="panel-sub">Share of ${escapeHtml(whoLabel)} in each stay band — last 12 months (filled) against 2019 (tick).</p>
        <div class="bar-list">
          ${list.map((r, i) => `
            <div class="bar-row" data-tip="${escapeHtml(r.n)}: ${escapeHtml(formatPercent(r.share12, 1))} now (${escapeHtml(formatNumber(r.v12))}), ${escapeHtml(formatPercent(r.share2019, 1))} in 2019">
              <span class="bar-label">${escapeHtml(r.n)}</span>
              <span class="bar-track">
                <span class="bar-fill" style="width:${(r.share12 / maxShare * 100).toFixed(1)}%;background:${colourAt(i)}"></span>
                <span class="track-100-mark" style="left:${(r.share2019 / maxShare * 100).toFixed(1)}%"></span>
              </span>
              <span class="bar-value">${escapeHtml(formatPercent(r.share12, 0))}</span>
              <span class="bar-sub">${escapeHtml(formatCount(r.v12))}</span>
            </div>`).join('')}
        </div>
        <p class="view-foot">${escapeHtml(formatPercent((list[0]?.v12 ?? 0) / total12, 0))} of ${escapeHtml(whoLabel)} stay ${escapeHtml((list[0]?.n ?? '').toLowerCase())}.</p>
      </div>

      <div class="panel">
        <h3>Stay-length mix over time</h3>
        <p class="panel-sub">Composition of intended stay, each month normalised to 100%.</p>
        <div class="chart-scroll">
          ${stackedArea(series, periods.slice(startIdx), { width: 560, height: 300, percent: true })}
        </div>
        <div class="legend">
          ${list.map((r, i) => `<span class="legend-item"><span class="legend-swatch" style="background:${colourAt(i)}"></span>${escapeHtml(r.n)}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('.seg[data-key]').forEach((btn) =>
    btn.addEventListener('click', () => {
      ctx.setState(btn.dataset.key as string, btn.dataset.val as string);
      renderStay(root, data, ctx);
    }),
  );
}

function seg(key: string, val: string, current: string, label: string): string {
  return `<button class="seg ${val === current ? 'active' : ''}" data-key="${key}" data-val="${val}"
    role="tab" aria-selected="${val === current}">${label}</button>`;
}
