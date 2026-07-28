// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Pure, dependency-free transforms shared by the pipeline and the test suite.
// Nothing in here may import a package — the tests run this file directly on CI,
// where pipeline/node_modules is not installed.
//
// Domain: ABS Overseas Arrivals and Departures (OAD). Two dataflows, both keyed
// by a "category of traveller" (06 = short-term visitors arriving, 05 = short-term
// residents returning). Counts are randomly rounded to the nearest 10 for privacy
// (perturbation), so anything that sums independently-published cells never lands
// exactly on the published subtotal — hence the tolerant continental gate below.

export const TRAVELLER = { VISITOR: '06', RETURN: '05' };

/**
 * Minimal RFC4180-ish CSV parser. ABS country and reason names contain commas
 * ("Korea, South", "Visiting friends/relatives"), so a naive split(',') silently
 * shifts every column after it.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length < head.length) continue;
    const o = {};
    for (let j = 0; j < head.length; j++) o[head[j]] = rows[i][j];
    out.push(o);
  }
  return out;
}

/**
 * A blank observation is "not published", NOT zero. Number('') is 0, which would
 * silently invent a month of zero arrivals and drag every average down.
 */
export function obsToCount(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

/** A code we can rank, map and attribute: a single reported country. */
export function isRealCountry(code) {
  // Member codes are numeric ('1201', '21'). Continental totals are 'TOn', their
  // residual is 'OTn', 'NI'/'0000' are "not stated". '0000' is numeric but is not
  // a place, so it is excluded explicitly.
  return /^\d+$/.test(code) && code !== '0000';
}

export function isSubtotal(code) {
  return /^TO\d$/.test(code) || code === 'TOT';
}

/**
 * Build the continent hierarchy from the *order* of the country codelist. The
 * SDMX codelist is flat (no parent links) but is laid out as: TOT, then for each
 * continent a `TOn` header followed by its member countries and an `OTn`
 * residual, e.g. TO6, 6101, 6102, 6105, 6201, 6203, OT6. So each `TOn` owns every
 * code up to the next `TOn`.
 *
 * @param {string[]} codes ordered code ids from CL_OAD_ARRIVALS_COUNTRY
 * @returns {{ groups: Record<string,string[]>, memberToGroup: Record<string,string>,
 *            leftover: string[] }}
 */
export function buildContinentGroups(codes) {
  const groups = {};
  const memberToGroup = {};
  const leftover = [];
  let cur = null;
  for (const code of codes) {
    if (code === 'TOT') { cur = null; continue; }
    if (/^TO\d$/.test(code)) { cur = code; groups[cur] = []; continue; }
    // A group member is a country code ('1201', '21') or the region's 'OTn'
    // residual — NOT the national "not stated" codes (NI, 0000), which trail the
    // last continent in the codelist and would otherwise leak into it.
    const isMember = cur && (/^\d+$/.test(code) || /^OT\d$/.test(code)) && code !== '0000';
    if (isMember) { groups[cur].push(code); memberToGroup[code] = cur; }
    else leftover.push(code);
  }
  return { groups, memberToGroup, leftover };
}

/**
 * Continental reconciliation gate — TOLERANT because of perturbation.
 *
 * For every month the members (individual countries + the OTn residual) of each
 * continent should sum to that continent's `TOn` subtotal, and the continents +
 * "not stated" should sum to `TOT`. They never land exactly on it because each
 * cell is randomly rounded to the nearest 10, and in the deep history some member
 * series are not yet reported. We assert only that the discrepancy stays within a
 * relative band — a real parse error (a shifted column, a wrong dimension) throws
 * the sums off by 10× or more, which this still catches.
 *
 * The ABS only broke out today's full set of individual countries from about
 * 2003; before that the "Other <region>" residual does not capture every
 * unlisted country, so members + residual fall short of the published subtotal.
 * That is a source-coverage fact, not a parse error, so `minPeriod` restricts the
 * pass/fail decision to the modern era where the breakdown is complete. A real
 * parse error (a shifted column, the wrong dimension) throws the sums off in
 * EVERY month, modern ones included, so this still catches it.
 *
 * @param {Record<string, Record<string, number>>} byPeriod period → code → count
 * @param {{groups:Record<string,string[]>}} hierarchy from buildContinentGroups
 * @param {{ relTol?:number, minPeriod?:string }} opts
 * @returns {{ grossFailures:number, maxRel:number, maxAbs:number, checks:number, enforced:number }}
 */
export function reconcileContinents(byPeriod, hierarchy, opts = {}) {
  const relTol = opts.relTol ?? 0.03;
  const minPeriod = opts.minPeriod ?? '0000';
  const { groups } = hierarchy;
  let grossFailures = 0;
  let maxRel = 0;
  let maxAbs = 0;
  let checks = 0;
  let enforced = 0;
  const groupCodes = Object.keys(groups);
  for (const [period, dd] of Object.entries(byPeriod)) {
    const enforce = period >= minPeriod;
    for (const g of groupCodes) {
      const subtotal = dd[g];
      if (subtotal === undefined || subtotal === null) continue;
      const sum = groups[g].reduce((a, m) => a + (dd[m] ?? 0), 0);
      const abs = Math.abs(sum - subtotal);
      const rel = subtotal > 0 ? abs / subtotal : abs > 0 ? 1 : 0;
      checks++;
      if (!enforce) continue;
      enforced++;
      if (abs > maxAbs) maxAbs = abs;
      if (rel > maxRel) maxRel = rel;
      // Absolute floor of 200 lets tiny subtotals wobble by a few rounding units
      // without tripping the relative band.
      if (rel > relTol && abs > 200) grossFailures++;
    }
    // continents + not-stated → TOT
    if (dd.TOT !== undefined && dd.TOT !== null) {
      const sum = groupCodes.reduce((a, g) => a + (dd[g] ?? 0), 0) + (dd.NI ?? 0) + (dd['0000'] ?? 0);
      const abs = Math.abs(sum - dd.TOT);
      const rel = dd.TOT > 0 ? abs / dd.TOT : 0;
      checks++;
      if (!enforce) continue;
      enforced++;
      if (abs > maxAbs) maxAbs = abs;
      if (rel > maxRel) maxRel = rel;
      if (rel > relTol && abs > 200) grossFailures++;
    }
  }
  return { grossFailures, maxRel, maxAbs, checks, enforced };
}

/**
 * Cross-flow reconciliation gate — EXACT. The total short-term arrivals published
 * in OAD_COUNTRY (summed over countries) and in OAD_REASON (summed over reasons)
 * are the same population, rounded identically, so the two independently-published
 * `TOT` figures must match to the unit. Any mismatch means the two flows were
 * misaligned in parsing.
 *
 * @returns {{ mismatches:number, checked:number, examples:Array<[string,number,number]> }}
 */
export function reconcileCrossFlow(countryTotByPeriod, reasonTotByPeriod) {
  const periods = Object.keys(countryTotByPeriod).filter((p) => p in reasonTotByPeriod);
  let mismatches = 0;
  const examples = [];
  for (const p of periods) {
    const a = countryTotByPeriod[p];
    const b = reasonTotByPeriod[p];
    if (a !== b) {
      mismatches++;
      if (examples.length < 5) examples.push([p, a, b]);
    }
  }
  return { mismatches, checked: periods.length, examples };
}

/** Sum a period→value map over a set of periods (null-safe). */
export function sumOver(series, periods) {
  const want = periods instanceof Set ? periods : new Set(periods);
  let total = 0;
  for (const [period, value] of Object.entries(series)) {
    if (want.has(period) && Number.isFinite(value)) total += value;
  }
  return total;
}

/** Dense array aligned to `periods`; missing months → null (not published != 0). */
export function densifyNullable(series, periods) {
  return periods.map((p) => {
    const v = series[p];
    return Number.isFinite(v) ? v : null;
  });
}

/**
 * Recovery ratio: a trailing 12-month sum against the equivalent 12 months of a
 * pre-pandemic baseline year. Returns null when the baseline is absent or zero
 * (a country first reported after 2019 has no meaningful "recovery").
 */
export function recoveryRatio(current12, baseline12) {
  if (!Number.isFinite(baseline12) || baseline12 <= 0) return null;
  return current12 / baseline12;
}

/** The 12 period labels of the calendar year `year` (e.g. '2019-01'..'2019-12'). */
export function yearMonths(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}
