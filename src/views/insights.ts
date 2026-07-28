// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { buildInsights } from '../analysis';
import { escapeHtml } from '../format';
import type { Dataset } from '../types';
import type { ViewContext } from './types';

export function renderInsights(root: HTMLElement, data: Dataset, ctx: ViewContext): void {
  const insights = buildInsights(data);
  root.innerHTML = `
    <div class="view-head">
      <h2>What the numbers say</h2>
      <p>Findings the data supports on its own — recomputed from the latest ABS release each month, so nothing
        here is hand-written narrative that could drift out of date.</p>
    </div>
    <div class="insight-grid">
      ${insights.map((it, i) => `
        <article class="insight insight-${it.severity} ${it.view ? 'clickable' : ''}" ${it.view ? `data-view="${escapeHtml(it.view)}"` : ''}
          ${it.country ? `data-country="${escapeHtml(it.country)}"` : ''} ${it.view ? 'tabindex="0" role="button"' : ''} data-i="${i}">
          <h3>${escapeHtml(it.title)}</h3>
          <p>${escapeHtml(it.body)}</p>
          ${it.view ? `<span class="insight-go">${it.country ? 'Open country' : 'Explore'} →</span>` : ''}
        </article>`).join('')}
    </div>
  `;
  root.querySelectorAll<HTMLElement>('.insight.clickable').forEach((el) => {
    const go = (): void => {
      if (el.dataset.country) { ctx.openCountry(el.dataset.country); return; }
      if (el.dataset.view) ctx.goTo(el.dataset.view);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}
