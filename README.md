# Overseas Arrivals

**Who visits Australia, why they come, how long they stay — and how COVID erased the border. Fifty years of monthly ABS data.**

🔗 **Live:** [https://au-arrivals.benrichardson.dev](https://au-arrivals.benrichardson.dev)

## What is this?

Overseas Arrivals turns the ABS *Overseas Arrivals and Departures* release into an
interactive explorer of short-term travel to Australia — every month from July
1975 to now. It counts two flows: overseas visitors arriving for a stay of under a
year, and Australian residents coming home from a short trip abroad, broken down
by country of residence, reason for the journey, and intended length of stay.

The site is built around the single most dramatic data event in modern Australian
statistics: short-term visitor arrivals fell from **1,077,720 in December 2019** to
just **2,250 in April 2020** — a 99.8% collapse — when the international border
closed. From there it traces the recovery country by country (back to about 97% of
2019 overall, but wildly uneven: some markets are past their pre-COVID level, others
still well below), and shows the deeper 50-year story of growth and shifting travel
habits underneath the shock.

Everything is recomputed from the latest ABS release each month, and two
reconciliation checks guard the parse so the numbers are trustworthy.

## Who is this for?

Curious Australians, journalists, tourism-industry analysts, and anyone who
remembers the border closing and wants to see the real curve — plus travel and
economics nerds who want to rebase China against India, read the changing reason
mix, and trace the seasonal rhythm across half a century.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| ABS Overseas Arrivals and Departures — `OAD_COUNTRY` | Short-term visitor arrivals & resident returns by 57 countries of residence + 9 regions | Monthly |
| ABS Overseas Arrivals and Departures — `OAD_REASON` | Same, by main reason for journey and intended length of stay | Monthly |
| Natural Earth (1:50m Admin-0 map units) | World country boundaries for the source-country choropleth | Static (public domain) |

## Features

- **The cliff & the recovery** — 50-year monthly line with the border-closure band, a monthly/12-month-average toggle, and a "is tourism back?" gauge against 2019.
- **World map** — a real Leaflet choropleth of arrivals by source country, with a recovery-vs-2019 diverging mode; click any country for its full record.
- **Compare countries** — rebase any set of countries to their own 2019 average and watch their recovery trajectories diverge on one axis.
- **Why they come** — the reason-for-journey mix (holiday, visiting friends/relatives, business, education, employment) as a stacked area over time, plus a now-vs-2019 dumbbell.
- **How long they stay** — the length-of-stay distribution and how it has shifted.
- **Seasonality** — a year × month calendar heatmap that makes the summer peak, the long-run growth, and the COVID hole all visible at once.
- **Explorer** — a searchable, sortable table of every country with a click-to-filter recovery histogram.
- **Insights** — auto-detected findings, recomputed each month so nothing drifts out of date.

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (48 tests — parser, both reconciliation gates, layout/positional math, and a headless render of every view against the real built data)
- **Maps:** Leaflet + Natural Earth GeoJSON (simplified with mapshaper in the pipeline)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** a dependency-free Node pipeline that fetches the ABS Data API monthly and commits JSON to `public/data/`

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

To refresh the data locally:

```bash
node pipeline/collect.mjs && node pipeline/aggregate.mjs
```

## How it works

The pipeline pulls the `OAD_COUNTRY` and `OAD_REASON` cubes from the ABS Data API
(SDMX-CSV), reshapes them into small JSON files, and downloads + simplifies the
Natural Earth world boundaries. Two hard reconciliation gates run before anything
is written: the total arrivals published in the two cubes must match **exactly**
every month (they are the same population, so a mismatch means a mis-parse), and
each region's member countries must sum to its published subtotal within the
tolerance that the ABS's privacy rounding allows. The browser then loads the JSON
and renders every view client-side. Counts are randomly rounded to the nearest 10
by the ABS for privacy, so small components may not sum exactly to their totals.

## License

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see [ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

A separate commercial licence without the AGPL's source-disclosure obligations is
available on request: <hi@ben.gy>.

Third-party components keep their own licences — see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
Data sources keep theirs, and their attribution requirements are listed in the site's
own methodology/sources section.
