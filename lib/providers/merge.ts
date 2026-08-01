import { RawPlace } from "./types";

/**
 * Merges places from multiple providers, collapsing duplicates.
 *
 * The same shop mapped in OSM and listed on Foursquare should appear once, with the
 * union of what each source knows — OSM tends to have the website tag, Foursquare the
 * rating. Matching is by normalized name plus proximity, since neither source shares
 * an identifier with the other.
 */

const DUPLICATE_RADIUS_M = 150;

export function mergePlaces(...groups: RawPlace[][]): RawPlace[] {
  const merged: RawPlace[] = [];

  for (const group of groups) {
    for (const place of group) {
      const existing = merged.find((candidate) => isSamePlace(candidate, place));
      if (existing) {
        Object.assign(existing, enrich(existing, place));
      } else {
        merged.push({ ...place });
      }
    }
  }

  return merged;
}

export function isSamePlace(a: RawPlace, b: RawPlace): boolean {
  if (a.id === b.id) return true;
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  return distanceMeters(a.lat, a.lng, b.lat, b.lng) <= DUPLICATE_RADIUS_M;
}

/**
 * Fills gaps in the earlier record without overwriting it. Whichever provider was
 * queried first wins on conflicts, which keeps results stable across searches.
 */
function enrich(existing: RawPlace, incoming: RawPlace): Partial<RawPlace> {
  return {
    address: existing.address ?? incoming.address,
    phone: existing.phone ?? incoming.phone,
    website: existing.website ?? incoming.website,
    openingHours: existing.openingHours ?? incoming.openingHours,
    rating: existing.rating ?? incoming.rating,
    reviewCount: existing.reviewCount ?? incoming.reviewCount,
  };
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    // Legal suffixes and generic words are noise when comparing two listings.
    .replace(/\b(the|inc|llc|ltd|co|corp|company|gmbh|bv|srl|pty)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Haversine distance in metres. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
