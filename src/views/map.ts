// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { logBreaks, recoveryBreaks } from '../analysis';
import { loadWorldGeo } from '../data';
import { escapeHtml, formatNumber, formatRecovery, shortCountry, shortRegion } from '../format';
import { NO_DATA_COLOUR, RAMP_RECOVERY, RAMP_VISITORS, rampColour } from '../palette';
import type { Country, Dataset } from '../types';
import type { ViewContext } from './types';

type Mode = 'vis' | 'ret' | 'rec';

const RAMP_RETURNS = ['#f6e6d3', '#f0cfa4', '#e6ac6a', '#d4832f', '#b45309', '#8a3f08', '#5e2b05'];

const MODES: Array<{ key: Mode; label: string; blurb: string }> = [
  { key: 'vis', label: 'Visitors arriving', blurb: 'Where Australia’s short-term visitors live.' },
  { key: 'ret', label: 'Residents returning', blurb: 'Where Australians go on short trips (by country visited).' },
  { key: 'rec', label: 'Recovery vs 2019', blurb: 'How each market compares to its pre-COVID level — teal has recovered, amber has not.' },
];

let worldCache: GeoJSON.FeatureCollection | null = null;

export async function renderMap(root: HTMLElement, data: Dataset, ctx: ViewContext): Promise<void> {
  const modeKey = (ctx.getState('mapMode', 'vis') as Mode);
  const mode = MODES.find((m) => m.key === modeKey) ?? MODES[0];

  root.innerHTML = `
    <div class="view-head">
      <h2>Where they come from</h2>
      <p>
        Every country the ABS reports individually, shaded by ${escapeHtml(mode.label.toLowerCase())} over the
        12 months to ${escapeHtml(data.meta.window.end)}. ${escapeHtml(mode.blurb)} Hover for the figures; click
        to open a country.
      </p>
    </div>

    <div class="view-controls">
      <label class="control">Shade by
        <select id="map-mode">
          ${MODES.map((m) => `<option value="${m.key}" ${m.key === mode.key ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>
      <span class="control-note">
        ${mode.key === 'rec'
          ? 'Countries with too little pre-COVID data to compare are left unshaded.'
          : 'Colour is on a logarithmic scale — each shade is roughly ten times the one before it, because arrivals are hugely concentrated on a few countries.'}
        ${data.meta.counts.mappedCountries} of ${data.meta.counts.countries} reported countries have a boundary; the rest sit in each region’s “Other” group.
      </span>
    </div>

    <div class="map-canvas-wrap">
      <div class="map-canvas" id="map-canvas"></div>
    </div>
    <div class="legend" id="map-legend"></div>
  `;

  root.querySelector('#map-mode')?.addEventListener('change', (e) => {
    ctx.setState('mapMode', (e.target as HTMLSelectElement).value);
    void renderMap(root, data, ctx);
  });

  const canvas = root.querySelector('#map-canvas') as HTMLElement;
  const legend = root.querySelector('#map-legend') as HTMLElement;

  let geo: GeoJSON.FeatureCollection;
  try {
    worldCache ??= await loadWorldGeo(ctx.signal);
    geo = worldCache;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    canvas.innerHTML = `<div class="error-state"><p>Could not load map boundaries.</p>
      <button class="btn" id="map-retry">Retry</button></div>`;
    canvas.querySelector('#map-retry')?.addEventListener('click', () => void renderMap(root, data, ctx));
    return;
  }

  const map = L.map(canvas, { minZoom: 1, maxZoom: 8, zoomControl: true, scrollWheelZoom: false, worldCopyJump: true });
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: 'Tiles © CARTO · Boundaries: Natural Earth · Data: ABS',
    subdomains: 'abcd', minZoom: 1, maxZoom: 8,
  }).addTo(map);

  const valueOf = (c: Country): number | null =>
    mode.key === 'vis' ? c.v12 : mode.key === 'ret' ? c.r12 : c.vRecovery;
  const ramp = mode.key === 'rec' ? RAMP_RECOVERY : mode.key === 'ret' ? RAMP_RETURNS : RAMP_VISITORS;
  const values = data.countries.map(valueOf).filter((v): v is number => v !== null && (mode.key === 'rec' || v > 0));
  const breaks = mode.key === 'rec' ? recoveryBreaks() : logBreaks(values, ramp.length);

  const layer = L.geoJSON(geo, {
    style: (f) => {
      const abs = (f?.properties as { abs: string | null })?.abs;
      const c = abs ? data.byCode.get(abs) : null;
      const v = c ? valueOf(c) : null;
      const paint = c && v !== null && (mode.key === 'rec' || v > 0);
      return { fillColor: paint ? rampColour(v as number, breaks, ramp) : NO_DATA_COLOUR, fillOpacity: 0.9, color: '#ffffff', weight: 0.5 };
    },
    onEachFeature: (f, lyr) => {
      const props = f.properties as { abs: string | null; name: string };
      const c = props.abs ? data.byCode.get(props.abs) : null;
      if (!c) {
        lyr.bindTooltip(`<strong>${escapeHtml(props.name ?? 'Unknown')}</strong><br>
          <span style="color:var(--text-tertiary)">Not reported individually</span>`, { sticky: true, className: 'map-tip' });
        return;
      }
      lyr.bindTooltip(
        `<strong>${escapeHtml(shortCountry(c.n))}</strong><br>
         <span class="tip-metric">${escapeHtml(formatNumber(c.v12))} visitors</span> · ${escapeHtml(formatRecovery(c.vRecovery))} of 2019<br>
         <span style="color:var(--text-tertiary)">${escapeHtml(formatNumber(c.r12))} residents returning · ${escapeHtml(shortRegion(c.regionName))}</span>`,
        { sticky: true, className: 'map-tip' },
      );
      lyr.on({
        mouseover: () => (lyr as L.Path).setStyle({ weight: 2, color: '#12263f' }),
        mouseout: () => layer.resetStyle(lyr as L.Path),
        click: () => ctx.openCountry(c.c),
      });
    },
  }).addTo(map);

  legend.innerHTML = mode.key === 'rec' ? recoveryLegend(ramp) : rampLegend(mode.label, ramp, breaks, values);

  const bounds = layer.getBounds();
  const fit = () => { map.invalidateSize(); if (bounds.isValid() && canvas.clientHeight > 50) map.fitBounds(bounds, { padding: [8, 8] }); };
  const ro = new ResizeObserver(() => { if (canvas.clientHeight > 50) { fit(); ro.disconnect(); } });
  ro.observe(canvas);
  const timer = setTimeout(fit, 400);
  ctx.onTeardown(() => { ro.disconnect(); clearTimeout(timer); map.remove(); });
}

function rampLegend(label: string, ramp: string[], breaks: number[], values: number[]): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return `<span>${escapeHtml(label)}:</span>
    <span class="legend-ramp">
      ${ramp.map((c, i) => {
        const a = i === 0 ? lo : breaks[i - 1];
        const b = i === ramp.length - 1 ? hi : breaks[i];
        return `<span class="legend-swatch" style="background:${c}" data-tip="${escapeHtml(formatNumber(a))} – ${escapeHtml(formatNumber(b))}"></span>`;
      }).join('')}
    </span>
    <span class="mono">${escapeHtml(formatNumber(lo))}</span><span style="color:var(--text-muted)">→</span><span class="mono">${escapeHtml(formatNumber(hi))}</span>
    <span class="legend-item" style="margin-left:auto"><span class="legend-swatch" style="background:${NO_DATA_COLOUR}"></span>Not reported</span>`;
}

function recoveryLegend(ramp: string[]): string {
  const labels = ['<40%', '40–70%', '70–95%', '~2019', '105–130%', '130–170%', '>170%'];
  return `<span>Recovery vs 2019:</span>
    <span class="legend-ramp">
      ${ramp.map((c, i) => `<span class="legend-swatch" style="background:${c}" data-tip="${labels[i]} of 2019"></span>`).join('')}
    </span>
    <span class="mono">below</span><span style="color:var(--text-muted)">→</span><span class="mono">above 2019</span>
    <span class="legend-item" style="margin-left:auto"><span class="legend-swatch" style="background:${NO_DATA_COLOUR}"></span>No 2019 baseline</span>`;
}
