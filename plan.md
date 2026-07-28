# Site Plan: Overseas Arrivals

## Overview
- **Name:** Overseas Arrivals
- **Repo name:** au-arrivals
- **Tagline:** Fifty years of short-term arrivals to Australia — who visits, why they come, how long they stay, and how COVID erased the border.

### Naming Convention
Plain topic name, no country code in the display name. `country: "AU"` in the index entry renders the flag. Distinct from **au-visas** (temporary visa *stock* — who is here on what visa) and **au-population** (permanent net overseas migration). This is short-term *movement*: monthly counts of people crossing the border for less than a year.

## Target Audience
Curious Australians, journalists, tourism-industry people, and anyone who remembers the border slamming shut in 2020 and wants to see the numbers. Also travel/economics nerds who want to trace which countries send visitors and how the mix has changed over 50 years. Mostly desktop for the deep explorer, but must work cold on a phone.

## Value Proposition
One place to see the single most dramatic data event in modern Australian statistics — visitor arrivals falling from 1.08 million in December 2019 to **2,250** in April 2020 (−99.8%) — and then trace the recovery country-by-country, reason-by-reason. No other public tool lets you rebase and compare arrival trajectories across 50 years, see the source-country world map, or watch the seasonal rhythm break and reform. Bookmark-worthy because the questions recur ("is tourism back yet?", "has China recovered?", "why do people come?").

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| ABS OAD_COUNTRY | data.api.abs.gov.au SDMX dataflow `ABS,OAD_COUNTRY,1.0.0` | Short-term visitor arrivals & resident returns by 57 selected countries of residence/destination + 9 continental groups, monthly 1975-07→ | Monthly | No |
| ABS OAD_REASON | data.api.abs.gov.au SDMX dataflow `ABS,OAD_REASON,1.0.0` | Same two traveller types by main reason for journey (holiday/business/VFR/education/employment/conference/other) and intended length of stay, monthly 1975-07→ | Monthly | No |
| Natural Earth 50m admin-0 map units | github nvkelso/natural-earth-vector | World country polygons for the source-country choropleth (public domain) | Static | No |

## Key Features
1. **The Cliff & the Recovery** — 50-year monthly line with the COVID collapse annotated, plus a live "recovery vs 2019" gauge.
2. **Where they come from** — real Leaflet world choropleth of visitor arrivals by source country (last 12 months), toggle visitors ↔ residents-returning.
3. **Look up a country** — searchable multi-country rebased trajectory comparison (deep-linkable), e.g. China vs India vs NZ recovery paths.
4. **Why they come** — reason-for-journey stacked area over time + reason mix now vs pre-COVID (holiday vs the surge in education/employment travel).
5. **How long they stay** — length-of-stay distribution and how it shifted.
6. **Seasonality** — year × month calendar heatmap: the December/January peak, and the COVID hole punched through it.
7. **Rankings & movers** — top source countries + biggest risers/fallers vs 2019 (who recovered, who didn't).
8. **Explorer** — searchable/sortable table of every country with sparklines + recovery %, distribution histogram that click-filters.
9. **Insights** — auto-detected anomalies (record months, laggards, reversals).
Plus a hash-linkable per-country drawer (`#c=6101`) with trajectory, rank, recovery %, and visitors-vs-returns split.

## Target Audience (detailed)
Two modes. A casual reader on a phone who saw a headline ("tourism finally back to pre-COVID") and wants the real curve — they need the Overview and Recovery views to answer in ten seconds. And a power user on desktop (journalist, analyst, travel-trade) who wants to rebase China against India, read the reason mix, and export a mental model — they live in the Country Explorer and Rankings. Emotionally this is a nostalgic/curious dataset, not a stressful one; the border-closure period carries some weight (families separated) so the tone stays factual, never flippant.

## Style Direction
**Tone:** calm, editorial, trustworthy — a quality newspaper's data desk, not a terminal.
**Colour palette:** light theme, warm off-white canvas with a deep teal/ocean-blue primary (travel, horizon, sea/air crossings) and a warm amber secondary for the "visitors arriving" series; a muted slate for "residents returning". Recovery good/shortfall uses green/amber. The COVID band is a soft desaturated red wash.
**UI density:** balanced — news-site density, generous but information-rich. Data values in monospace.
**Dark/light theme:** light (general-audience, editorial). 
**Reference sites for tone:** ABS Data Explorer (authority) crossed with the FT/Guardian visual-data pieces (clarity, annotation).

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (single-page, tab-switched views; no need for React).
- **Data strategy:** pipeline. Monthly cron (the source is monthly — the fastest allowed cadence, and it matches). ABS publishes OAD ~5 weeks after month end; stagger to mid-month. Embeds the latest *data* month, not a run timestamp → idempotent re-runs.
- **Key libraries:** Leaflet (world choropleth) only. All charts hand-rolled SVG. treemap/tooltip/svgZoom/leafletMap/network copied from `patterns/`.

## Layout
Fixed light header (logo + view tabs + About/? button). Main content max-width ~1600px, centred, scrolls normally. Each view is a titled section with subtitle + legend. Sticky footer (flex column) with attribution + directory backlink. Per-country drawer slides in from the right (detached from DOM when closed — iOS scroll rule). On mobile the tabs become a horizontal scroller and multi-column grids collapse to one column with `minmax(0,1fr)`.

## Pages/Views
Overview · Recovery · World map (Where from) · Country explorer · Reasons (Why) · Length of stay · Seasonality · Rankings/Movers · Explorer table · Insights. (Ten tabs; map + 9.)

## Visualization Strategy
Data shape: **temporal × country × (traveller-type) × reason × duration**. It is inherently time-series + one geographic dimension (source country) → the forms that fit:
- **Annotated multi-decade line / area** (Recovery, Reasons, Seasonality-trend) — *the* right form for a 50-year monthly series; answers "what happened and when". COVID band + GST-era style annotations.
- **World choropleth (Leaflet + Natural Earth)** — source countries are geographic; answers "where do visitors come from". Reused au-trade machinery (ISO_A3_EH join). Only the ~57 ABS-reported countries shade; rest honestly "grouped/other".
- **Rebased multi-line comparison** (Country explorer) — answers "how do these countries' trajectories compare", the killer interactive; index each to a base month so a small country (Nepal) and a huge one (China) share an axis.
- **Calendar heatmap** (year × month) — answers "what's the seasonal rhythm and how did COVID break it"; a distribution/temporal form bars can't show.
- **100%-stacked area** (reason mix over time) — answers "how has *why* people come shifted" (holiday's falling share vs education/employment rising).
- **Diverging recovery bars** (Movers) — answers "which countries are above/below their 2019 level"; the winners-vs-laggards spread.
- **Histogram** (Explorer) — distribution of country recovery %, click-to-filter.
- **Ranked horizontal bars** (Rankings) — top sources, colour-consistent per continent.
Litmus test: these views would look wrong for any non-temporal dataset — the COVID cliff, the rebased trajectories, and the seasonality heatmap are specific to a 50-year monthly border series. Deliberately NO treemap-as-hero (composition is secondary here) though a small continent bar is used; the hero is the time axis.

## Reconciliation gates (build fails on drift)
1. **Continental sum gate (within OAD_COUNTRY):** for every month, sum(member countries + Other) == each continental subtotal `TOn`, and sum(TO1..TO9 + NI) == `TOT`. Independently published columns → agreement proves a correct parse.
2. **Cross-flow total gate (OAD_COUNTRY vs OAD_REASON):** for every month, total visitor arrivals in OAD_COUNTRY == total in OAD_REASON (verified: 0 mismatches / 611 months). Two independent dataflows of the same population.
Both run for visitors (06) and residents-returning (05).
