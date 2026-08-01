import { describe, expect, it } from "vitest";
import { generatePitch } from "./pitchGenerator";
import { Business, WebsiteStatus } from "@/types";

function business(overrides: Partial<Business> = {}): Business {
  return {
    id: "osm:node/1",
    placeId: "osm:node/1",
    name: "Tony's Barbershop",
    address: "142 Main St, Austin",
    mapsUrl: "https://maps.example",
    industry: "Barbershop",
    city: "Austin",
    contacted: false,
    source: "osm",
    websiteScore: {
      status: "NO_WEBSITE",
      score: 0,
      label: "No Website",
      reason: "No website listed",
      issues: ["no website"],
    },
    ...overrides,
  };
}

/** Enumerates every template for a business by walking the random draw. */
function allPitches(subject: Business): string[] {
  return Array.from({ length: 40 }, (_, i) =>
    generatePitch(subject, () => (i % 20) / 20)
  );
}

describe("generatePitch", () => {
  it("interpolates the business, city and industry", () => {
    const pitch = generatePitch(business(), () => 0);

    expect(pitch).toContain("Tony's Barbershop");
    expect(pitch).not.toContain("{name}");
    expect(pitch).not.toContain("{city}");
    expect(pitch).not.toContain("{industry}");
  });

  it("leaves no placeholder unfilled in any template", () => {
    const statuses: WebsiteStatus[] = [
      "NO_WEBSITE",
      "BROKEN",
      "OUTDATED",
      "POOR_MOBILE",
      "NEEDS_WORK",
      "DECENT",
    ];

    for (const status of statuses) {
      const subject = business({
        website: "https://tonysbarbers.com",
        reviewCount: 312,
        websiteScore: {
          status,
          score: 40,
          label: status,
          reason: "reason",
          issues: ["no HTTPS", "4.2s load time"],
          loadMs: 4200,
        },
      });

      for (const pitch of allPitches(subject)) {
        expect(pitch, `${status} left a placeholder`).not.toMatch(/{[a-zA-Z]+}/);
      }
    }
  });

  // The whole point of the review-aware templates: OSM has no review counts, and a
  // pitch that opens "with 0 reviews" is worse than one that never mentions them.
  it("never mentions review counts when there are none", () => {
    const withoutReviews = business({ reviewCount: undefined });

    for (const pitch of allPitches(withoutReviews)) {
      expect(pitch).not.toMatch(/\b0 reviews\b/);
      expect(pitch).not.toContain("With 0");
    }
  });

  it("is willing to mention review counts when they exist", () => {
    const withReviews = business({ reviewCount: 312 });
    const mentions = allPitches(withReviews).some((p) => p.includes("312"));

    expect(mentions).toBe(true);
  });

  it("never quotes a load time it does not have", () => {
    const noTiming = business({
      websiteScore: {
        status: "NEEDS_WORK",
        score: 50,
        label: "Needs Work",
        reason: "reason",
      },
    });

    for (const pitch of allPitches(noTiming)) {
      expect(pitch).not.toContain("a while");
      expect(pitch).not.toMatch(/takes .* to load/);
    }
  });

  it("quotes the audit's real findings when it has them", () => {
    const audited = business({
      website: "https://tonysbarbers.com",
      websiteScore: {
        status: "OUTDATED",
        score: 20,
        label: "Outdated",
        reason: "reason",
        issues: ["Flash content", "table-based layout"],
      },
    });

    const mentions = allPitches(audited).some((p) => p.includes("Flash content"));
    expect(mentions).toBe(true);
  });

  it("never prints the literal URL when the business has no website", () => {
    for (const pitch of allPitches(business({ website: undefined }))) {
      expect(pitch).not.toContain("your website appears to be down");
    }
  });

  it("always produces a signable message", () => {
    const pitch = generatePitch(business(), () => 0.5);

    expect(pitch).toContain("[Your Name]");
    expect(pitch.length).toBeGreaterThan(80);
  });

  it("is deterministic for a fixed random source", () => {
    const subject = business();

    expect(generatePitch(subject, () => 0.3)).toBe(generatePitch(subject, () => 0.3));
  });
});
