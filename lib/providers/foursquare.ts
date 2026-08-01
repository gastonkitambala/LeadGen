import { GeoArea, RawPlace } from "./types";

/**
 * Optional Foursquare enrichment.
 *
 * Entirely opt-in: without FOURSQUARE_API_KEY the app is keyless and this module never
 * runs. Every failure path returns an empty array rather than throwing, because
 * Foursquare's API contract has changed more than once and a break here must degrade
 * to OpenStreetMap-only results rather than take the search down.
 */

const ENDPOINT = "https://places-api.foursquare.com/places/search";
const API_VERSION = "2025-06-17";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESULTS = 40;

interface FoursquarePlace {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
  };
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  tel?: string;
  website?: string;
  rating?: number;
  stats?: { total_ratings?: number };
  hours?: { display?: string };
}

export function isFoursquareEnabled(): boolean {
  return Boolean(process.env.FOURSQUARE_API_KEY?.trim());
}

export async function searchFoursquare(
  area: GeoArea,
  query: string
): Promise<RawPlace[]> {
  const key = process.env.FOURSQUARE_API_KEY?.trim();
  if (!key) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("ll", `${area.lat},${area.lng}`);
  url.searchParams.set("radius", String(Math.min(area.radiusM, 100_000)));
  url.searchParams.set("limit", String(MAX_RESULTS));

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Places-Api-Version": API_VERSION,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`Foursquare returned HTTP ${response.status}; using OSM only`);
      return [];
    }

    const payload = (await response.json()) as { results?: FoursquarePlace[] };
    return parseFoursquare(payload.results ?? []);
  } catch (error) {
    console.warn(
      `Foursquare request failed (${error instanceof Error ? error.message : "unknown"}); using OSM only`
    );
    return [];
  }
}

export function parseFoursquare(results: FoursquarePlace[]): RawPlace[] {
  const places: RawPlace[] = [];

  for (const result of results) {
    const id = result.fsq_place_id ?? result.fsq_id;
    const name = result.name?.trim();
    const lat = result.latitude ?? result.geocodes?.main?.latitude;
    const lng = result.longitude ?? result.geocodes?.main?.longitude;

    if (!id || !name || lat === undefined || lng === undefined) continue;

    places.push({
      id: `fsq:${id}`,
      source: "foursquare",
      name,
      address: buildAddress(result),
      phone: result.tel?.trim() || undefined,
      website: result.website?.trim() || undefined,
      lat,
      lng,
      openingHours: result.hours?.display?.trim() || undefined,
      // Foursquare rates 0-10; the UI shows a 5-point scale like everything else.
      rating: result.rating !== undefined ? round1(result.rating / 2) : undefined,
      reviewCount: result.stats?.total_ratings,
    });
  }

  return places;
}

function buildAddress(result: FoursquarePlace): string | undefined {
  const location = result.location;
  if (!location) return undefined;
  if (location.formatted_address) return location.formatted_address;

  const parts = [
    location.address,
    location.locality,
    [location.region, location.postcode].filter(Boolean).join(" ").trim() || undefined,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
