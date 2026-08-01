import { createCache } from "@/lib/cache";
import { createLimiter, sleep } from "@/lib/rateLimit";
import { elementToPlace, OverpassElement } from "@/lib/osm/toBusiness";
import { ResolvedIndustry, TagFilter } from "./industryTags";
import { GeoArea, RawPlace } from "./types";

/**
 * Business search via the Overpass API.
 *
 * Overpass is free, keyless, and run on donated infrastructure, so it rate-limits hard
 * and the public instances go down regularly. We rotate through mirrors on failure and
 * cache aggressively.
 */

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const USER_AGENT =
  "LeadHunter/1.0 (local business lead generation; +https://github.com/leadhunter)";
const QUERY_TIMEOUT_S = 25;
const REQUEST_TIMEOUT_MS = 40_000;
const RESULT_LIMIT = 60;
const SEARCH_TTL_MS = 60 * 60 * 1000;

/**
 * Categories scanned when free-text input has no tag mapping.
 *
 * A name regex is unindexed, so each category costs a full scan of that category
 * within the bounding box — measured at roughly two seconds each against the public
 * instance. Six categories reliably blew the query's own timeout; these three answer
 * in under seven seconds and cover the long tail that free text is actually for
 * (escape rooms, climbing gyms, board-game cafés). Offices, trades and healthcare are
 * already reachable through the mapped industries, which are far cheaper to query.
 */
const NAME_SEARCH_CATEGORIES = ["shop", "amenity", "leisure"];

export class OverpassError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverpassError";
  }
}

const limiter = createLimiter(700);
const cache = createCache<RawPlace[]>(SEARCH_TTL_MS, 200);

/**
 * Builds the Overpass QL query.
 *
 * `nwr` covers nodes, ways and relations, since a business may be mapped as any of the
 * three. `out center tags` gives ways and relations a single representative coordinate
 * instead of their full geometry, which keeps responses small.
 */
export function buildQuery(area: GeoArea, industry: ResolvedIndustry): string {
  const scope = area.bbox
    ? `(${area.bbox.join(",")})`
    : `(around:${area.radiusM},${area.lat},${area.lng})`;

  const clauses = industry.filters.map(
    (filter) => `  nwr${tagSelector(filter)}${scope};`
  );

  if (clauses.length === 0 && industry.nameRegex) {
    const nameFilter = `["name"~"${industry.nameRegex}",i]`;
    for (const key of NAME_SEARCH_CATEGORIES) {
      clauses.push(`  nwr["${key}"]${nameFilter}${scope};`);
    }
  }

  if (clauses.length === 0) {
    throw new OverpassError("No searchable tags for this industry");
  }

  return [
    `[out:json][timeout:${QUERY_TIMEOUT_S}];`,
    "(",
    ...clauses,
    ");",
    `out center tags ${RESULT_LIMIT};`,
  ].join("\n");
}

export async function searchOverpass(
  area: GeoArea,
  industry: ResolvedIndustry
): Promise<RawPlace[]> {
  const query = buildQuery(area, industry);

  const cached = cache.get(query);
  if (cached) return cached;

  const places = parseElements(await runQuery(query));
  cache.set(query, places);
  return places;
}

/**
 * Statuses that mean "busy, come back", not "your query is wrong".
 *
 * The public Overpass instance answers a perfectly valid query with 504 a good share
 * of the time, then serves the identical query in under two seconds moments later. So
 * retrying the same mirror matters at least as much as rotating to the next one.
 */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

const MAX_ROUNDS = 3;
const BACKOFF_MS = [0, 1500, 3500];

/**
 * 429 means we are out of query slots for this IP, not that the server is momentarily
 * busy. Overpass grants two concurrent slots and releases them on a timer, so this
 * needs a wait long enough for one to actually come back.
 */
const RATE_LIMIT_BACKOFF_MS = 6000;

async function runQuery(query: string): Promise<OverpassElement[]> {
  const failures: string[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (BACKOFF_MS[round] > 0) await sleep(BACKOFF_MS[round]);

    let rateLimited = false;

    for (const mirror of MIRRORS) {
      const outcome = await attempt(mirror, query);

      if (outcome.ok) return outcome.elements;

      failures.push(`${hostOf(mirror)} ${outcome.reason}`);

      if (!outcome.retryable) {
        // A rejected query will be rejected identically everywhere; stop early.
        throw new OverpassError(`OpenStreetMap rejected the query: ${outcome.reason}`);
      }
      if (outcome.rateLimited) rateLimited = true;
    }

    if (rateLimited && round < MAX_ROUNDS - 1) await sleep(RATE_LIMIT_BACKOFF_MS);
  }

  throw new OverpassError(
    `Every OpenStreetMap mirror was unavailable (${dedupe(failures).join("; ")})`
  );
}

type Attempt =
  | { ok: true; elements: OverpassElement[] }
  | { ok: false; reason: string; retryable: boolean; rateLimited?: boolean };

async function attempt(mirror: string, query: string): Promise<Attempt> {
  try {
    const response = await limiter(() =>
      fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: `HTTP ${response.status}`,
        retryable: RETRYABLE_STATUS.has(response.status),
        rateLimited: response.status === 429,
      };
    }

    const payload = (await response.json()) as { elements?: OverpassElement[] };
    return { ok: true, elements: payload.elements ?? [] };
  } catch (error) {
    // Network faults and timeouts are always worth another go.
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "request failed",
      retryable: true,
    };
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parseElements(elements: OverpassElement[]): RawPlace[] {
  const places: RawPlace[] = [];

  for (const element of elements) {
    const place = elementToPlace(element);
    if (place) places.push(place);
  }

  return places;
}

function tagSelector(filter: TagFilter): string {
  return Object.entries(filter)
    .map(([key, value]) => `["${key}"="${value}"]`)
    .join("");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function clearOverpassCache(): void {
  cache.clear();
}
