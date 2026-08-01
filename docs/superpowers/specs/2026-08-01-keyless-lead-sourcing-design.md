# Keyless Lead Sourcing for LeadHunter

**Date:** 2026-08-01
**Status:** Approved

## Problem

LeadHunter's only working path is mock data. The real search path in
`app/api/search/route.ts` requires a billed Google Places API key and derives its
website-quality scores from Google PageSpeed Insights. Anyone cloning the repo gets a
demo, not a product.

## Goal

Replace Google Places and PageSpeed Insights with sources that need no API key and no
billing account, and make every path in the app actually work.

## Decisions

| Decision | Choice |
| --- | --- |
| Business data | OpenStreetMap (Nominatim + Overpass) as primary; Foursquare as optional key-gated fallback |
| Website scoring | Built-in audit engine — we fetch and measure the site ourselves |
| Persistence | Deferred. `contacted` stays in `localStorage`; a database comes later |

## Architecture

The existing route file mixes geocoding, search, network I/O, HTML judgment, and data
mapping. It is split so that logic is testable without network access. Every module is
either **pure** (no I/O, directly unit-tested) or **network** (thin, tested with a
mocked `fetch`).

```
lib/providers/
  types.ts         RawPlace — the provider-neutral shape
  industryTags.ts  "Plumber" -> OSM tag selectors                    (pure)
  nominatim.ts     geocodeCity(city) -> GeoArea                      (network)
  overpass.ts      searchOverpass(area, selectors) -> RawPlace[]     (network)
  foursquare.ts    searchFoursquare(...) -> RawPlace[]               (network, optional)
  merge.ts         dedupe by normalized name + proximity             (pure)
lib/osm/
  openingHours.ts  OSM opening_hours -> weekday_text + periods       (pure)
  toBusiness.ts    RawPlace -> Business                              (pure)
lib/audit/
  fetchSite.ts     GET with timeout, size cap, SSRF guard            (network)
  signals.ts       HTML -> AuditSignals                              (pure)
  score.ts         AuditSignals -> WebsiteScore                      (pure)
  index.ts         auditMany() with a bounded concurrency pool
lib/cache.ts       TTL memory cache
lib/rateLimit.ts   serialized queue with a minimum interval
```

`app/api/search/route.ts` becomes orchestration only: geocode, search, merge, audit,
respond. `lib/websiteScorer.ts` keeps `STATUS_CONFIG`, which is UI styling; its scoring
functions move to `lib/audit/score.ts`.

## Data flow

1. **Geocode.** Nominatim resolves the city string to a center point, a bounding box,
   and an OSM element id. Their usage policy requires a descriptive `User-Agent` and
   permits at most one request per second, which is why `rateLimit.ts` exists.
2. **Search.** When Nominatim returns a relation or way, Overpass queries by
   `area(...)` for precise municipal bounds. Otherwise it falls back to a radius search
   around the center. The query uses `nwr` with `out center tags` so ways and relations
   still carry coordinates. Only elements with a `name` tag are kept.
3. **Fallback.** If `FOURSQUARE_API_KEY` is set *and* OSM returned fewer than 5
   results, Foursquare is queried and the results are merged. Any Foursquare failure
   returns an empty array, so the app degrades to OSM-only rather than erroring.
4. **Merge.** Places are deduped on normalized name plus proximity within ~150m.
5. **Audit.** Every place with a website is fetched and scored, six at a time.
6. **Respond.** `Business[]` plus the source that produced it.

Geocode results cache for 24h, Overpass results for 1h, audits for 6h. The cache sits
behind a small interface so a database can replace it later without touching the route.

## Audit engine

`fetchSite` issues a real GET rather than a HEAD, because too many servers mishandle
HEAD. It applies an 8s timeout, caps the body at 512KB, and refuses private, loopback,
and link-local hosts. That last guard matters: the server fetches arbitrary URLs drawn
from a public dataset, which is a textbook SSRF surface.

`signals.ts` extracts, from the response and HTML:

- reachability and final status code
- whether the final URL is HTTPS
- response time in milliseconds
- HTML byte size
- presence of a mobile viewport meta tag
- presence of a `<title>` and a meta description
- legacy markers: Flash objects, `frameset`, `marquee`, `<font>`/`<center>`,
  table-based layout, jQuery 1.x
- the newest four-digit year in a copyright line

`score.ts` is a pure function from those signals to a `WebsiteScore`. It starts at 100
and subtracts penalties, then maps to a status with this precedence:

```
NO_WEBSITE > BROKEN > OUTDATED > POOR_MOBILE > NEEDS_WORK > DECENT
```

`reason` strings are built from the signals that actually fired, so the copy states
observed facts ("No mobile viewport tag, 4.2s load, no HTTPS") rather than a
Lighthouse number the app no longer has.

## Consequences for the UI

OSM carries no ratings, review counts, or photos. Rather than render zeros:

- `StatsBar` currently computes average rating over *all* businesses and would display
  `0.0`. The rating tile appears only when rating data exists; otherwise that slot
  shows an "Outdated / Needs Work" count.
- `BusinessCard` already guards on `business.rating`, so it needs no change there. It
  gains a client-side open/closed computation from parsed periods.
- `FilterBar`'s review and rating sorts remain, but sort unknown values to the bottom.
- `pitchGenerator.ts` interpolates `{reviews}` in several templates and would emit
  "0 5-star reviews". Templates are partitioned into review-dependent and review-free
  sets, and only eligible templates are drawn.
- `mobileScore`/`desktopScore` go unset. The card's "Mobile: x/100" line renders the
  audit's own score instead.
- Footer text, `.env.example`, and `next.config.mjs` `remotePatterns` drop their Google
  references.

### Open/closed and time zones

`open_now` computed on the server would use the server's time zone, not the business's.
It is therefore computed on the client from parsed `periods` using the browser's local
time, via a pure `isOpenNow(periods, now)` helper. This is correct for the common case
of prospecting in your own city and clearly wrong nowhere that matters, since the
weekday hours are always shown alongside it.

## Error handling

- Nominatim returns nothing: 404 with "City not found".
- All three Overpass mirrors fail: 502 naming the upstream, with the demo-mode hint the
  UI already renders.
- Overpass succeeds with zero elements: 200 with an empty array, which the existing
  empty state handles.
- A single site audit throws or times out: that business gets a `BROKEN` or
  `NEEDS_WORK` score; the search as a whole is unaffected.

## Testing

Vitest. Pure modules get direct unit tests: score, signals, opening hours, industry
tags, merge, CSV export, pitch generation. Network modules are tested against a mocked
`fetch`, covering the failover and degradation paths specifically.

Verification bar before this is called done: `vitest run`, `tsc --noEmit`, and
`next build` all green, plus one live search against a real city returning real leads.

## Known trade-offs

**OSM coverage is thinner than Google** for small commercial businesses and varies by
region — dense in Europe and major metros, sparse in US suburbs. Some searches will
return fewer leads than the Google version would have. This is the direct cost of
being keyless.

**Lighthouse scores and review counts are lost.** In exchange, "no website listed"
detection is arguably better, because a missing OSM `website` tag correlates strongly
with a business that genuinely has no web presence.

## Out of scope

Database persistence, authentication, multi-city batch search, email sending.
