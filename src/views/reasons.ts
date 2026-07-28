// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, shortCountry } from '../format';
import { gloss } from '../glossary';
import { reasonColour } from '../palette';
import type { Breakdown, Dataset } from '../types';
import { stackedArea } from '../utils/svg';
import type { ViewContext } from './types';

type Who = 'visitors' | 'returns';
type Mode = 'volume' | 'share';

export function renderReasons(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const who = (ctx.getState('reasonWho', 'visitors') as Who);
  const mode = (ctx.getState('reasonMode', 'share') as Mode);
  const list = data.reasons[who];
  const periods = data.reasons.periods;

  // Trim to the period where reason detail begins (early history has none).
  const total = periods.map((_, i) => list.reduce((a, r) => a + (Number(r.series[i]) || 0), 0));
  const startIdx = Math.max(0, total.findIndex((t) => t > 0));
  const p2 = periods.slice(startIdx);
  const series = list.map((r) => ({ code: r.c, name: r.n, colour: reasonColour(r.c), values: r.series.slice(startIdx) }));

  const whoLabel = who === 'visitors' ? 'visitors arriving' : 'residents returning';

  root.innerHTML = `
    <div class="view-head">
      <h2>Why they come</h2>
      <p>
        The ${gloss('reasonForJourney', 'reason')} ${escapeHtml(whoLabel)} give at the border — holiday, visiting
        friends and relatives, business, a conference, education or employment. Watch the mix shift across the
        decades and through the pandemic.
      </p>
    </div>

    <div class="view-controls">
      <div class="segmented" role="tablist" aria-label="Traveller">
        ${seg('reasonWho', 'visitors', who, 'Visitors arriving')}
        ${seg('reasonWho', 'returns', who, 'Residents returning')}
      </div>
      <div class="segmented" role="tablist" aria-label="Measure">
        ${seg('reasonMode', 'share', mode, 'Share (%)')}
        ${seg('reasonMode', 'volume', mode, 'Volume')}
      </div>
      <span class="control-note">
        ${mode === 'share'
          ? 'Each month normalised to 100% — the composition, not the volume.'
          : 'Stacked monthly counts — the total height is all arrivals.'}
      </span>
    </div>

    <div class="chart-scroll">
      ${stackedArea(series, p2, { width: 1000, height: 380, percent: mode === 'share' })}
    </div>
    <div class="legend">
      ${list.map((r) => `<span class="legend-item"><span class="legend-swatch" style="background:${reasonColour(r.c)}"></span>${escapeHtml(r.n)}</span>`).join('')}
    </div>

    <div class="panel" style="margin-top:var(--space-2xl)">
      <h3>Reason mix: now vs 2019</h3>
      <p class="panel-sub">Share of ${escapeHtml(whoLabel)} by reason — the last 12 months against the same measure in 2019.</p>
      <div class="dumbbell-list">
        ${list.map((r) => dumbbell(r)).join('')}
      </div>
      <p class="view-foot">Each row runs from the 2019 share (hollow) to today’s share (filled). A longer bar means a bigger change.</p>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('.seg[data-key]').forEach((btn) =>
    btn.addEventListener('click', () => {
      ctx.setState(btn.dataset.key as string, btn.dataset.val as string);
      renderReasons(root, data, ctx);
    }),
  );
}

function dumbbell(r: Breakdown): string {
  const a = r.share2019 * 100;
  const b = r.share12 * 100;
  const scale = 55; // max ~55% for holiday; keep within track
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const delta = b - a;
  return `<div class="dumbbell" data-tip="${escapeHtml(shortCountry(r.n))}: 2019 ${a.toFixed(1)}% → now ${b.toFixed(1)}% (${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts)">
    <span class="db-label">${escapeHtml(r.n)}</span>
    <span class="db-track">
      <span class="db-bar" style="left:${(lo / scale * 100).toFixed(1)}%;width:${((hi - lo) / scale * 100).toFixed(1)}%;background:${reasonColour(r.c)}"></span>
      <span class="db-dot hollow" style="left:${(a / scale * 100).toFixed(1)}%" title="2019"></span>
      <span class="db-dot" style="left:${(b / scale * 100).toFixed(1)}%;background:${reasonColour(r.c)}" title="now"></span>
    </span>
    <span class="db-value mono">${b.toFixed(1)}%</span>
    <span class="db-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}</span>
  </div>`;
}

function seg(key: string, val: string, current: string, label: string): string {
  return `<button class="seg ${val === current ? 'active' : ''}" data-key="${key}" data-val="${val}"
    role="tab" aria-selected="${val === current}">${label}</button>`;
}
