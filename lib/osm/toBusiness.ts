import { Business, WebsiteScore } from "@/types";
import { RawPlace } from "@/lib/providers/types";
import { parseOpeningHours } from "./openingHours";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Converts a raw Overpass element into a provider-neutral place.
 *
 * Returns null for elements we cannot use — unnamed features and anything Overpass
 * returned without a resolvable coordinate.
 */
export function elementToPlace(element: OverpassElement): RawPlace | null {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  return {
    id: `osm:${element.type}/${element.id}`,
    source: "osm",
    name,
    address: buildAddress(tags),
    phone: firstTag(tags, ["phone", "contact:phone", "contact:mobile", "mobile"]),
    website: cleanWebsite(
      firstTag(tags, ["website", "contact:website", "url", "contact:url"])
    ),
    lat,
    lng,
    openingHours: tags.opening_hours?.trim() || undefined,
  };
}

function firstTag(
  tags: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * OSM address tags are frequently partial. We assemble whatever exists rather than
 * requiring a full set, because "Main Street, Austin" is still useful to a caller.
 */
function buildAddress(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:housenumber"], tags["addr:street"]]
    .filter(Boolean)
    .join(" ")
    .trim();

  const locality = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"];
  const region = tags["addr:state"] ?? tags["addr:province"];
  const postcode = tags["addr:postcode"];

  const parts = [
    street || undefined,
    locality,
    [region, postcode].filter(Boolean).join(" ").trim() || undefined,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** OSM website tags are user-entered and often missing a scheme or wrapped in junk. */
function cleanWebsite(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  // Some tags hold several URLs separated by ';'. Take the first.
  const first = raw.split(";")[0].trim();
  if (first.length === 0) return undefined;
  if (/^(mailto|tel|fax):/i.test(first)) return undefined;

  const withScheme = /^https?:\/\//i.test(first) ? first : `https://${first}`;

  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export interface BusinessContext {
  industry: string;
  city: string;
  websiteScore: WebsiteScore;
}

export function placeToBusiness(
  place: RawPlace,
  context: BusinessContext
): Business {
  const hours = place.openingHours
    ? parseOpeningHours(place.openingHours)
    : null;

  return {
    id: place.id,
    placeId: place.id,
    name: place.name,
    address: place.address ?? context.city,
    phone: place.phone,
    website: place.website,
    mapsUrl: buildMapsUrl(place),
    rating: place.rating,
    reviewCount: place.reviewCount,
    hours: hours ?? undefined,
    // Kept so the card can still show something when the tag is unparseable.
    rawHours: hours ? undefined : place.openingHours,
    industry: context.industry,
    city: context.city,
    websiteScore: context.websiteScore,
    contacted: false,
    lat: place.lat,
    lng: place.lng,
    source: place.source,
  };
}

/**
 * A plain Google Maps search link — a URL, not an API call, so it costs nothing and
 * needs no key. Falls back to raw coordinates when there is no address to search on.
 */
function buildMapsUrl(place: RawPlace): string {
  const query = place.address
    ? `${place.name}, ${place.address}`
    : `${place.name} ${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
