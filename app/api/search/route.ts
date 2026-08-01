import { NextRequest, NextResponse } from "next/server";
import { Business } from "@/types";
import { noWebsiteScore, brokenSiteScore, scoreFromPageSpeed } from "@/lib/websiteScorer";

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
  opening_hours?: {
    open_now: boolean;
    weekday_text?: string[];
    periods?: {
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }[];
  };
  url?: string;
}

async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceResult | null> {
  const fields = [
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "rating",
    "user_ratings_total",
    "geometry",
    "photos",
    "opening_hours",
    "url",
  ].join(",");

  const url = `${PLACES_API_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") return null;
  return data.result as PlaceResult;
}

async function getPageSpeedScore(
  url: string,
  apiKey: string
): Promise<{ mobile: number; desktop: number; hasSSL: boolean } | null> {
  try {
    const hasSSL = url.startsWith("https://");
    const strategy = "mobile";
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}`;

    const mobileRes = await fetch(psUrl);
    const mobileData = await mobileRes.json();

    const mobileScore = Math.round(
      (mobileData?.lighthouseResult?.categories?.performance?.score ?? 0) * 100
    );

    const desktopRes = await fetch(
      psUrl.replace("strategy=mobile", "strategy=desktop")
    );
    const desktopData = await desktopRes.json();
    const desktopScore = Math.round(
      (desktopData?.lighthouseResult?.categories?.performance?.score ?? 0) * 100
    );

    return { mobile: mobileScore, desktop: desktopScore, hasSSL };
  } catch {
    return null;
  }
}

async function checkWebsiteAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const industry = searchParams.get("industry");
  const mock = searchParams.get("mock") === "true";

  if (mock) {
    // Return mock data — imported dynamically to avoid bundling in prod
    const { MOCK_BUSINESSES } = await import("@/lib/mockData");
    // Simulate delay
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ businesses: MOCK_BUSINESSES, source: "mock" });
  }

  if (!city || !industry) {
    return NextResponse.json(
      { error: "city and industry are required" },
      { status: 400 }
    );
  }

  const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
  const PS_KEY = process.env.GOOGLE_PAGESPEED_API_KEY || PLACES_KEY;

  if (!PLACES_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured. Use mock mode for demo." },
      { status: 500 }
    );
  }

  try {
    // Text search for businesses
    const query = `${industry} in ${city}`;
    const searchUrl = `${PLACES_API_BASE}/textsearch/json?query=${encodeURIComponent(query)}&key=${PLACES_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: `Places API error: ${searchData.status}` },
        { status: 502 }
      );
    }

    const placeIds: string[] = (searchData.results ?? [])
      .slice(0, 20)
      .map((r: { place_id: string }) => r.place_id);

    // Fetch details for each place (parallel, max 20)
    const detailsResults = await Promise.allSettled(
      placeIds.map((id) => getPlaceDetails(id, PLACES_KEY))
    );

    const businesses: Business[] = [];

    for (let i = 0; i < detailsResults.length; i++) {
      const result = detailsResults[i];
      if (result.status !== "fulfilled" || !result.value) continue;

      const place = result.value;
      const placeId = placeIds[i];

      let websiteScore = place.website
        ? null
        : noWebsiteScore();

      if (place.website && !websiteScore) {
        const alive = await checkWebsiteAlive(place.website);
        if (!alive) {
          websiteScore = brokenSiteScore(place.website);
        } else if (PS_KEY) {
          const ps = await getPageSpeedScore(place.website, PS_KEY);
          if (ps) {
            websiteScore = scoreFromPageSpeed(ps.mobile, ps.desktop, ps.hasSSL);
          }
        }
      }

      if (!websiteScore) {
        websiteScore = {
          status: "NEEDS_WORK",
          score: 50,
          label: "Needs Work",
          reason: "Could not fetch PageSpeed data",
        };
      }

      const photoUrl = place.photos?.[0]?.photo_reference
        ? `${PLACES_API_BASE}/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${PLACES_KEY}`
        : undefined;

      businesses.push({
        id: placeId,
        name: place.name,
        address: place.formatted_address,
        phone: place.formatted_phone_number,
        website: place.website,
        mapsUrl: place.url || `https://maps.google.com/?place_id=${placeId}`,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        hours: place.opening_hours
          ? {
              open_now: place.opening_hours.open_now,
              weekday_text: place.opening_hours.weekday_text,
              periods: place.opening_hours.periods,
            }
          : undefined,
        photoUrl,
        industry,
        city,
        websiteScore,
        contacted: false,
        placeId,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      });
    }

    return NextResponse.json({ businesses, source: "google" });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch business data" },
      { status: 500 }
    );
  }
}
