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
  mobileScore?: number;
  desktopScore?: number;
  lastChecked?: string;
}

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
