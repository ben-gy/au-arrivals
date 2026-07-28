// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
// ABS SACC country code (the numeric codes used by OAD_COUNTRY) → ISO 3166-1
// alpha-3, for joining to Natural Earth polygons on ISO_A3_EH.
//
// OAD reports only a curated set of ~57 individual countries; the rest of each
// continent lives in an "Other <region>" residual with no polygon. Every code
// here was checked against CL_OAD_ARRIVALS_COUNTRY names, not guessed. A code
// with no single polygon at this scale is simply omitted (it still ranks and
// charts; it just doesn't shade the map).

export const SACC_TO_ISO3 = {
  // Oceania
  1201: 'NZL', // New Zealand
  1301: 'NCL', // New Caledonia
  1302: 'PNG', // Papua New Guinea
  1304: 'VUT', // Vanuatu
  1502: 'FJI', // Fiji
  1505: 'WSM', // Samoa
  // North-West Europe
  21: 'GBR',   // UK, Channel Islands & Isle of Man
  2201: 'IRL', // Ireland
  2301: 'AUT', // Austria
  2302: 'BEL', // Belgium
  2303: 'FRA', // France
  2304: 'DEU', // Germany
  2308: 'NLD', // Netherlands
  2311: 'CHE', // Switzerland
  2401: 'DNK', // Denmark
  2403: 'FIN', // Finland
  2406: 'NOR', // Norway
  2407: 'SWE', // Sweden
  // Southern & Eastern Europe
  3104: 'ITA', // Italy
  3106: 'PRT', // Portugal
  3108: 'ESP', // Spain
  3204: 'HRV', // Croatia
  3207: 'GRC', // Greece
  3307: 'POL', // Poland
  3308: 'RUS', // Russian Federation
  // North Africa & the Middle East
  4203: 'IRN', // Iran
  4205: 'ISR', // Israel
  4208: 'LBN', // Lebanon
  4213: 'SAU', // Saudi Arabia
  4215: 'TUR', // Turkiye
  4216: 'ARE', // United Arab Emirates
  // South-East Asia
  5102: 'KHM', // Cambodia
  5104: 'THA', // Thailand
  5105: 'VNM', // Vietnam
  5202: 'IDN', // Indonesia
  5203: 'MYS', // Malaysia
  5204: 'PHL', // Philippines
  5205: 'SGP', // Singapore
  // North-East Asia
  6101: 'CHN', // China
  6102: 'HKG', // Hong Kong
  6105: 'TWN', // Taiwan
  6201: 'JPN', // Japan
  6203: 'KOR', // Korea, South
  // Southern & Central Asia
  7101: 'BGD', // Bangladesh
  7103: 'IND', // India
  7105: 'NPL', // Nepal
  7106: 'PAK', // Pakistan
  7107: 'LKA', // Sri Lanka
  // Americas
  8102: 'CAN', // Canada
  8104: 'USA', // United States
  8201: 'ARG', // Argentina
  8203: 'BRA', // Brazil
  8204: 'CHL', // Chile
  8205: 'COL', // Colombia
  8213: 'PER', // Peru
  8306: 'MEX', // Mexico
  // Sub-Saharan Africa
  9225: 'ZAF', // South Africa
};

export function resolveIso3(code) {
  return SACC_TO_ISO3[code] ?? SACC_TO_ISO3[Number(code)] ?? null;
}
