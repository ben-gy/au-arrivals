// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, formatPeriodLong } from '../format';
import type { Meta } from '../types';

/** About / methodology modal, opened from the header ? button. */
export function mountAbout(meta: Meta): { open: () => void; close: () => void } {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'About this site');
  document.body.append(overlay, modal);

  modal.innerHTML = `
    <button class="modal-close" aria-label="Close">×</button>
    <h2>About Overseas Arrivals</h2>
    <p>
      This site charts <strong>short-term overseas arrivals to Australia</strong> — people who live
      abroad arriving for a stay of less than a year, and Australian residents coming home from a short
      trip. It covers ${meta.counts.months} months, from ${escapeHtml(formatPeriodLong(meta.firstMonth))}
      to ${escapeHtml(formatPeriodLong(meta.latestMonth))}, across ${meta.counts.countries} reported
      countries of residence.
    </p>

    <h3>What the data is</h3>
    <p>
      Every figure comes from the ABS <em>Overseas Arrivals and Departures</em> release — specifically the
      <code>OAD_COUNTRY</code> and <code>OAD_REASON</code> data cubes, pulled from the ABS Data API. It counts
      <strong>border crossings, not people</strong>: someone who visits twice in a year is counted twice.
      "Visitors" are classified by their country of residence, not their nationality.
    </p>
    <p>
      Counts are the <strong>original (not seasonally adjusted) series</strong>, so the natural rhythm of the
      travel year — a December–January peak, a mid-year trough — stays visible. For privacy the ABS
      <strong>randomly rounds every count to the nearest 10</strong>, which is why small components may not
      sum exactly to their totals.
    </p>

    <h3>How it's built</h3>
    <p>
      A dependency-free pipeline fetches the ABS cubes each month and reshapes them into the JSON this page
      reads. Two reconciliation checks guard the parse: the total arrivals published in the country cube and
      the reason cube must match <em>exactly</em> every month (they are the same population), and each
      continent's member countries must sum to its published subtotal within rounding tolerance. The world
      map uses Natural Earth boundaries; only the ${meta.counts.mappedCountries} countries the ABS breaks out
      individually are shaded — the rest of each region sits in an "Other" group with no single polygon.
    </p>

    <h3>Caveats</h3>
    <ul>
      <li>Short-term only. Permanent and long-term migration is a separate ABS series and is not shown here.</li>
      <li>Before about 2003 the ABS listed fewer individual countries, so early history is sparser for smaller markets. National totals are complete throughout.</li>
      <li>"Recovery vs 2019" compares the trailing 12 months to the same calendar months of 2019, the last full pre-pandemic year.</li>
      <li>Updated monthly, roughly five weeks after each reference month. Latest data: ${escapeHtml(formatPeriodLong(meta.latestMonth))}.</li>
    </ul>

    <p class="modal-source">Source: ${escapeHtml(meta.source)}. Data © the Commonwealth of Australia (ABS), CC BY 4.0.</p>
  `;

  const close = (): void => { overlay.classList.remove('open'); modal.classList.remove('open'); };
  const open = (): void => {
    overlay.classList.add('open');
    modal.classList.add('open');
    (modal.querySelector('.modal-close') as HTMLElement)?.focus();
  };
  modal.querySelector('.modal-close')?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close };
}
