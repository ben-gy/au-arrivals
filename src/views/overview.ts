// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { covidBand } from '../components/drawer';
import { escapeHtml, formatCount, formatNumber, formatPercent, formatPeriodLong, formatRecovery, shortCountry, shortRegion } from '../format';
import { gloss } from '../glossary';
import { C_RETURN, C_VISITOR, reasonColour, regionColour } from '../palette';
import type { Dataset } from '../types';
import { barRow, lineChart } from '../utils/svg';
import type { ViewContext } from './types';

export function renderOverview(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const h = data.meta.headline;
  const topSources = data.countries.slice(0, 10);
  const maxSource = topSources[0]?.v12 ?? 1;
  const regions = [...data.regions].sort((a, b) => b.v12 - a.v12);
  const maxRegion = regions[0]?.v12 ?? 1;
  const totalRegion = regions.reduce((a, r) => a + r.v12, 0) || 1;
  const reasons = data.reasons.visitors.slice(0, 6);
  const maxReason = reasons[0]?.v12 ?? 1;

  root.innerHTML = `
    <div class="view-head">
      <h2>Fifty years of arrivals to Australia</h2>
      <p>
        Every month, millions of people cross Australia's border for a short stay — tourists, students,
        returning residents. This is who they are and where they come from, from ${escapeHtml(formatPeriodLong(data.meta.firstMonth))}
        to ${escapeHtml(formatPeriodLong(data.meta.latestMonth))}. And it is the story of the
        ${gloss('oad', 'one month the border effectively closed')}.
      </p>
    </div>

    <div class="hero-cliff">
      <div class="hero-figure">
        <span class="hero-big mono">${escapeHtml(formatNumber(h.troughValue))}</span>
        <span class="hero-cap">${gloss('visitorArriving', 'visitors')} arrived in ${escapeHtml(monthLabel(h.troughMonth))}</span>
      </div>
      <p class="hero-text">
        From a pre-pandemic peak of <strong>${escapeHtml(formatNumber(h.peakValue))}</strong> in
        ${escapeHtml(monthLabel(h.peakMonth))}, short-term visitor arrivals fell
        <strong>${escapeHtml(formatPercent(h.troughDrop ?? 0, 1))}</strong> to almost nothing when the
        international border shut. Today they are back to
        <strong>${escapeHtml(formatRecovery(h.recovery12))} of their 2019 level</strong>.
        <button class="text-link" data-goto="recovery">See the whole curve →</button>
      </p>
    </div>

    <div class="stat-strip">
      ${statTile(gloss('visitorArriving', 'Visitors') + `, ${monthLabel(h.latestMonth)}`, formatNumber(h.latestVisitors), yoyLabel(h.visYoy))}
      ${statTile('Visitors, last 12 months', formatCount(h.visitors12), 'people arriving short-term')}
      ${statTile(gloss('recovery', 'Recovery vs 2019'), formatRecovery(h.recovery12), 'of the last full pre-COVID year')}
      ${statTile('Largest source', h.topSource ? shortCountry(h.topSource.n) : '—',
        h.topSource ? `${formatPercent(h.topSource.share, 1)} of all arrivals` : '', true)}
    </div>

    <div class="panel-grid">
      <div class="panel">
        <h3>Top source countries</h3>
        <p class="panel-sub">Short-term visitor arrivals, last 12 months. Click any country for its full record.</p>
        <div class="bar-list">
          ${topSources.map((c) => `
            <div class="bar-row clickable" data-open-country="${escapeHtml(c.c)}" tabindex="0" role="button"
              data-tip="${escapeHtml(shortCountry(c.n))}: ${escapeHtml(formatNumber(c.v12))} visitors (${escapeHtml(formatPercent(c.vShare, 1))}), ${escapeHtml(formatRecovery(c.vRecovery))} of 2019">
              <span class="bar-label"><span class="rank-swatch" style="background:${regionColour(c.region)}"></span>${escapeHtml(shortCountry(c.n))}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${((c.v12 / maxSource) * 100).toFixed(1)}%;background:${C_VISITOR}"></span></span>
              <span class="bar-value">${escapeHtml(formatCount(c.v12))}</span>
              <span class="bar-sub">${escapeHtml(formatRecovery(c.vRecovery))}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <h3>Where in the world</h3>
        <p class="panel-sub">Visitors by region of residence, last 12 months.</p>
        <div class="bar-list">
          ${regions.map((r) => barRow(shortRegion(r.n), r.v12, maxRegion, {
            colour: regionColour(r.c),
            sub: formatPercent(r.v12 / totalRegion, 0),
            tip: `${shortRegion(r.n)}: ${formatNumber(r.v12)} visitors, ${formatPercent(r.v12 / totalRegion, 1)} of arrivals`,
          })).join('')}
        </div>
        <p class="view-foot"><button class="text-link" data-goto="map">Open the world map →</button></p>
      </div>

      <div class="panel">
        <h3>Why they come</h3>
        <p class="panel-sub">${gloss('reasonForJourney', 'Main reason')} visitors give, last 12 months.</p>
        <div class="bar-list">
          ${reasons.map((r) => barRow(r.n, r.v12, maxReason, {
            colour: reasonColour(r.c),
            sub: formatPercent(r.share12, 0),
            tip: `${r.n}: ${formatNumber(r.v12)} (${formatPercent(r.share12, 1)} of visitors)`,
          })).join('')}
        </div>
        <p class="view-foot"><button class="text-link" data-goto="reasons">Break it down over time →</button></p>
      </div>

      <div class="panel">
        <h3>Both directions</h3>
        <p class="panel-sub">Visitors arriving vs Australian residents returning from short trips, monthly.</p>
        <div class="chart-scroll">
          ${lineChart(
            [
              { values: data.national.visitors, colour: C_VISITOR, label: 'Visitors arriving' },
              { values: data.national.returns, colour: C_RETURN, label: 'Residents returning' },
            ],
            data.national.periods,
            { width: 560, height: 220, minZero: true, bands: covidBand(data.national.periods) },
          )}
        </div>
        <div class="legend">
          <span class="legend-item"><span class="legend-line" style="background:${C_VISITOR}"></span>Visitors arriving</span>
          <span class="legend-item"><span class="legend-line" style="background:${C_RETURN}"></span>Residents returning</span>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('[data-open-country]').forEach((el) => {
    const go = () => ctx.openCountry(el.dataset.openCountry as string);
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  root.querySelectorAll<HTMLElement>('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => ctx.goTo(el.dataset.goto as string)),
  );
}

function statTile(label: string, value: string, sub = '', small = false): string {
  return `<div class="stat">
    <span class="stat-label">${label}</span>
    <span class="stat-value${small ? ' small' : ''}">${escapeHtml(value)}</span>
    ${sub ? `<span class="stat-sub">${escapeHtml(sub)}</span>` : ''}
  </div>`;
}

function monthLabel(period: string | null): string {
  return period ? formatPeriodLong(period) : '—';
}

function yoyLabel(yoy: number | null): string {
  if (yoy === null) return '';
  const pct = Math.round(yoy * 100);
  if (pct === 0) return 'about the same as a year earlier';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% on a year earlier`;
}
