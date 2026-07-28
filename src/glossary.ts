// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// Domain glossary. Assume the reader knows nothing about migration statistics.
// `gloss(term, text)` wraps a phrase in a click-to-explain span (see
// components/glossaryPopover.ts). Terms live here so definitions never drift.

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  shortTerm: {
    term: 'Short-term movement',
    definition:
      'A trip of less than one year. This site counts short-term travellers only — visitors here for under a year and residents back from a trip abroad of under a year. Permanent and long-term migration is a different ABS series.',
  },
  visitorArriving: {
    term: 'Visitor arriving',
    definition:
      'A person who lives overseas arriving in Australia for a short stay — a tourist, a business traveller, a student, someone visiting family. Counted by their country of residence, not their citizenship.',
  },
  residentReturning: {
    term: 'Resident returning',
    definition:
      'An Australian resident coming home from a short trip abroad. Counted by the main country they visited. This is the mirror image of the visitor flow.',
  },
  countryResidence: {
    term: 'Country of residence',
    definition:
      'Where a visitor normally lives — not necessarily their nationality. A French citizen living in Singapore counts as Singapore.',
  },
  recovery: {
    term: 'Recovery vs 2019',
    definition:
      'The trailing 12 months of arrivals as a percentage of the same 12 calendar months in 2019, the last full pre-pandemic year. 100% means back to pre-COVID levels; below means still short.',
  },
  reasonForJourney: {
    term: 'Main reason for journey',
    definition:
      'The primary purpose a traveller gives at the border: holiday, visiting friends or relatives, business, a conference, education, employment, or other. Each trip has exactly one.',
  },
  lengthOfStay: {
    term: 'Intended length of stay',
    definition:
      'How long a short-term visitor says they will stay, in bands from under a week to 6–12 months. It is the intended duration recorded on arrival.',
  },
  original: {
    term: 'Original series',
    definition:
      'The raw monthly count, not seasonally adjusted. Arrivals swing hugely by season (a December peak, a winter trough), and this site keeps that rhythm visible rather than smoothing it away.',
  },
  perturbation: {
    term: 'Randomised rounding',
    definition:
      'To protect individual privacy the ABS randomly rounds every count to the nearest 10. Small components therefore may not sum exactly to their published totals — the difference is a rounding artefact, not an error.',
  },
  oad: {
    term: 'Overseas Arrivals and Departures',
    definition:
      'The ABS release this site draws on, published monthly about five weeks after each reference month. It records border crossings, so one person taking two trips counts twice.',
  },
};

let handler: ((term: string, el: HTMLElement) => void) | null = null;
export function setGlossaryHandler(fn: (term: string, el: HTMLElement) => void): void {
  handler = fn;
}
export function invokeGlossary(term: string, el: HTMLElement): void {
  handler?.(term, el);
}

/** Inline glossary link: the phrase, a tiny ℹ, click to explain. */
export function gloss(key: string, label: string): string {
  const entry = GLOSSARY[key];
  if (!entry) return label;
  return `<span class="glossary-link" data-term="${key}" role="button" tabindex="0"
    aria-label="${label} — what does this mean?">${label}<span class="gloss-icon" aria-hidden="true">ⓘ</span></span>`;
}
