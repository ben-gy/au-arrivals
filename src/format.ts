// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
/** Formatting helpers. Every value in this app is a count of people (arrivals). */

/** 1234567 → "1.23m"; 45300 → "45,300". Compact for axes/tiles. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}m`;
  if (abs >= 10_000) return `${sign}${(abs / 1000).toFixed(0)}k`;
  return `${sign}${abs.toLocaleString('en-AU')}`;
}

/** Full grouped integer, for precise readouts. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-AU');
}

export function formatPercent(fraction: number | null | undefined, decimals = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Growth/change rate where the sign carries the meaning. */
export function formatChange(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const abs = Math.abs(pct);
  return `${sign}${abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)}%`;
}

/** Recovery ratio (1.0 = back to 2019) → "97% of 2019". */
export function formatRecovery(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  return `${Math.round(ratio * 100)}%`;
}

/** '2026-05' → 'May 2026' */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
  return `${month} ${y}`;
}

export function formatPeriodLong(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-AU', { month: 'long', timeZone: 'UTC' });
  return `${month} ${y}`;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ABS names are written for a yearbook; tidy them for a UI. */
export function shortCountry(name: string): string {
  return name
    .replace(/,?\s*Channel Islands.*/i, '')
    .replace(/UK, CIs & IOM/i, 'United Kingdom')
    .replace(/Korea, South/i, 'South Korea')
    .replace(/Russian Federation/i, 'Russia')
    .replace(/United States of America/i, 'United States')
    .replace(/\s*\(SAR of China\)/i, '')
    .trim();
}

/** Region label without the leading "Total ". */
export function shortRegion(name: string): string {
  return name.replace(/^Total\s+/i, '').trim();
}

/** Stable slug for hash links. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
