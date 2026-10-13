# Overseas Arrivals — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-arrivals/ *(redirects to the custom domain once DNS is set)*
- **Custom domain:** https://au-arrivals.benrichardson.dev

## What it is

Fifty years of short-term overseas arrivals to Australia (ABS Overseas Arrivals and
Departures — `OAD_COUNTRY` + `OAD_REASON`), monthly 1975→2026, by country of
residence, reason for journey and length of stay. Built around the COVID cliff:
visitor arrivals fell from 1,077,720 in Dec 2019 to 2,250 in Apr 2020 (−99.8%), then
recovered to ~97% of 2019 — very unevenly by country.

## DNS setup (already applied)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-arrivals` | `ben-gy.github.io` | DNS only (grey cloud) |

If the cert needs re-triggering:
```bash
gh api repos/ben-gy/au-arrivals/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/au-arrivals/pages -X PUT -f cname="au-arrivals.benrichardson.dev"
```
