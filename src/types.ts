// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
export interface Meta {
  updated: string;
  latestMonth: string;
  firstMonth: string;
  window: { start: string; end: string };
  periods: string[];
  source: string;
  counts: { countries: number; mappedCountries: number; months: number; regions: number };
  headline: {
    latestMonth: string;
    latestVisitors: number | null;
    visYoy: number | null;
    visitors12: number;
    recovery12: number | null;
    peakMonth: string | null;
    peakValue: number;
    troughMonth: string | null;
    troughValue: number | null;
    troughDrop: number | null;
    topSource: { c: string; n: string; share: number } | null;
  };
  reconciliation: Record<string, unknown>;
}

export interface National {
  periods: string[];
  visitors: (number | null)[];
  returns: (number | null)[];
  visitorsSA: (number | null)[];
  returnsSA: (number | null)[];
}

export interface Country {
  c: string;
  n: string;
  iso3: string | null;
  region: string | null;
  regionName: string;
  v12: number;
  r12: number;
  vShare: number;
  vRecovery: number | null;
  rRecovery: number | null;
  vSeries: (number | null)[];
  rSeries: (number | null)[];
  rank: number;
}

export interface Region {
  c: string;
  n: string;
  v12: number;
  r12: number;
  vRecovery: number | null;
  vSeries: (number | null)[];
}

export interface Breakdown {
  c: string;
  n: string;
  v12: number;
  share12: number;
  share2019: number;
  series: (number | null)[];
}

export interface Split {
  periods: string[];
  visitors: Breakdown[];
  returns: Breakdown[];
}

export interface Dataset {
  meta: Meta;
  national: National;
  countries: Country[];
  regions: Region[];
  reasons: Split;
  durations: Split;
  byCode: Map<string, Country>;
}
