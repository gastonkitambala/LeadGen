import { NextRequest, NextResponse } from "next/server";
import { Business, WebsiteScore } from "@/types";
import { auditMany } from "@/lib/audit";
import { detectSocialPlatform, socialOnlyScore } from "@/lib/audit/score";
import { placeToBusiness } from "@/lib/osm/toBusiness";
import { geocodeCity, GeocodeError } from "@/lib/providers/nominatim";
import { searchOverpass, OverpassError } from "@/lib/providers/overpass";
import { isFoursquareEnabled, searchFoursquare } from "@/lib/providers/foursquare";
import { mergePlaces } from "@/lib/providers/merge";
import { resolveIndustry } from "@/lib/providers/industryTags";
import { RawPlace } from "@/lib/providers/types";

/** Below this many OSM hits, Foursquare is worth asking — if a key is configured. */
const SPARSE_RESULT_THRESHOLD = 5;

/** Auditing is the slow part; more than this makes users wait too long. */
const MAX_AUDITED = 40;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim() ?? "";
  const industryInput = searchParams.get("industry")?.trim() ?? "";
  const mock = searchParams.get("mock") === "true";

  if (mock) {
    const { MOCK_BUSINESSES } = await import("@/lib/mockData");
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ businesses: MOCK_BUSINESSES, source: "mock" });
  }

  if (!city || !industryInput) {
    return NextResponse.json(
      { error: "Both a city and an industry are required" },
      { status: 400 }
    );
  }

  try {
    const area = await geocodeCity(city);
    const industry = resolveIndustry(industryInput);

    const osmPlaces = await searchOverpass(area, industry);

    // Foursquare only fills in where OpenStreetMap is thin, and only when configured.
    const needsFallback =
      osmPlaces.length < SPARSE_RESULT_THRESHOLD && isFoursquareEnabled();
    const fsqPlaces = needsFallback
      ? await searchFoursquare(area, industry.label)
      : [];

    const places = mergePlaces(osmPlaces, fsqPlaces).slice(0, MAX_AUDITED);
    const businesses = await buildBusinesses(places, industry.label, city);

    return NextResponse.json({
      businesses,
      source: fsqPlaces.length > 0 ? "osm+foursquare" : "osm",
      area: area.displayName,
      industry: industry.label,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function buildBusinesses(
  places: RawPlace[],
  industry: string,
  city: string
): Promise<Business[]> {
  // A social profile is not a website. Skip the network call and score it directly —
  // it is a stronger lead than most of the sites we would have audited anyway.
  const socialScores = new Map<number, WebsiteScore>();

  const auditUrls = places.map((place, index) => {
    if (!place.website) return undefined;
    const platform = detectSocialPlatform(place.website);
    if (platform) {
      socialScores.set(index, socialOnlyScore(platform));
      return undefined;
    }
    return place.website;
  });

  const auditedScores = await auditMany(auditUrls);

  return places.map((place, index) =>
    placeToBusiness(place, {
      industry,
      city,
      websiteScore: socialScores.get(index) ?? auditedScores[index],
    })
  );
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof GeocodeError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.kind === "not-found" ? 404 : 502 }
    );
  }

  if (error instanceof OverpassError) {
    return NextResponse.json(
      {
        error:
          "OpenStreetMap search is unavailable right now. It is a free service and throttles under load — try again in a moment.",
      },
      { status: 502 }
    );
  }

  console.error("Search failed:", error);
  return NextResponse.json(
    { error: "Something went wrong while searching for leads" },
    { status: 500 }
  );
}
