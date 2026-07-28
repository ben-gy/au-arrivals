// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Collect: pull every OAD slice we need from the ABS SDMX API into
// pipeline/.cache/. Nothing is transformed here — aggregate.mjs owns all the
// shaping, so a failed aggregate never costs another round of ABS traffic.

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const API = 'https://data.api.abs.gov.au/rest';

// OAD_COUNTRY key order: CAT_TRAVELLER . COUNTRY_RESID . TSEST . FREQ
// OAD_REASON  key order: CAT_TRAVELLER . DURATION . JOUR_REASON . TSEST . FREQ
// TSEST: 10 Original, 20 Seasonally Adjusted. FREQ: M monthly.
const SLICES = [
  // Every country (incl. continental subtotals + Total), original — the core cube.
  { flow: 'OAD_COUNTRY', key: '06..10.M', file: 'visitors-country.csv' },
  { flow: 'OAD_COUNTRY', key: '05..10.M', file: 'returns-country.csv' },
  // Seasonally-adjusted national total — the smooth hero recovery line.
  { flow: 'OAD_COUNTRY', key: '06.TOT.20.M', file: 'visitors-total-sa.csv' },
  { flow: 'OAD_COUNTRY', key: '05.TOT.20.M', file: 'returns-total-sa.csv' },
  // Reason for journey over time (total duration), original.
  { flow: 'OAD_REASON', key: '06.TOT..10.M', file: 'visitors-reason.csv' },
  { flow: 'OAD_REASON', key: '05.TOT..10.M', file: 'returns-reason.csv' },
  // Length of stay over time (total reason), original.
  { flow: 'OAD_REASON', key: '06..TOT.10.M', file: 'visitors-duration.csv' },
  { flow: 'OAD_REASON', key: '05..TOT.10.M', file: 'returns-duration.csv' },
];

async function fetchText(url, { tries = 4, label = '', accept = 'application/vnd.sdmx.data+csv, text/csv' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: accept },
        signal: AbortSignal.timeout(300_000),
      });
      if (res.status === 404) return ''; // genuinely empty slice, not an error
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error('empty body');
      return text;
    } catch (err) {
      lastErr = err;
      const wait = attempt * 4000;
      process.stderr.write(`  retry ${attempt}/${tries} ${label}: ${err.message} (${wait}ms)\n`);
      if (attempt < tries) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`failed ${label}: ${lastErr?.message}`);
}

async function cached(file, produce) {
  const path = join(CACHE, file);
  try {
    const s = await stat(path);
    if (Date.now() - s.mtimeMs < 12 * 3600_000) {
      process.stdout.write(`  cached ${file}\n`);
      return readFile(path, 'utf8');
    }
  } catch { /* not cached */ }
  const text = await produce();
  await writeFile(path, text);
  return text;
}

async function main() {
  await mkdir(CACHE, { recursive: true });

  process.stdout.write('Structures…\n');
  for (const flow of ['OAD_COUNTRY', 'OAD_REASON']) {
    await cached(`structure-${flow}.json`, () =>
      fetchText(`${API}/datastructure/ABS/${flow}?references=all&format=json`, {
        label: `structure ${flow}`,
        accept: 'application/vnd.sdmx.structure+json',
      }),
    );
  }

  for (const slice of SLICES) {
    const url = `${API}/data/ABS,${slice.flow},1.0.0/${slice.key}?dimensionAtObservation=AllDimensions`;
    process.stdout.write(`${slice.file}…\n`);
    const text = await cached(slice.file, () => fetchText(url, { label: slice.file }));
    process.stdout.write(`  ${(text.length / 1e6).toFixed(2)} MB\n`);
  }

  // World boundaries: Natural Earth 50m admin-0 MAP UNITS (public domain).
  // Never hand-authored — see patterns/geo/README.md. map_units (not countries)
  // keeps Hong Kong and Taiwan as their own polygons, which OAD reports separately.
  process.stdout.write('world boundaries…\n');
  await cached('ne_50m_admin_0_map_units.geojson', () =>
    fetchText(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson',
      { label: 'natural-earth', accept: 'application/json' },
    ),
  );

  process.stdout.write('Collect complete.\n');
}

main().catch((err) => {
  process.stderr.write(`collect failed: ${err.stack}\n`);
  process.exit(1);
});
