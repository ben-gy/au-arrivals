// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { formatCount, formatPercent, formatRecovery, shortCountry } from './format';
import type { Country, Dataset } from './types';

export type Severity = 'info' | 'warn' | 'alert';

export interface Insight {
  severity: Severity;
  title: string;
  body: string;
  view?: string;
  country?: string;
}

/** Trailing moving average of a nullable series; result aligned to input. */
export function rollingMean(values: (number | null)[], window = 12): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) { out.push(null); continue; }
    let sum = 0;
    let ok = true;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (v === null || v === undefined || !Number.isFinite(v)) { ok = false; break; }
      sum += v;
    }
    out.push(ok ? sum / window : null);
  }
  return out;
}

/** Log-spaced breaks for a sequential ramp (arrivals are brutally skewed). */
export function logBreaks(values: number[], buckets: number): number[] {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!positive.length) return [];
  const min = Math.log10(Math.min(...positive));
  const max = Math.log10(Math.max(...positive));
  const span = max - min || 1;
  const breaks: number[] = [];
  for (let i = 1; i < buckets; i++) breaks.push(10 ** (min + (span * i) / buckets));
  return breaks;
}

/** Fixed breaks around 1.0 for the recovery diverging ramp. */
export function recoveryBreaks(): number[] {
  // 7-colour ramp → 6 breaks. Centre band straddles 1.0 (parity with 2019).
  return [0.4, 0.7, 0.95, 1.05, 1.3, 1.7];
}

export function median(values: number[]): number {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Linear bins over [lo, hi]. */
export function linearBins(
  values: number[],
  lo: number,
  hi: number,
  binCount = 16,
): Array<{ lo: number; hi: number; n: number; items: number[] }> {
  const span = hi - lo || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    lo: lo + (span * i) / binCount,
    hi: lo + (span * (i + 1)) / binCount,
    n: 0,
    items: [] as number[],
  }));
  values.forEach((v, idx) => {
    if (!Number.isFinite(v)) return;
    const b = Math.max(0, Math.min(binCount - 1, Math.floor(((v - lo) / span) * binCount)));
    bins[b].n++;
    bins[b].items.push(idx);
  });
  return bins;
}

/** Countries eligible for recovery comparison (a real 2019 baseline). */
export function recoverySet(countries: Country[], minV12 = 20000): Country[] {
  return countries.filter((c) => c.vRecovery !== null && c.v12 >= minV12);
}

/**
 * Auto-detected findings — each a claim the data supports on its own, so nothing
 * hand-narrated drifts out of date when the ABS revises.
 */
export function buildInsights(data: Dataset): Insight[] {
  const out: Insight[] = [];
  const { meta, countries } = data;
  const h = meta.headline;

  // 1. The COVID cliff — the headline of the whole dataset.
  if (h.troughValue !== null && h.peakMonth && h.troughMonth) {
    out.push({
      severity: 'alert',
      title: `Visitor arrivals fell ${formatPercent(h.troughDrop ?? 0, 1)} to just ${formatCount(h.troughValue)} in one month`,
      body:
        `From a pre-pandemic peak of ${formatCount(h.peakValue)} in ${mLabel(h.peakMonth)}, short-term ` +
        `visitor arrivals collapsed to ${h.troughValue.toLocaleString('en-AU')} in ${mLabel(h.troughMonth)} — ` +
        `when the international border was closed. It is the sharpest fall in the 50-year record by a wide margin.`,
      view: 'recovery',
    });
  }

  // 2. Where the recovery stands.
  if (h.recovery12 !== null) {
    out.push({
      severity: h.recovery12 >= 0.98 ? 'info' : 'warn',
      title: h.recovery12 >= 0.98
        ? `Visitor numbers are back to pre-COVID levels`
        : `Visitor numbers are still ${formatPercent(1 - h.recovery12, 0)} below 2019`,
      body:
        `The last 12 months brought ${formatCount(h.visitors12)} short-term visitors — ` +
        `${formatRecovery(h.recovery12)} of the same months in 2019. ` +
        (h.recovery12 >= 0.98 ? 'Australia has recovered the volume it lost.' : 'The gap is closing but not yet closed.'),
      view: 'recovery',
    });
  }

  // 3. Top source country.
  if (countries[0]) {
    const top = countries[0];
    out.push({
      severity: 'info',
      title: `${shortCountry(top.n)} is the single largest source of visitors`,
      body:
        `${shortCountry(top.n)} sent ${formatCount(top.v12)} visitors in the last 12 months — ` +
        `${formatPercent(top.vShare, 1)} of all arrivals, more than any other country.`,
      view: 'countries',
      country: top.c,
    });
  }

  // 4. Strongest laggard among big markets — recovered least.
  const laggards = recoverySet(countries, 80000).sort((a, b) => (a.vRecovery ?? 9) - (b.vRecovery ?? 9));
  if (laggards.length && (laggards[0].vRecovery ?? 1) < 0.85) {
    const l = laggards[0];
    out.push({
      severity: 'warn',
      title: `${shortCountry(l.n)} visitors are still only ${formatRecovery(l.vRecovery)} of 2019`,
      body:
        `Of the large source markets, ${shortCountry(l.n)} has recovered the least — ${formatCount(l.v12)} ` +
        `visitors over the last year, ${formatRecovery(l.vRecovery)} of its 2019 level. A market that has not ` +
        `bounced back the way the headline total has.`,
      view: 'countries',
      country: l.c,
    });
  }

  // 5. Strongest riser — recovered most / grown past 2019.
  const risers = recoverySet(countries, 60000).sort((a, b) => (b.vRecovery ?? 0) - (a.vRecovery ?? 0));
  if (risers.length && (risers[0].vRecovery ?? 0) > 1.1) {
    const r = risers[0];
    out.push({
      severity: 'info',
      title: `${shortCountry(r.n)} now sends ${formatRecovery(r.vRecovery)} of its 2019 visitors`,
      body:
        `${shortCountry(r.n)} has more than recovered — ${formatCount(r.v12)} visitors in the last year, ` +
        `${formatRecovery(r.vRecovery)} of 2019, the strongest rebound among sizeable markets.`,
      view: 'countries',
      country: r.c,
    });
  }

  // 6. Reason mix shift: holiday vs the rest.
  const holiday = data.reasons.visitors.find((r) => r.c === 'H');
  if (holiday && holiday.share2019 > 0) {
    const delta = holiday.share12 - holiday.share2019;
    out.push({
      severity: 'info',
      title: `Holidays are ${formatPercent(holiday.share12, 0)} of the reasons visitors give`,
      body:
        `Holiday travel makes up ${formatPercent(holiday.share12, 1)} of visitor arrivals today, ` +
        `${delta >= 0 ? 'up' : 'down'} from ${formatPercent(holiday.share2019, 1)} in 2019 — ` +
        `${delta >= 0 ? 'a bigger' : 'a smaller'} slice than before the pandemic. The balance is made up by ` +
        `visiting friends and relatives, business, education and employment.`,
      view: 'reasons',
    });
  }

  // 7. Visitors vs residents returning — which flow is bigger.
  const totalReturns = countries.reduce((a, c) => a + c.r12, 0);
  out.push({
    severity: 'info',
    title: totalReturns > h.visitors12
      ? `More Australians came home than visitors arrived`
      : `Visitor arrivals outnumber residents returning`,
    body:
      `Over the last 12 months ${formatCount(h.visitors12)} overseas visitors arrived, against ` +
      `${formatCount(totalReturns)} Australian residents returning from short trips abroad. ` +
      `The two flows track the same holiday seasons but respond differently to shocks.`,
    view: 'recovery',
  });

  return out;
}

function mLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-AU', { month: 'long', timeZone: 'UTC' });
  return `${month} ${y}`;
}

/** Attach a 1-based rank to a sorted list. */
export function ranked<T>(items: T[]): Array<T & { rank: number }> {
  return items.map((it, i) => ({ ...it, rank: i + 1 }));
}
