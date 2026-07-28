// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { Country, Dataset, Meta, National, Region, Split } from './types';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function loadDataset(signal?: AbortSignal): Promise<Dataset> {
  const [meta, national, countries, regions, reasons, durations] = await Promise.all([
    getJson<Meta>('/data/meta.json', signal),
    getJson<National>('/data/national.json', signal),
    getJson<Country[]>('/data/countries.json', signal),
    getJson<Region[]>('/data/regions.json', signal),
    getJson<Split>('/data/reasons.json', signal),
    getJson<Split>('/data/durations.json', signal),
  ]);
  return {
    meta,
    national,
    countries,
    regions,
    reasons,
    durations,
    byCode: new Map(countries.map((c) => [c.c, c])),
  };
}

export function loadWorldGeo(signal?: AbortSignal): Promise<GeoJSON.FeatureCollection> {
  return getJson<GeoJSON.FeatureCollection>('/data/world.geojson', signal);
}
