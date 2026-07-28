// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, formatCount, formatNumber, formatPercent, formatPeriod, formatRecovery, shortCountry, shortRegion } from '../format';
import { gloss } from '../glossary';
import { C_RETURN, C_VISITOR, regionColour } from '../palette';
import type { Dataset } from '../types';
import { lineChart } from '../utils/svg';

/**
 * Right-hand slide-in panel for one country. Hash-linkable (`#c=6101`).
 *
 * The panel is DETACHED from the DOM whenever it is closed — not merely
 * translated off-screen. A closed off-canvas panel at translateX(100%) is still a
 * real box on iOS Safari and silently scrolls the page sideways; removing it from
 * the document is the only reliable fix (overflow:clip does not catch it).
 */
export function mountDrawer(data: Dataset): {
  openCountry: (code: string) => void;
  close: () => void;
  isOpen: () => boolean;
} {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const panel = document.createElement('aside');
  panel.className = 'drawer';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Country details');

  let open = false;
  let removeTimer: ReturnType<typeof setTimeout> | undefined;

  const close = (): void => {
    if (!open) return;
    open = false;
    overlay.classList.remove('open');
    panel.classList.remove('open');
    if (location.hash.startsWith('#c=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    removeTimer = setTimeout(() => {
      overlay.remove();
      panel.remove();
    }, 280);
  };

  const attach = (): void => {
    if (removeTimer) clearTimeout(removeTimer);
    if (!overlay.isConnected) document.body.append(overlay, panel);
  };

  const render = (html: string, hash: string): void => {
    attach();
    panel.innerHTML = `<button class="modal-close" aria-label="Close">×</button>${html}`;
    panel.querySelector('.modal-close')?.addEventListener('click', close);
    // Force layout so the freshly-attached panel transitions in rather than snapping.
    void panel.offsetWidth;
    overlay.classList.add('open');
    panel.classList.add('open');
    panel.scrollTop = 0;
    open = true;
    (panel.querySelector('.modal-close') as HTMLElement)?.focus();
    history.replaceState(null, '', `#${hash}`);
    panel.querySelectorAll<HTMLElement>('[data-open-country]').forEach((el) =>
      el.addEventListener('click', () => openCountry(el.dataset.openCountry as string)),
    );
  };

  function openCountry(code: string): void {
    const c = data.byCode.get(code);
    if (!c) return;
    const periods = data.meta.periods;
    const firstV = c.vSeries.findIndex((v) => v !== null && v > 0);
    const peakV = Math.max(...c.vSeries.map((v) => (v ?? 0) as number));
    const peakIdx = c.vSeries.findIndex((v) => v === peakV);
    const returnRank = [...data.countries].sort((a, b) => b.r12 - a.r12).findIndex((x) => x.c === code) + 1;

    render(
      `
      <header class="dd-head">
        <span class="dd-kind" style="color:${regionColour(c.region)}">${escapeHtml(shortRegion(c.regionName))}</span>
        <h2>${escapeHtml(shortCountry(c.n))}</h2>
        <p class="dd-sub">#${c.rank} source of visitors · ${escapeHtml(formatPercent(c.vShare, 1))} of all arrivals</p>
      </header>

      <div class="dd-stats">
        <div class="dd-stat"><span>${gloss('visitorArriving', 'Visitors')} (12 mo)</span>
          <strong style="color:${C_VISITOR}">${escapeHtml(formatCount(c.v12))}</strong></div>
        <div class="dd-stat"><span>${gloss('recovery', 'Recovery')}</span>
          <strong class="${(c.vRecovery ?? 0) >= 1 ? 'pos' : 'neg'}">${escapeHtml(formatRecovery(c.vRecovery))}</strong>
          <em>of 2019</em></div>
        <div class="dd-stat"><span>${gloss('residentReturning', 'Residents back')} (12 mo)</span>
          <strong style="color:${C_RETURN}">${escapeHtml(formatCount(c.r12))}</strong>
          ${returnRank > 0 ? `<em>#${returnRank}</em>` : ''}</div>
      </div>

      <section class="dd-section">
        <h3>Arrivals over ${data.meta.counts.months} months</h3>
        ${lineChart(
          [
            { values: c.vSeries, colour: C_VISITOR, label: 'Visitors arriving' },
            { values: c.rSeries, colour: C_RETURN, label: 'Residents returning' },
          ],
          periods,
          { width: 560, height: 200, minZero: true, bands: covidBand(periods) },
        )}
        <p class="dd-note">Monthly ${gloss('original', 'original')} counts. Hover for the figure at any month.</p>
      </section>

      <section class="dd-section">
        <h3>Key figures</h3>
        <ul class="event-list">
          <li>First reported here in <strong>${firstV >= 0 ? escapeHtml(formatPeriod(periods[firstV])) : '—'}</strong>.</li>
          <li>Busiest month on record: <strong>${peakIdx >= 0 ? escapeHtml(formatPeriod(periods[peakIdx])) : '—'}</strong>
              with <strong>${escapeHtml(formatNumber(peakV))}</strong> visitors.</li>
          <li>Ranked <strong>#${c.rank}</strong> of ${data.meta.counts.countries} reported source countries by visitors,
              and <strong>${returnRank > 0 ? `#${returnRank}` : '—'}</strong> as a destination for returning residents.</li>
        </ul>
      </section>
    `,
      `c=${code}`,
    );
  }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) close();
  });

  return { openCountry, close, isOpen: () => open };
}

/** COVID border-closure band [Feb 2020 → Feb 2022], as period indices. */
export function covidBand(periods: string[]): Array<{ from: number; to: number; label: string }> {
  const from = periods.indexOf('2020-02');
  const to = periods.indexOf('2022-02');
  if (from < 0 || to < 0) return [];
  return [{ from, to, label: 'Border closed' }];
}
