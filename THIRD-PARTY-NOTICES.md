# Third-party notices

This document lists components distributed with the deployed site (`dist/`) that
are **not** first-party code, along with their licences. The served copy is
`public/third-party-notices.txt`.

## Runtime components (bundled into `dist/`)

Derived from the build's source maps (the `sources` list of what actually ships),
not `npm ls`.

### Leaflet 1.9.4 — BSD-2-Clause

Interactive map library used for the world choropleth.

```
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Map tiles are served at runtime by **CARTO** (light basemap) and are not bundled;
their use is subject to CARTO's terms and attributed on the map.

Everything else in the app is first-party TypeScript and hand-rolled SVG charts,
with system fonts only — no web fonts, no other bundled libraries. The build
toolchain (Vite, TypeScript, Vitest, jsdom and their dependencies) runs only at
build time and is not distributed.

## Boundary geometry

- **Natural Earth** — 1:50m Admin-0 map units. Public domain (no attribution
  required, though it is credited on the map). Simplified with mapshaper in the
  data pipeline.

## Data sources (not code — attribution required by their licences)

- **Australian Bureau of Statistics — Overseas Arrivals and Departures, Australia**,
  via the ABS Data API (data.api.abs.gov.au, dataflows `OAD_COUNTRY` and
  `OAD_REASON`). © Commonwealth of Australia, licensed **CC BY 4.0**.

The ABS licence requires attribution, which is preserved in the site's footer and
its "About" panel. This site is an independent project and is not affiliated with
or endorsed by the Australian Bureau of Statistics.
