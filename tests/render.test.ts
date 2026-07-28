/**
 * Headless render of every non-map view against the REAL built data in
 * public/data. Asserts each view renders without throwing and never leaks a
 * NaN / undefined / Infinity into the DOM — the class of bug that looks fine in
 * a screenshot but is a broken value.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '../src/types';
import type { ViewContext } from '../src/views/types';
import { renderOverview } from '../src/views/overview';
import { renderRecovery } from '../src/views/recovery';
import { renderCountries } from '../src/views/countries';
import { renderReasons } from '../src/views/reasons';
import { renderStay } from '../src/views/stay';
import { renderSeasonality } from '../src/views/seasonality';
import { renderExplorer } from '../src/views/explorer';
import { renderInsights } from '../src/views/insights';
import { mountDrawer } from '../src/components/drawer';
import { mountAbout } from '../src/components/about';

const HERE = dirname(fileURLToPath(import.meta.url));
const readData = (f: string) => JSON.parse(readFileSync(join(HERE, '..', 'public', 'data', f), 'utf8'));

let data: Dataset;

beforeAll(() => {
  const countries = readData('countries.json');
  data = {
    meta: readData('meta.json'),
    national: readData('national.json'),
    countries,
    regions: readData('regions.json'),
    reasons: readData('reasons.json'),
    durations: readData('durations.json'),
    byCode: new Map(countries.map((c: { c: string }) => [c.c, c])),
  };
});

function mockCtx(): ViewContext {
  const state: Record<string, string> = {};
  return {
    openCountry: () => {},
    goTo: () => {},
    getState: (k, fb) => state[k] ?? fb,
    setState: (k, v) => { state[k] = v; },
    onTeardown: () => {},
    get signal() { return new AbortController().signal; },
  };
}

const NUMERIC_LEAKS = /\bNaN\b|\bundefined\b|\bInfinity\b/;

const VIEWS: Array<[string, (r: HTMLElement, d: Dataset, c: ViewContext) => void]> = [
  ['overview', renderOverview],
  ['recovery', renderRecovery],
  ['countries', renderCountries],
  ['reasons', renderReasons],
  ['stay', renderStay],
  ['seasonality', renderSeasonality],
  ['explorer', renderExplorer],
  ['insights', renderInsights],
];

describe('view render (real data)', () => {
  it('loads real data with the expected shape', () => {
    expect(data.countries.length).toBeGreaterThan(40);
    expect(data.national.periods.length).toBeGreaterThan(500);
    expect(data.meta.headline.troughValue).toBeGreaterThan(0);
  });

  for (const [name, render] of VIEWS) {
    it(`renders ${name} without error or numeric leaks`, () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      expect(() => render(root, data, mockCtx())).not.toThrow();
      expect(root.innerHTML.length).toBeGreaterThan(200);
      expect(root.innerHTML).not.toMatch(NUMERIC_LEAKS);
      root.remove();
    });
  }

  it('seasonality paints one cell per year-month', () => {
    const root = document.createElement('div');
    render(root, renderSeasonality);
    const cells = root.querySelectorAll('.hm-cell').length;
    const years = new Set(data.national.periods.map((p) => p.slice(0, 4))).size;
    expect(cells).toBe(years * 12);
  });

  it('explorer draws a histogram and a full table', () => {
    const root = document.createElement('div');
    render(root, renderExplorer);
    expect(root.querySelectorAll('.hist-bar').length).toBe(16);
    expect(root.querySelectorAll('#exp-body tr').length).toBe(data.countries.length);
  });
});

describe('drawer + about', () => {
  it('opens a country drawer, attaches it, and shows clean values', () => {
    const drawer = mountDrawer(data);
    drawer.openCountry(data.countries[0].c);
    const panel = document.querySelector('.drawer');
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('open')).toBe(true);
    expect(panel?.innerHTML ?? '').not.toMatch(NUMERIC_LEAKS);
    expect(drawer.isOpen()).toBe(true);
  });

  it('opens a small country with sparse history without leaking values', () => {
    const drawer = mountDrawer(data);
    const small = [...data.countries].sort((a, b) => a.v12 - b.v12)[0];
    drawer.openCountry(small.c);
    expect(document.querySelector('.drawer')?.innerHTML ?? '').not.toMatch(NUMERIC_LEAKS);
  });

  it('builds the About modal with no numeric leaks', () => {
    mountAbout(data.meta);
    const modal = document.querySelector('.modal');
    expect(modal?.innerHTML ?? '').not.toMatch(NUMERIC_LEAKS);
  });
});

function render(root: HTMLElement, fn: (r: HTMLElement, d: Dataset, c: ViewContext) => void): void {
  document.body.appendChild(root);
  fn(root, data, mockCtx());
}
