import { createCache, createCachedLoader } from "@/lib/cache";
import { createLimiter } from "@/lib/rateLimit";
import { GeoArea } from "./types";

/**
 * City geocoding via Nominatim.
 *
 * Nominatim is free and keyless but explicitly asks for a descriptive User-Agent and a
 * maximum of one request per second. Both are enforced here rather than left to the
 * caller, because getting this wrong gets the whole deployment blocked.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "LeadHunter/1.0 (local business lead generation; +https://github.com/leadhunter)";
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Widest bounding box we will search directly, in degrees.
 *
 * Guards against a vague query ("Texas", "France") matching a region so large that the
 * resulting Overpass query is abusive. Anything bigger falls back to a radius around
 * the match's centre.
 */
const MAX_BBOX_SPAN_DEG = 2;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  osm_type?: "relation" | "way" | "node";
  osm_id?: number;
  boundingbox?: [string, string, string, string];
  addresstype?: string;
}

export class GeocodeError extends Error {
  constructor(
    message: string,
    readonly kind: "not-found" | "upstream"
  ) {
    super(message);
    this.name = "GeocodeError";
  }
}

const limiter = createLimiter(1100);
const cache = createCache<GeoArea>(GEOCODE_TTL_MS, 200);

async function requestGeocode(city: string): Promise<GeoArea> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", city);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const response = await limiter(() =>
    fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  );

  if (!response.ok) {
    throw new GeocodeError(
      `Nominatim returned HTTP ${response.status}`,
      "upstream"
    );
  }

  const results = (await response.json()) as NominatimResult[];
  if (!Array.isArray(results) || results.length === 0) {
    throw new GeocodeError(`Could not find a place called "${city}"`, "not-found");
  }

  return toGeoArea(results[0]);
}

export function toGeoArea(result: NominatimResult): GeoArea {
  const box = parseBoundingBox(result.boundingbox);

  return {
    displayName: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
    bbox: box,
    radiusM: radiusFromBoundingBox(box),
  };
}

/**
 * Nominatim reports the box as [south, north, west, east] strings; Overpass wants
 * [south, west, north, east] numbers. Oversized and malformed boxes are discarded so
 * the caller falls back to a radius.
 */
function parseBoundingBox(
  box: [string, string, string, string] | undefined
): [number, number, number, number] | undefined {
  if (!box) return undefined;

  const [south, north, west, east] = box.map(Number);
  if ([south, north, west, east].some(Number.isNaN)) return undefined;
  if (north <= south || east <= west) return undefined;
  if (north - south > MAX_BBOX_SPAN_DEG || east - west > MAX_BBOX_SPAN_DEG) {
    return undefined;
  }

  return [south, west, north, east];
}

/** Half the box diagonal, so a fallback circle still covers the matched place. */
function radiusFromBoundingBox(
  box: [number, number, number, number] | undefined
): number {
  if (!box) return 10_000;

  const [south, west, north, east] = box;
  const latSpanM = (north - south) * 111_320;
  const midLat = ((north + south) / 2) * (Math.PI / 180);
  const lngSpanM = (east - west) * 111_320 * Math.cos(midLat);
  const radius = Math.sqrt(latSpanM ** 2 + lngSpanM ** 2) / 2;

  return Math.round(Math.min(Math.max(radius, 2_000), 40_000));
}

const loadGeocode = createCachedLoader(cache, requestGeocode);

export async function geocodeCity(city: string): Promise<GeoArea> {
  const key = city.trim().toLowerCase();
  if (key.length === 0) {
    throw new GeocodeError("No city given", "not-found");
  }
  return loadGeocode(key);
}

export function clearGeocodeCache(): void {
  cache.clear();
}
