// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml, formatCount, formatNumber, formatPeriod } from '../format';

export type Fmt = (v: number) => string;

export interface Series {
  values: (number | null)[];
  colour: string;
  label: string;
  dash?: boolean;
}

export interface Band {
  from: number; // index into periods
  to: number;
  label: string;
}

/** Compact sparkline over a nullable series. */
export function sparkline(
  values: (number | null)[],
  opts: { width?: number; height?: number; colour?: string } = {},
): string {
  const w = opts.width ?? 104;
  const h = opts.height ?? 24;
  const colour = opts.colour ?? 'var(--c-visitor)';
  const clean = values.map((v) => (Number.isFinite(v as number) ? (v as number) : null));
  const nums = clean.filter((v): v is number => v !== null);
  if (nums.length < 2) return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const max = Math.max(...nums);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const step = w / (clean.length - 1);
  const pts: string[] = [];
  clean.forEach((v, i) => {
    if (v === null) return;
    pts.push(`${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`);
  });
  const lastI = clean.length - 1;
  const lastV = nums[nums.length - 1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
    role="img" aria-label="Trend, latest ${escapeHtml(formatCount(lastV))}">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${colour}" stroke-width="1.4"
      stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${(lastI * step).toFixed(1)}" cy="${(h - ((lastV - min) / span) * h).toFixed(1)}" r="1.9" fill="${colour}" />
  </svg>`;
}

/** Horizontal ranked bar with hover tooltip. */
export function barRow(
  label: string,
  value: number,
  max: number,
  opts: { colour?: string; tip?: string; sub?: string; fmt?: Fmt } = {},
): string {
  const fmt = opts.fmt ?? formatCount;
  const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  return `<div class="bar-row" data-tip="${escapeHtml(opts.tip ?? `${label}: ${fmt(value)}`)}">
    <span class="bar-label">${escapeHtml(label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(2)}%;background:${opts.colour ?? 'var(--c-visitor)'}"></span></span>
    <span class="bar-value">${escapeHtml(fmt(value))}</span>
    ${opts.sub ? `<span class="bar-sub">${escapeHtml(opts.sub)}</span>` : ''}
  </div>`;
}

function yearTicks(periods: string[]): number[] {
  const idx: number[] = [];
  let lastYear = '';
  const span = periods.length;
  const everyN = span > 480 ? 10 : span > 240 ? 5 : span > 60 ? 2 : 1;
  periods.forEach((p, i) => {
    const y = p.slice(0, 4);
    if (y !== lastYear && Number(y) % everyN === 0 && p.slice(5) === '01') { idx.push(i); lastYear = y; }
  });
  return idx;
}

/**
 * Multi-series line chart over a monthly series, with optional shaded event bands
 * (e.g. the COVID border closure) and a full-height hover target per period.
 */
export function lineChart(
  seriesList: Series[],
  periods: string[],
  opts: { width?: number; height?: number; fmt?: Fmt; bands?: Band[]; minZero?: boolean } = {},
): string {
  const w = opts.width ?? 900;
  const h = opts.height ?? 340;
  const fmt = opts.fmt ?? formatCount;
  const pad = { t: 14, r: 16, b: 26, l: 56 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const all = seriesList.flatMap((s) => s.values).filter((v): v is number => Number.isFinite(v as number));
  if (!all.length) return '';
  const max = Math.max(...all);
  const min = opts.minZero ? 0 : Math.min(...all, 0);
  const span = max - min || 1;
  const n = periods.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - min) / span) * ih;

  const ticks = [min, min + span / 2, max];
  const grid = ticks.map((v) =>
    `<line x1="${pad.l}" y1="${y(v).toFixed(1)}" x2="${w - pad.r}" y2="${y(v).toFixed(1)}" stroke="var(--border-subtle)" />
     <text x="${pad.l - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="axis-label">${escapeHtml(fmt(v))}</text>`,
  ).join('');

  const bands = (opts.bands ?? []).map((b) =>
    `<rect x="${x(b.from).toFixed(1)}" y="${pad.t}" width="${(x(b.to) - x(b.from)).toFixed(1)}" height="${ih}"
       fill="var(--covid-band)" />
     <text x="${((x(b.from) + x(b.to)) / 2).toFixed(1)}" y="${(pad.t + 12).toFixed(1)}" text-anchor="middle"
       class="annotation-label">${escapeHtml(b.label)}</text>`,
  ).join('');

  const xt = yearTicks(periods).map((i) =>
    `<text x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="axis-label">${periods[i].slice(0, 4)}</text>`,
  ).join('');

  const lines = seriesList.map((s) => {
    // Break the polyline at nulls so a gap isn't drawn as a straight line.
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return `<path d="${d}" fill="none" stroke="${s.colour}" stroke-width="1.7" stroke-linejoin="round"
      ${s.dash ? 'stroke-dasharray="4 3"' : ''} />`;
  }).join('');

  const hit = periods.map((p, i) => {
    const bw = iw / Math.max(1, n - 1);
    const tip = seriesList
      .map((s) => `${s.label}: ${s.values[i] === null ? '—' : formatNumber(s.values[i] as number)}`)
      .join(' · ');
    return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${pad.t}" width="${Math.max(bw, 1).toFixed(1)}" height="${ih}"
      fill="transparent" class="chart-hit" data-tip="${escapeHtml(formatPeriod(p))} — ${escapeHtml(tip)}" />`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="line-chart" preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="${escapeHtml(seriesList.map((s) => s.label).join(' and '))} over time">
    ${bands}${grid}${lines}${hit}${xt}
  </svg>`;
}

/**
 * Stacked area over time. `percent` normalises each column to 100%. Every band
 * gets a per-period hover tip through the shared [data-tip] util.
 */
export function stackedArea(
  seriesList: Array<{ code: string; name: string; colour: string; values: (number | null)[] }>,
  periods: string[],
  opts: { width?: number; height?: number; percent?: boolean; fmt?: Fmt } = {},
): string {
  const w = opts.width ?? 900;
  const h = opts.height ?? 340;
  const fmt = opts.fmt ?? formatCount;
  const pad = { t: 14, r: 16, b: 26, l: 52 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const n = periods.length;

  // Column totals for normalisation / y-scale.
  const totals = periods.map((_, i) => seriesList.reduce((a, s) => a + (Number(s.values[i]) || 0), 0));
  const maxTotal = opts.percent ? 1 : Math.max(...totals, 1);
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / maxTotal) * ih;

  // Build stacked band paths bottom-up.
  const cumulative = periods.map(() => 0);
  const paths = seriesList.map((s) => {
    const top: string[] = [];
    const bottom: string[] = [];
    periods.forEach((_, i) => {
      const total = totals[i] || 1;
      const val = Number(s.values[i]) || 0;
      const frac = opts.percent ? val / total : val;
      const y0 = cumulative[i];
      const y1 = y0 + frac;
      top.push(`${x(i).toFixed(1)},${y(y1).toFixed(1)}`);
      bottom.push(`${x(i).toFixed(1)},${y(y0).toFixed(1)}`);
      cumulative[i] = y1;
    });
    return `<polygon points="${top.join(' ')} ${bottom.reverse().join(' ')}" fill="${s.colour}"
      fill-opacity="0.9" stroke="#fff" stroke-width="0.3" />`;
  }).join('');

  const ticks = opts.percent ? [0, 0.5, 1] : [0, maxTotal / 2, maxTotal];
  const grid = ticks.map((v) =>
    `<line x1="${pad.l}" y1="${y(v).toFixed(1)}" x2="${w - pad.r}" y2="${y(v).toFixed(1)}" stroke="var(--border-subtle)" />
     <text x="${pad.l - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="axis-label">${escapeHtml(opts.percent ? `${(v * 100).toFixed(0)}%` : fmt(v))}</text>`,
  ).join('');

  const xt = yearTicks(periods).map((i) =>
    `<text x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle" class="axis-label">${periods[i].slice(0, 4)}</text>`,
  ).join('');

  const hit = periods.map((p, i) => {
    const bw = iw / Math.max(1, n - 1);
    const total = totals[i] || 1;
    const parts = seriesList
      .filter((s) => Number(s.values[i]) > 0)
      .map((s) => `${s.name}: ${opts.percent ? `${((Number(s.values[i]) / total) * 100).toFixed(0)}%` : formatNumber(Number(s.values[i]))}`)
      .join(' · ');
    return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${pad.t}" width="${Math.max(bw, 1).toFixed(1)}" height="${ih}"
      fill="transparent" class="chart-hit" data-tip="${escapeHtml(formatPeriod(p))} — ${escapeHtml(parts)}" />`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="line-chart" preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="Composition over time">${grid}${paths}${hit}${xt}</svg>`;
}

export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max * 1.0001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
