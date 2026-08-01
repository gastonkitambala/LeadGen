import { BusinessSource } from "@/types";

/**
 * Provider-neutral place record.
 *
 * Both OpenStreetMap and Foursquare normalize into this shape before anything
 * downstream sees them, so merging, scoring and mapping stay provider-agnostic.
 */
export interface RawPlace {
  /** Stable, source-prefixed id: "osm:node/240109189" or "fsq:4b0588...". */
  id: string;
  source: BusinessSource;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
  /** Raw `opening_hours` value, unparsed. */
  openingHours?: string;
  /** Only ever populated by providers that actually have ratings. */
  rating?: number;
  reviewCount?: number;
}

/** A place resolved to somewhere we can search. */
export interface GeoArea {
  displayName: string;
  lat: number;
  lng: number;
  /**
   * [south, west, north, east].
   *
   * A bounding box is by far the cheapest spatial filter Overpass offers. Scoping by
   * administrative boundary via `area()` is more precise, but it makes the public
   * instance load an area index, and under normal load that reliably times out where
   * the equivalent bbox query answers in under two seconds.
   */
  bbox?: [number, number, number, number];
  /** Fallback search radius in metres when there is no usable bounding box. */
  radiusM: number;
}
