// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import './styles.css';
import { mountAbout } from './components/about';
import { mountDrawer } from './components/drawer';
import { initGlossary } from './components/glossaryPopover';
import { initTooltip } from './components/tooltip';
import { loadDataset } from './data';
import { escapeHtml, formatCount, formatPeriodLong, shortCountry } from './format';
import type { Country, Dataset } from './types';
import { renderCountries } from './views/countries';
import { renderExplorer } from './views/explorer';
import { renderInsights } from './views/insights';
import { renderMap } from './views/map';
import { renderOverview } from './views/overview';
import { renderReasons } from './views/reasons';
import { renderRecovery } from './views/recovery';
import { renderSeasonality } from './views/seasonality';
import { renderStay } from './views/stay';
import type { ViewContext } from './views/types';

interface ViewDef {
  id: string;
  label: string;
  render: (root: HTMLElement, data: Dataset, ctx: ViewContext) => void | Promise<void>;
}

// Nav labels are words only — never count badges.
const VIEWS: ViewDef[] = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'recovery', label: 'Recovery', render: renderRecovery },
  { id: 'map', label: 'World map', render: renderMap },
  { id: 'countries', label: 'Countries', render: renderCountries },
  { id: 'reasons', label: 'Why', render: renderReasons },
  { id: 'stay', label: 'Length of stay', render: renderStay },
  { id: 'seasonality', label: 'Seasonality', render: renderSeasonality },
  { id: 'explorer', label: 'Explorer', render: renderExplorer },
  { id: 'insights', label: 'Insights', render: renderInsights },
];

const STATE_KEY = 'au-arrivals:state';

function loadState(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as Record<string, string>; }
  catch { return {}; }
}
function saveState(state: Record<string, string>): void {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

async function boot(): Promise<void> {
  const app = document.getElementById('app') as HTMLElement;
  app.innerHTML = `
    <header class="site-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <h1>Overseas Arrivals</h1>
        <span class="brand-sub">Who visits Australia — 50 years</span>
      </div>
      <div class="search-wrap">
        <input class="search-input" id="search" type="search" autocomplete="off"
          placeholder="Search a country…" aria-label="Search for a country" />
        <div class="search-results" id="search-results" role="listbox"></div>
      </div>
      <div class="header-spacer"></div>
      <div class="header-actions">
        <button class="icon-btn" id="about-btn" aria-label="About this site" title="About this site">?</button>
      </div>
    </header>
    <nav class="tabs" id="tabs" role="tablist" aria-label="Views"></nav>
    <main class="main-content" id="view" role="tabpanel"><div class="skeleton"></div></main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span id="footer-source">Loading…</span>
        <span>
          Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> ·
          <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a>
        </span>
      </div>
    </footer>
  `;

  initTooltip();
  initGlossary();

  const viewRoot = document.getElementById('view') as HTMLElement;

  let data: Dataset;
  try {
    data = await loadDataset();
  } catch (err) {
    viewRoot.innerHTML = `<div class="error-state">
      <p>Could not load the arrivals data.</p>
      <p style="font-size:var(--font-size-sm);color:var(--text-tertiary)">${escapeHtml((err as Error).message)}</p>
      <button class="btn primary" id="retry" style="margin-top:1rem">Try again</button></div>`;
    document.getElementById('retry')?.addEventListener('click', () => location.reload());
    return;
  }

  const about = mountAbout(data.meta);
  const drawer = mountDrawer(data);
  document.getElementById('about-btn')?.addEventListener('click', about.open);

  (document.getElementById('footer-source') as HTMLElement).innerHTML = `
    Source: ABS Overseas Arrivals and Departures · to ${escapeHtml(formatPeriodLong(data.meta.latestMonth))} ·
    ${escapeHtml(formatCount(data.meta.headline.visitors12))} visitors in the last year`;

  const state = loadState();
  let teardowns: Array<() => void> = [];
  let controller = new AbortController();

  const ctx: ViewContext = {
    openCountry: (code) => drawer.openCountry(code),
    goTo: (id) => show(id),
    getState: (k, fallback) => state[k] ?? fallback,
    setState: (k, v) => { state[k] = v; saveState(state); },
    onTeardown: (fn) => teardowns.push(fn),
    get signal() { return controller.signal; },
  };

  const tabs = document.getElementById('tabs') as HTMLElement;
  tabs.innerHTML = VIEWS.map((v) => `<button class="tab" role="tab" data-view="${v.id}" aria-selected="false">${v.label}</button>`).join('');

  function show(id: string): void {
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    drawer.close(); // switching views closes any open country drawer
    for (const fn of teardowns) fn();
    teardowns = [];
    controller.abort();
    controller = new AbortController();

    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.getAttribute('data-view') === view.id)));
    state.view = view.id;
    saveState(state);
    if (!location.hash.startsWith('#c=')) history.replaceState(null, '', `#${view.id}`);

    viewRoot.scrollTop = 0;
    window.scrollTo(0, 0);
    viewRoot.innerHTML = '';
    const result = view.render(viewRoot, data, ctx);
    if (result instanceof Promise) {
      result.catch(() => { viewRoot.innerHTML = '<div class="error-state">Something went wrong rendering this view.</div>'; });
    }
  }

  tabs.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.getAttribute('data-view') as string)));

  mountSearch(data, drawer);

  const hash = location.hash.slice(1);
  if (hash.startsWith('c=')) { show(state.view ?? 'overview'); drawer.openCountry(hash.slice(2)); }
  else if (VIEWS.some((v) => v.id === hash)) show(hash);
  else show(state.view ?? 'overview');

  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (h.startsWith('c=')) drawer.openCountry(h.slice(2));
    else if (VIEWS.some((v) => v.id === h)) show(h);
  });
}

/** Header search over countries — arrive with a noun ("Japan"), open its record. */
function mountSearch(data: Dataset, drawer: { openCountry: (c: string) => void }): void {
  const input = document.getElementById('search') as HTMLInputElement;
  const results = document.getElementById('search-results') as HTMLElement;
  let active = -1;
  let matches: Country[] = [];

  const close = (): void => { results.classList.remove('open'); active = -1; };
  const pick = (c: Country): void => { drawer.openCountry(c.c); close(); input.value = ''; input.blur(); };

  const draw = (): void => {
    results.innerHTML = matches.length
      ? matches.map((c, i) => `<div class="search-item ${i === active ? 'active' : ''}" data-idx="${i}" role="option" aria-selected="${i === active}">
          <span class="sr-name">${escapeHtml(shortCountry(c.n))}</span>
          <span class="sr-meta mono">${escapeHtml(formatCount(c.v12))}</span></div>`).join('')
      : '<div class="search-empty">No country matches.</div>';
    results.classList.add('open');
    results.querySelectorAll<HTMLElement>('.search-item').forEach((el) => el.addEventListener('click', () => pick(matches[Number(el.dataset.idx)])));
  };

  const search = (q: string): void => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) { close(); matches = []; return; }
    matches = data.countries
      .filter((c) => shortCountry(c.n).toLowerCase().includes(needle))
      .sort((a, b) => b.v12 - a.v12)
      .slice(0, 10);
    active = -1;
    draw();
  };

  let timer: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => search(input.value), 200); });
  input.addEventListener('focus', () => { if (matches.length) results.classList.add('open'); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!matches.length) return;
      active = e.key === 'ArrowDown' ? Math.min(matches.length - 1, active + 1) : Math.max(0, active - 1);
      draw();
    } else if (e.key === 'Enter') { const c = matches[active >= 0 ? active : 0]; if (c) pick(c); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!(e.target as Element).closest('.search-wrap')) close(); });
}

void boot();
