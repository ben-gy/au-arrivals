// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// One source of truth for colour. The same entity keeps the same colour across
// every view (line, area, map, bars, table, drawer). Two travellers, nine regions,
// seven reasons.

/** Category of traveller. */
export const C_VISITOR = '#0f6e73'; // ocean teal — visitors arriving (the star)
export const C_RETURN = '#c26a1a';  // warm amber — residents returning home

/** Region colours, keyed by the ABS continental subtotal code (TOn). */
export const REGION_COLOURS: Record<string, string> = {
  TO6: '#c2410c', // North-East Asia (China/Japan/Korea)
  TO5: '#ea580c', // South-East Asia
  TO2: '#0e7490', // North-West Europe (UK/Germany/France)
  TO1: '#15803d', // Oceania & Antarctica (NZ/Pacific)
  TO8: '#7c3aed', // Americas
  TO7: '#b45309', // Southern & Central Asia (India)
  TO3: '#0369a1', // Southern & Eastern Europe
  TO4: '#a16207', // North Africa & the Middle East
  TO9: '#4d7c0f', // Sub-Saharan Africa
};
export function regionColour(code: string | null): string {
  return (code && REGION_COLOURS[code]) || '#64748b';
}

/** Reason-for-journey colours. */
export const REASON_COLOURS: Record<string, string> = {
  H: '#0f766e',  // Holiday
  5: '#c2410c',  // Visiting friends/relatives
  3: '#7c3aed',  // Business
  8: '#0369a1',  // Education
  7: '#b45309',  // Employment
  2: '#0891b2',  // Convention/conference
  O: '#94a3b8',  // Other & not stated
};
export function reasonColour(code: string): string {
  return REASON_COLOURS[code] ?? '#94a3b8';
}

/** Length-of-stay ramp (short → long), warm to cool. */
export const DURATION_COLOURS = [
  '#0f766e', '#0e7490', '#0369a1', '#4338ca', '#7c3aed', '#a21caf', '#be185d',
];

/** Sequential ocean ramp for the visitor-arrivals choropleth (log scale). */
export const RAMP_VISITORS = ['#dcefe9', '#a8d8cf', '#67bcb1', '#2f9d94', '#0f7a76', '#0b5551', '#083b39'];

/** Diverging recovery ramp: amber (below 2019) → neutral → teal (above 2019). */
export const RAMP_RECOVERY = ['#b45309', '#d08a3a', '#e8c79a', '#e8e6e1', '#9fccc4', '#3f9c91', '#0f6e73'];

export const NO_DATA_COLOUR = '#e7e4de';

/** Pick a ramp colour for `value` given ascending `breaks`. */
export function rampColour(value: number, breaks: number[], ramp: string[]): string {
  let i = 0;
  while (i < breaks.length && value > breaks[i]) i++;
  return ramp[Math.min(i, ramp.length - 1)];
}
