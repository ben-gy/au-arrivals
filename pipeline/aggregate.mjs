// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Aggregate: turn the cached ABS OAD slices into the JSON the browser reads.
// Everything here is deterministic — same cache in, same bytes out. Two hard
// reconciliation gates guard the parse (see lib/parse.mjs): an EXACT cross-flow
// total gate and a rounding-TOLERANT continental gate.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  parseCsv, obsToCount, isRealCountry, buildContinentGroups,
  reconcileContinents, reconcileCrossFlow, sumOver, densifyNullable,
  recoveryRatio,
} from './lib/parse.mjs';
import { resolveIso3 } from './lib/countryMap.mjs';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const OUT = join(HERE, '..', 'public', 'data');
const BASELINE_YEAR = '2019'; // the last full pre-pandemic year

const read = async (f) => parseCsv(await readFile(join(CACHE, f), 'utf8'));

/** code → name from an SDMX structure JSON codelist. */
function namesFromStructure(structure, codelistId) {
  const cl = structure.data.codelists.find((c) => c.id === codelistId);
  return {
    order: cl.codes.map((c) => c.id),
    name: Object.fromEntries(cl.codes.map((c) => [c.id, c.name])),
  };
}

/** rows(one dimension varying) → { [code]: { [period]: count } } keyed by `col`. */
function seriesBy(rows, col) {
  const out = {};
  for (const r of rows) {
    const v = obsToCount(r.OBS_VALUE);
    if (v === null) continue;
    (out[r[col]] ??= {})[r.TIME_PERIOD] = v;
  }
  return out;
}

/** period → code → count (for the reconciliation gates). */
function byPeriod(rows, col) {
  const out = {};
  for (const r of rows) {
    const v = obsToCount(r.OBS_VALUE);
    if (v === null) continue;
    (out[r.TIME_PERIOD] ??= {})[r[col]] = v;
  }
  return out;
}

/** 12 baseline periods aligned by month-of-year to a rolling window. */
function baselineFor(window, year) {
  return window.map((p) => `${year}-${p.slice(5)}`);
}

async function simplifyWorld() {
  const simplifiedPath = join(CACHE, 'world-simplified.geojson');
  try {
    await execFileP('npx', [
      '--yes', 'mapshaper', join(CACHE, 'ne_50m_admin_0_map_units.geojson'),
      '-simplify', '18%', 'keep-shapes',
      '-filter', 'ADMIN !== "Antarctica"',
      '-o', 'precision=0.001', 'format=geojson', simplifiedPath,
    ], { maxBuffer: 1024 * 1024 * 256 });
  } catch (err) {
    process.stderr.write(`mapshaper failed (${err.message}) — shipping unsimplified\n`);
    await writeFile(simplifiedPath, await readFile(join(CACHE, 'ne_50m_admin_0_map_units.geojson')));
  }
  return JSON.parse(await readFile(simplifiedPath, 'utf8'));
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const structCountry = JSON.parse(await readFile(join(CACHE, 'structure-OAD_COUNTRY.json'), 'utf8'));
  const structReason = JSON.parse(await readFile(join(CACHE, 'structure-OAD_REASON.json'), 'utf8'));
  const countryCl = namesFromStructure(structCountry, 'CL_OAD_ARRIVALS_COUNTRY');
  const reasonCl = namesFromStructure(structReason, 'CL_OAD_JOURNEY_REASON');
  const durationCl = namesFromStructure(structReason, 'CL_OAD_ST_STAY_DURATION');
  const hierarchy = buildContinentGroups(countryCl.order);
  const regionName = (code) => countryCl.name[code] ?? code;

  // ── raw slices ────────────────────────────────────────────────────────────
  const visRows = await read('visitors-country.csv');
  const retRows = await read('returns-country.csv');
  const visReasonRows = await read('visitors-reason.csv');
  const retReasonRows = await read('returns-reason.csv');
  const visDurRows = await read('visitors-duration.csv');
  const retDurRows = await read('returns-duration.csv');
  const visSaRows = await read('visitors-total-sa.csv').catch(() => []);
  const retSaRows = await read('returns-total-sa.csv').catch(() => []);

  const visByCountry = seriesBy(visRows, 'COUNTRY_RESID');
  const retByCountry = seriesBy(retRows, 'COUNTRY_RESID');

  // ── RECONCILIATION GATE 1 (exact, cross-flow) ─────────────────────────────
  const visReasonByCode = seriesBy(visReasonRows, 'JOUR_REASON');
  const retReasonByCode = seriesBy(retReasonRows, 'JOUR_REASON');
  const crossVis = reconcileCrossFlow(visByCountry.TOT ?? {}, visReasonByCode.TOT ?? {});
  const crossRet = reconcileCrossFlow(retByCountry.TOT ?? {}, retReasonByCode.TOT ?? {});
  if (crossVis.mismatches > 0 || crossRet.mismatches > 0) {
    throw new Error(
      `Cross-flow total gate FAILED: visitors ${crossVis.mismatches}/${crossVis.checked} ` +
      `${JSON.stringify(crossVis.examples)}, returns ${crossRet.mismatches}/${crossRet.checked} ` +
      `${JSON.stringify(crossRet.examples)}`,
    );
  }

  // ── RECONCILIATION GATE 2 (tolerant, continental sums) ────────────────────
  // Enforce from 2004: the ABS only broke out the full country set from ~2003,
  // so earlier residuals under-reconcile (a coverage fact, not a parse error).
  const gateOpts = { relTol: 0.03, minPeriod: '2004-01' };
  const visGate = reconcileContinents(byPeriod(visRows, 'COUNTRY_RESID'), hierarchy, gateOpts);
  const retGate = reconcileContinents(byPeriod(retRows, 'COUNTRY_RESID'), hierarchy, gateOpts);
  if (visGate.grossFailures > 0 || retGate.grossFailures > 0) {
    throw new Error(
      `Continental sum gate FAILED (gross drift beyond 3%): visitors ${visGate.grossFailures}, ` +
      `returns ${retGate.grossFailures}. This indicates a parse error, not perturbation.`,
    );
  }

  // ── periods ───────────────────────────────────────────────────────────────
  const periods = [...new Set([
    ...Object.keys(visByCountry.TOT ?? {}),
    ...Object.keys(retByCountry.TOT ?? {}),
  ])].sort();
  const window = periods.slice(-12);
  const windowSet = new Set(window);
  const baseWindow = baselineFor(window, BASELINE_YEAR);
  const baseSet = new Set(baseWindow);
  const totVis12 = sumOver(visByCountry.TOT ?? {}, windowSet);

  // ── national series ───────────────────────────────────────────────────────
  const saTot = (rows) => {
    const s = seriesBy(rows, 'COUNTRY_RESID').TOT ?? {};
    return s;
  };
  const national = {
    periods,
    visitors: densifyNullable(visByCountry.TOT ?? {}, periods),
    returns: densifyNullable(retByCountry.TOT ?? {}, periods),
    visitorsSA: densifyNullable(saTot(visSaRows), periods),
    returnsSA: densifyNullable(saTot(retSaRows), periods),
  };

  // ── countries (real, single reported countries) ───────────────────────────
  const codes = [...new Set([...Object.keys(visByCountry), ...Object.keys(retByCountry)])];
  const countries = [];
  let mapped = 0;
  for (const code of codes) {
    if (!isRealCountry(code)) continue;
    const vSer = visByCountry[code] ?? {};
    const rSer = retByCountry[code] ?? {};
    const v12 = sumOver(vSer, windowSet);
    const r12 = sumOver(rSer, windowSet);
    if (v12 <= 0 && r12 <= 0) continue;
    const iso3 = resolveIso3(code);
    if (iso3) mapped++;
    countries.push({
      c: code,
      n: countryCl.name[code] ?? code,
      iso3,
      region: hierarchy.memberToGroup[code] ?? null,
      regionName: regionName(hierarchy.memberToGroup[code] ?? ''),
      v12,
      r12,
      vShare: totVis12 > 0 ? Math.round((v12 / totVis12) * 10000) / 10000 : 0,
      vRecovery: round3(recoveryRatio(v12, sumOver(vSer, baseSet))),
      rRecovery: round3(recoveryRatio(r12, sumOver(rSer, baseSet))),
      vSeries: densifyNullable(vSer, periods),
      rSeries: densifyNullable(rSer, periods),
    });
  }
  countries.sort((a, b) => b.v12 - a.v12);
  countries.forEach((c, i) => { c.rank = i + 1; });

  // ── regions (continental subtotals — published directly as TOn) ───────────
  const regions = Object.keys(hierarchy.groups).map((code) => {
    const vSer = visByCountry[code] ?? {};
    const rSer = retByCountry[code] ?? {};
    return {
      c: code,
      n: regionName(code),
      v12: sumOver(vSer, windowSet),
      r12: sumOver(rSer, windowSet),
      vRecovery: round3(recoveryRatio(sumOver(vSer, windowSet), sumOver(vSer, baseSet))),
      vSeries: densifyNullable(vSer, periods),
    };
  }).sort((a, b) => b.v12 - a.v12);

  // ── reasons + durations ───────────────────────────────────────────────────
  const buildBreakdown = (byCode, order, nameMap) => {
    const total12 = sumOver(byCode.TOT ?? {}, windowSet);
    const total2019 = sumOver(byCode.TOT ?? {}, new Set([...Array(12)].map((_, i) => `${BASELINE_YEAR}-${String(i + 1).padStart(2, '0')}`)));
    return order
      .filter((code) => code !== 'TOT')
      .map((code) => {
        const ser = byCode[code] ?? {};
        const v12 = sumOver(ser, windowSet);
        const v2019 = sumOver(ser, new Set([...Array(12)].map((_, i) => `${BASELINE_YEAR}-${String(i + 1).padStart(2, '0')}`)));
        return {
          c: code,
          n: nameMap[code] ?? code,
          v12,
          share12: total12 > 0 ? Math.round((v12 / total12) * 10000) / 10000 : 0,
          share2019: total2019 > 0 ? Math.round((v2019 / total2019) * 10000) / 10000 : 0,
          series: densifyNullable(ser, periods),
        };
      })
      .filter((r) => r.v12 > 0 || r.series.some((v) => v))
      .sort((a, b) => b.v12 - a.v12);
  };

  const reasons = {
    periods,
    visitors: buildBreakdown(visReasonByCode, reasonCl.order, reasonCl.name),
    returns: buildBreakdown(retReasonByCode, reasonCl.order, reasonCl.name),
  };
  const durations = {
    periods,
    visitors: buildBreakdown(seriesBy(visDurRows, 'DURATION'), durationCl.order, durationCl.name),
    returns: buildBreakdown(seriesBy(retDurRows, 'DURATION'), durationCl.order, durationCl.name),
  };

  // ── headline figures ──────────────────────────────────────────────────────
  const visSeriesMap = visByCountry.TOT ?? {};
  const latestMonth = periods[periods.length - 1];
  const latestVisitors = visSeriesMap[latestMonth] ?? null;
  const priorYearMonth = `${Number(latestMonth.slice(0, 4)) - 1}-${latestMonth.slice(5)}`;
  const visYoy = visSeriesMap[priorYearMonth]
    ? (latestVisitors - visSeriesMap[priorYearMonth]) / visSeriesMap[priorYearMonth] : null;
  // Pre-COVID monthly peak (up to Jan 2020) and closed-border trough.
  let peak = { month: null, value: -1 };
  let trough = { month: null, value: Infinity };
  for (const [p, v] of Object.entries(visSeriesMap)) {
    if (p <= '2020-01' && v > peak.value) peak = { month: p, value: v };
    if (p >= '2020-02' && p <= '2021-12' && v < trough.value) trough = { month: p, value: v };
  }
  const recovery12 = recoveryRatio(totVis12, sumOver(visSeriesMap, baseSet));
  const topSource = countries[0];

  // ── world geojson: simplify + tag with ABS codes ──────────────────────────
  const isoToAbs = new Map(countries.filter((c) => c.iso3).map((c) => [c.iso3, c.c]));
  const rawWorld = await simplifyWorld();
  const world = {
    type: 'FeatureCollection',
    features: rawWorld.features.map((f) => {
      const p = f.properties;
      const iso = p.ISO_A3_EH && p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : p.ISO_A3;
      return {
        type: 'Feature',
        properties: { iso3: iso, abs: isoToAbs.get(iso) ?? null, name: p.ADMIN },
        geometry: f.geometry,
      };
    }).filter((f) => f.geometry),
  };
  await writeFile(join(OUT, 'world.geojson'), JSON.stringify(world));

  // ── write ─────────────────────────────────────────────────────────────────
  const meta = {
    updated: new Date().toISOString().slice(0, 10),
    latestMonth,
    firstMonth: periods[0],
    window: { start: window[0], end: window[window.length - 1] },
    periods,
    source: 'ABS Overseas Arrivals and Departures, Australia (OAD_COUNTRY & OAD_REASON)',
    counts: {
      countries: countries.length,
      mappedCountries: mapped,
      months: periods.length,
      regions: regions.length,
    },
    headline: {
      latestMonth,
      latestVisitors,
      visYoy: round3(visYoy),
      visitors12: totVis12,
      recovery12: round3(recovery12),
      peakMonth: peak.month,
      peakValue: peak.value,
      troughMonth: trough.month,
      troughValue: trough.value === Infinity ? null : trough.value,
      troughDrop: peak.value > 0 && trough.value !== Infinity
        ? round3(1 - trough.value / peak.value) : null,
      topSource: topSource ? { c: topSource.c, n: topSource.n, share: topSource.vShare } : null,
    },
    reconciliation: {
      crossFlowVisitors: crossVis,
      crossFlowReturns: crossRet,
      continentsVisitors: visGate,
      continentsReturns: retGate,
    },
  };

  await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta));
  await writeFile(join(OUT, 'national.json'), JSON.stringify(national));
  await writeFile(join(OUT, 'countries.json'), JSON.stringify(countries));
  await writeFile(join(OUT, 'regions.json'), JSON.stringify(regions));
  await writeFile(join(OUT, 'reasons.json'), JSON.stringify(reasons));
  await writeFile(join(OUT, 'durations.json'), JSON.stringify(durations));

  process.stdout.write(
    `Wrote ${countries.length} countries (${mapped} mapped), ${regions.length} regions, ` +
    `${periods.length} months ${periods[0]}→${latestMonth}\n` +
    `  latest visitors ${latestVisitors?.toLocaleString()} · recovery ${(recovery12 * 100).toFixed(0)}% of 2019 · ` +
    `trough ${trough.value.toLocaleString()} in ${trough.month} (−${(meta.headline.troughDrop * 100).toFixed(1)}%)\n` +
    `  GATES: cross-flow exact (vis ${crossVis.mismatches}/${crossVis.checked}, ret ${crossRet.mismatches}/${crossRet.checked}); ` +
    `continents tolerant (vis maxRel ${(visGate.maxRel * 100).toFixed(2)}% maxAbs ${visGate.maxAbs}, gross ${visGate.grossFailures})\n`,
  );
}

function round3(v) {
  return v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000;
}

main().catch((err) => {
  process.stderr.write(`aggregate failed: ${err.stack}\n`);
  process.exit(1);
});
