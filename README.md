# LeadHunter

Finds local businesses with a weak web presence, so you can pitch them.

Search a city and an industry. LeadHunter pulls the businesses from OpenStreetMap,
fetches and audits each one's website, and ranks them worst-first — no website at all
is the top of the list, then dead domains, then sites that have not been touched since
Flash was a going concern. Every lead comes with a cold-outreach opener written from
what the audit actually found.

**No API keys. No billing account. No free trial that expires.**

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and search. That's the whole setup — there is nothing to
configure.

## Where the data comes from

| What | Source | Key needed |
| --- | --- | --- |
| City → coordinates | [Nominatim](https://nominatim.org/) | No |
| Businesses | [Overpass API](https://overpass-api.de/) (OpenStreetMap) | No |
| Website quality | Built-in audit engine | No |
| Ratings & reviews | Foursquare, only if you supply a key | Optional |

Business data is © OpenStreetMap contributors, available under the
[ODbL](https://www.openstreetmap.org/copyright).

### The audit engine

There is no Lighthouse or PageSpeed dependency. For each business with a website, the
server fetches the page itself and measures:

- whether it resolves and responds at all
- HTTPS, after following redirects
- response time
- a mobile viewport meta tag, and whether it opts into `width=device-width`
- page weight
- legacy markers: Flash, framesets, `<marquee>`, `<font>`, table-based layout,
  jQuery 1.x, XHTML doctypes
- the newest year in a copyright notice

Those signals produce a 0–100 score and one of six statuses. A business whose only web
presence is a Facebook page is flagged as having no website, because for these purposes
it does not.

Requests are capped at 8 seconds and 512KB, run six at a time, and are refused for
hosts that resolve to private or link-local addresses.

### Optional Foursquare enrichment

OpenStreetMap has no ratings or review counts. If you want them, put a free Foursquare
key in `.env.local`:

```
FOURSQUARE_API_KEY=your_key_here
```

It is then queried only where OpenStreetMap came back thin — fewer than five results —
and any failure silently falls back to OpenStreetMap alone.

## What you should know before relying on it

**OpenStreetMap coverage is thinner than Google's** for small commercial businesses, and
it varies a lot by region: dense in Europe and major metros, patchy in North American
suburbs. Some searches return fewer leads than a paid Places API would. That is the
direct cost of being keyless.

**The public Overpass instance throttles.** It grants two query slots per IP and answers
a perfectly valid query with a 504 a fair share of the time. The client retries across
three mirrors and three rounds, with a longer wait after a rate limit — but a busy
search can still take a few seconds, and under sustained load it can fail. Demo mode
exists for exactly that.

**Free-text industries are limited.** The dropdown industries map to precise OSM tags
and are fast. Anything else falls back to a name search across shops, amenities and
leisure venues — slower, and it will miss offices and trades. Prefer the listed
industries where one fits.

**Open/closed is computed in your browser's time zone**, not the business's. Correct
when prospecting locally; the full weekday hours are always shown next to it.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm test           # unit tests (vitest)
npm run typecheck  # tsc --noEmit
```

## Layout

```
app/
  api/search/route.ts   orchestration: geocode → search → merge → audit
  page.tsx              search, filtering, sorting, contacted state
components/             cards, filters, stats, pitch modal
lib/
  providers/            nominatim, overpass, foursquare, industry tags, merging
  osm/                  OSM element → Business, opening_hours parser
  audit/                fetching, HTML signals, scoring
  cache.ts              TTL cache (geocode 24h, search 1h, audits 6h)
  rateLimit.ts          request spacing and the concurrency pool
```

Modules are split so that the logic is pure and directly testable, while the parts that
touch the network stay thin. Contacted state currently lives in `localStorage`.

## Design notes

`docs/superpowers/specs/` holds the design document behind the keyless rewrite,
including the trade-offs that were accepted and why.
