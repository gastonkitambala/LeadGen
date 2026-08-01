export type WebsiteStatus =
  | "NO_WEBSITE"
  | "BROKEN"
  | "OUTDATED"
  | "POOR_MOBILE"
  | "NEEDS_WORK"
  | "DECENT";

export type SortOption =
  | "worst_website"
  | "most_reviews"
  | "highest_rating"
  | "alphabetical";

export interface BusinessHours {
  open_now?: boolean;
  periods?: {
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }[];
  weekday_text?: string[];
}

export interface WebsiteScore {
  status: WebsiteStatus;
  score: number; // 0–100, lower = worse = better lead
  label: string;
  reason: string;
  /** Measured response time of the audited site, in milliseconds. */
  loadMs?: number;
  /** Human-readable problems the audit found, worst first. */
  issues?: string[];
  /** Only present on demo data, which predates the built-in audit engine. */
  mobileScore?: number;
  desktopScore?: number;
  lastChecked?: string;
}

/** Where a business record came from. */
export type BusinessSource = "osm" | "foursquare" | "mock";

export interface Business {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  mapsUrl: string;
  rating?: number;
  reviewCount?: number;
  hours?: BusinessHours;
  photoUrl?: string;
  industry: string;
  city: string;
  websiteScore: WebsiteScore;
  contacted: boolean;
  placeId: string;
  lat?: number;
  lng?: number;
  source: BusinessSource;
  /** Raw OSM `opening_hours` value, kept when we could not parse it. */
  rawHours?: string;
}

export interface SearchParams {
  city: string;
  industry: string;
}

export interface FilterState {
  sort: SortOption;
  hideContacted: boolean;
  statusFilter: WebsiteStatus | "ALL";
  minReviews: number;
}
