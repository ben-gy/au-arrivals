import { describe, expect, it } from 'vitest';
import { linearBins, logBreaks, median, recoveryBreaks, recoverySet, rollingMean } from '../src/analysis';
import { clampViewBox, zoomViewBox } from '../src/utils/svgZoom';
import type { Country } from '../src/types';

describe('rollingMean', () => {
  it('averages the trailing window and nulls the ramp-up', () => {
    const r = rollingMean([1, 2, 3, 4], 2);
    expect(r[0]).toBeNull();
    expect(r[1]).toBe(1.5);
    expect(r[3]).toBe(3.5);
  });
  it('nulls a window that contains a gap', () => {
    const r = rollingMean([1, null, 3, 4], 2);
    expect(r[1]).toBeNull(); // window [1,null]
    expect(r[2]).toBeNull(); // window [null,3]
    expect(r[3]).toBe(3.5);
  });
});

describe('linearBins (histogram layout)', () => {
  const values = [0.1, 0.5, 0.9, 1.0, 1.5, 1.9, 2.0];
  const bins = linearBins(values, 0, 2, 16);

  it('produces exactly the requested number of bins', () => {
    expect(bins).toHaveLength(16);
  });
  it('has flush, non-overlapping, ascending boundaries covering [lo,hi]', () => {
    expect(bins[0].lo).toBeCloseTo(0, 9);
    expect(bins[bins.length - 1].hi).toBeCloseTo(2, 9);
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].lo).toBeCloseTo(bins[i - 1].hi, 9); // flush
      expect(bins[i].lo).toBeGreaterThan(bins[i - 1].lo); // ascending
    }
  });
  it('assigns every value to exactly one bin (counts sum to input)', () => {
    const total = bins.reduce((a, b) => a + b.n, 0);
    expect(total).toBe(values.length);
    const items = bins.flatMap((b) => b.items);
    expect(new Set(items).size).toBe(values.length); // no double-count
  });
});

describe('logBreaks', () => {
  it('returns ramp-1 ascending breaks spanning the data', () => {
    const b = logBreaks([1, 10, 100, 1000], 5);
    expect(b).toHaveLength(4);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
  });
  it('ignores non-positive values', () => {
    expect(logBreaks([0, -5], 4)).toEqual([]);
  });
});

describe('recoveryBreaks', () => {
  it('is ascending and straddles parity (1.0)', () => {
    const b = recoveryBreaks();
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
    expect(Math.min(...b)).toBeLessThan(1);
    expect(Math.max(...b)).toBeGreaterThan(1);
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('recoverySet', () => {
  const mk = (c: string, v12: number, rec: number | null): Country => ({
    c, n: c, iso3: null, region: null, regionName: '', v12, r12: 0, vShare: 0,
    vRecovery: rec, rRecovery: null, vSeries: [], rSeries: [], rank: 0,
  });
  it('keeps only sizeable markets with a 2019 baseline', () => {
    const set = recoverySet([mk('a', 100000, 1.1), mk('b', 100, 0.9), mk('c', 100000, null)], 50000);
    expect(set.map((x) => x.c)).toEqual(['a']);
  });
});

describe('svgZoom viewBox math (positional)', () => {
  const base = { x: 0, y: 0, w: 100, h: 100 };
  it('zooms in about a focus point and stays within bounds', () => {
    const vb = zoomViewBox(base, base, 2, 50, 50, 1, 8);
    expect(vb.w).toBeCloseTo(50, 6);
    expect(vb.x).toBeGreaterThanOrEqual(0);
    expect(vb.x + vb.w).toBeLessThanOrEqual(100.0001);
  });
  it('never zooms out past the base (clamps to minScale)', () => {
    const vb = zoomViewBox(base, base, 0.25, 50, 50, 1, 8);
    expect(vb.w).toBeLessThanOrEqual(100);
  });
  it('clamps a panned viewBox inside the base', () => {
    const vb = clampViewBox({ x: 200, y: 200, w: 50, h: 50 }, base);
    expect(vb.x).toBe(50);
    expect(vb.y).toBe(50);
  });
});
