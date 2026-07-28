// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, formatNumber, formatPeriod } from '../format';
import { NO_DATA_COLOUR, RAMP_VISITORS } from '../palette';
import type { Dataset } from '../types';
import type { ViewContext } from './types';

type Scale = 'abs' | 'row';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderSeasonality(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const scale = (ctx.getState('seasonScale', 'abs') as Scale);
  const { periods, visitors } = data.national;

  // year → [12] values.
  const grid = new Map<number, (number | null)[]>();
  periods.forEach((p, i) => {
    const [y, m] = p.split('-').map(Number);
    if (!grid.has(y)) grid.set(y, Array(12).fill(null));
    (grid.get(y) as (number | null)[])[m - 1] = visitors[i];
  });
  const years = [...grid.keys()].sort((a, b) => b - a);

  const nums = visitors.filter((v): v is number => Number.isFinite(v as number) && (v as number) > 0);
  const logMin = Math.log10(Math.min(...nums));
  const logMax = Math.log10(Math.max(...nums));

  const colour = (v: number | null, rowMax: number): string => {
    if (v === null || !Number.isFinite(v)) return NO_DATA_COLOUR;
    let t: number;
    if (scale === 'row') t = rowMax > 0 ? v / rowMax : 0;
    else t = v > 0 ? (Math.log10(v) - logMin) / (logMax - logMin || 1) : 0;
    const idx = Math.max(0, Math.min(RAMP_VISITORS.length - 1, Math.floor(t * RAMP_VISITORS.length)));
    return v <= 0 ? RAMP_VISITORS[0] : RAMP_VISITORS[idx];
  };

  root.innerHTML = `
    <div class="view-head">
      <h2>The rhythm of the year</h2>
      <p>
        Arrivals have always pulsed with the seasons — a summer peak around December and January, a mid-year
        dip. Each cell is one month of visitor arrivals, darkest where most arrived. Read down a column to see
        a month across 50 years; read across a row to see one year’s shape. The pale band through 2020–2021 is
        the closed border.
      </p>
    </div>

    <div class="view-controls">
      <div class="segmented" role="tablist" aria-label="Colour scale">
        ${seg('seasonScale', 'abs', scale, 'Absolute (log)')}
        ${seg('seasonScale', 'row', scale, 'Within each year')}
      </div>
      <span class="control-note">
        ${scale === 'abs'
          ? 'One scale across all years, so the long-run growth and the COVID collapse are both visible.'
          : 'Each year scaled to its own busiest month, isolating the seasonal shape regardless of the overall level.'}
      </span>
    </div>

    <div class="heatmap-scroll">
      <table class="heatmap">
        <thead>
          <tr><th class="hm-corner">Year</th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${years.map((y) => {
            const rowVals = grid.get(y) as (number | null)[];
            const rowMax = Math.max(...rowVals.map((v) => (v ?? 0) as number), 1);
            return `<tr><th class="hm-year">${y}</th>${rowVals.map((v, mi) => {
              const bg = colour(v, rowMax);
              return `<td class="hm-cell" style="background:${bg}"
                data-tip="${escapeHtml(formatPeriod(`${y}-${String(mi + 1).padStart(2, '0')}`))}: ${v === null ? 'no data' : escapeHtml(formatNumber(v)) + ' visitors'}"></td>`;
            }).join('')}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="legend">
      <span>Fewer</span>
      <span class="legend-ramp">${RAMP_VISITORS.map((c) => `<span class="legend-swatch" style="background:${c}"></span>`).join('')}</span>
      <span>More visitors</span>
      <span class="legend-item" style="margin-left:auto"><span class="legend-swatch" style="background:${NO_DATA_COLOUR}"></span>No data</span>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('.seg[data-key]').forEach((btn) =>
    btn.addEventListener('click', () => {
      ctx.setState(btn.dataset.key as string, btn.dataset.val as string);
      renderSeasonality(root, data, ctx);
    }),
  );
}

function seg(key: string, val: string, current: string, label: string): string {
  return `<button class="seg ${val === current ? 'active' : ''}" data-key="${key}" data-val="${val}"
    role="tab" aria-selected="${val === current}">${label}</button>`;
}
