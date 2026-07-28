// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import { escapeHtml } from '../format';
import { GLOSSARY, setGlossaryHandler } from '../glossary';

// Click a [data-term] glossary link → a small popover with the definition.
// Click away or Escape to dismiss. One popover element, positioned near the link.
export function initGlossary(): void {
  const pop = document.createElement('div');
  pop.className = 'glossary-pop';
  pop.setAttribute('role', 'dialog');
  document.body.appendChild(pop);

  const close = (): void => pop.classList.remove('open');

  const openFor = (term: string, anchor: HTMLElement): void => {
    const entry = GLOSSARY[term];
    if (!entry) return;
    pop.innerHTML = `<h4>${escapeHtml(entry.term)}</h4><p>${escapeHtml(entry.definition)}</p>`;
    pop.classList.add('open');
    const r = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = r.left;
    let top = r.bottom + 6;
    if (left + pr.width + 12 > window.innerWidth) left = window.innerWidth - pr.width - 12;
    if (top + pr.height + 12 > window.innerHeight) top = r.top - pr.height - 6;
    pop.style.left = `${Math.max(12, left)}px`;
    pop.style.top = `${Math.max(12, top)}px`;
  };

  setGlossaryHandler(openFor);

  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('.glossary-link');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      openFor(link.dataset.term as string, link);
      return;
    }
    if (!(e.target as Element).closest('.glossary-pop')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if ((e.key === 'Enter' || e.key === ' ')) {
      const link = (e.target as Element).closest<HTMLElement>('.glossary-link');
      if (link) { e.preventDefault(); openFor(link.dataset.term as string, link); }
    }
  });
  window.addEventListener('resize', close);
}
