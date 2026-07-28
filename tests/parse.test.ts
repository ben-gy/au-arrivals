import { describe, expect, it } from 'vitest';
import {
  parseCsv, obsToCount, isRealCountry, isSubtotal, buildContinentGroups,
  reconcileContinents, reconcileCrossFlow, sumOver, densifyNullable, recoveryRatio, yearMonths,
} from '../pipeline/lib/parse.mjs';

describe('parseCsv', () => {
  it('parses a simple table into objects', () => {
    const rows = parseCsv('A,B\n1,2\n3,4\n');
    expect(rows).toEqual([{ A: '1', B: '2' }, { A: '3', B: '4' }]);
  });
  it('respects quoted commas (Korea, South)', () => {
    const rows = parseCsv('CODE,NAME\n6203,"Korea, South"\n');
    expect(rows[0].NAME).toBe('Korea, South');
  });
  it('skips short rows', () => {
    const rows = parseCsv('A,B,C\n1,2,3\n4,5\n');
    expect(rows).toHaveLength(1);
  });
});

describe('obsToCount', () => {
  it('parses integers', () => { expect(obsToCount('34820')).toBe(34820); });
  it('treats blank as not-published (null), never 0', () => {
    expect(obsToCount('')).toBeNull();
    expect(obsToCount('   ')).toBeNull();
    expect(obsToCount(undefined)).toBeNull();
  });
  it('rejects non-numeric', () => { expect(obsToCount('n.a.')).toBeNull(); });
});

describe('isRealCountry / isSubtotal', () => {
  it('accepts numeric member codes incl. "21"', () => {
    expect(isRealCountry('1201')).toBe(true);
    expect(isRealCountry('21')).toBe(true);
  });
  it('rejects subtotals, residuals and not-stated', () => {
    expect(isRealCountry('TOT')).toBe(false);
    expect(isRealCountry('TO6')).toBe(false);
    expect(isRealCountry('OT6')).toBe(false);
    expect(isRealCountry('NI')).toBe(false);
    expect(isRealCountry('0000')).toBe(false);
  });
  it('flags TOT and TOn as subtotals', () => {
    expect(isSubtotal('TOT')).toBe(true);
    expect(isSubtotal('TO3')).toBe(true);
    expect(isSubtotal('6101')).toBe(false);
  });
});

describe('buildContinentGroups', () => {
  const codes = ['TOT', 'TO6', '6101', '6102', 'OT6', 'TO9', '9225', 'OT9', 'NI', '0000'];
  const H = buildContinentGroups(codes);

  it('groups members and residuals under each continent', () => {
    expect(H.groups.TO6).toEqual(['6101', '6102', 'OT6']);
    expect(H.groups.TO9).toEqual(['9225', 'OT9']);
  });
  it('does NOT leak NI/0000 (not-stated) into the last continent', () => {
    // This was a real bug: NI trailed OT9 and inflated TO9's member sum.
    expect(H.groups.TO9).not.toContain('NI');
    expect(H.groups.TO9).not.toContain('0000');
    expect(H.leftover).toContain('NI');
    expect(H.leftover).toContain('0000');
  });
  it('maps each member back to its group', () => {
    expect(H.memberToGroup['6101']).toBe('TO6');
    expect(H.memberToGroup['9225']).toBe('TO9');
    expect(H.memberToGroup.NI).toBeUndefined();
  });
});

describe('reconcileCrossFlow (exact gate)', () => {
  it('passes when the two flows agree every month', () => {
    const a = { '2025-01': 900, '2025-02': 800 };
    const b = { '2025-01': 900, '2025-02': 800 };
    const r = reconcileCrossFlow(a, b);
    expect(r.mismatches).toBe(0);
    expect(r.checked).toBe(2);
  });
  it('flags any per-month mismatch (a shifted parse)', () => {
    const a = { '2025-01': 900, '2025-02': 800 };
    const b = { '2025-01': 900, '2025-02': 799 };
    const r = reconcileCrossFlow(a, b);
    expect(r.mismatches).toBe(1);
    expect(r.examples[0]).toEqual(['2025-02', 800, 799]);
  });
});

describe('reconcileContinents (tolerant gate)', () => {
  const H = buildContinentGroups(['TOT', 'TO6', '6101', '6102', 'OT6']);
  it('tolerates small rounding wobble (perturbation)', () => {
    const byPeriod = { '2025-01': { TO6: 1000, 6101: 610, 6102: 200, OT6: 200, TOT: 1000 } }; // sum 1010 vs 1000
    const r = reconcileContinents(byPeriod, H, { relTol: 0.03, minPeriod: '2024-01' });
    expect(r.grossFailures).toBe(0);
    expect(r.enforced).toBeGreaterThan(0);
  });
  it('catches gross drift (a real parse error)', () => {
    const byPeriod = { '2025-01': { TO6: 1000, 6101: 6100, 6102: 2000, OT6: 2000, TOT: 1000 } }; // 10x off
    const r = reconcileContinents(byPeriod, H, { relTol: 0.03, minPeriod: '2024-01' });
    expect(r.grossFailures).toBeGreaterThan(0);
  });
  it('does NOT enforce before minPeriod (sparse early history)', () => {
    const byPeriod = { '1980-01': { TO6: 1000, 6101: 100, OT6: 0 } }; // wildly short, but pre-minPeriod
    const r = reconcileContinents(byPeriod, H, { relTol: 0.03, minPeriod: '2004-01' });
    expect(r.grossFailures).toBe(0);
    expect(r.enforced).toBe(0);
  });
});

describe('helpers', () => {
  it('sumOver adds only requested periods', () => {
    expect(sumOver({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toBe(4);
  });
  it('densifyNullable keeps gaps as null', () => {
    expect(densifyNullable({ '2025-01': 5 }, ['2025-01', '2025-02'])).toEqual([5, null]);
  });
  it('recoveryRatio guards a zero/absent baseline', () => {
    expect(recoveryRatio(100, 200)).toBe(0.5);
    expect(recoveryRatio(100, 0)).toBeNull();
    expect(recoveryRatio(100, null)).toBeNull();
  });
  it('yearMonths lists a calendar year', () => {
    expect(yearMonths('2019')).toHaveLength(12);
    expect(yearMonths('2019')[0]).toBe('2019-01');
    expect(yearMonths('2019')[11]).toBe('2019-12');
  });
});
