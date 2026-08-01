import { describe, expect, it } from "vitest";
import { mergePlaces, normalizeName, distanceMeters } from "./merge";
import { RawPlace } from "./types";

function place(overrides: Partial<RawPlace> = {}): RawPlace {
  return {
    id: "osm:node/1",
    source: "osm",
    name: "Tony's Barbershop",
    lat: 30.2672,
    lng: -97.7431,
    ...overrides,
  };
}

describe("mergePlaces", () => {
  it("keeps distinct businesses separate", () => {
    const merged = mergePlaces(
      [place({ id: "osm:node/1", name: "Tony's Barbershop" })],
      [place({ id: "fsq:2", name: "Golden Crust Bakery", source: "foursquare" })]
    );

    expect(merged).toHaveLength(2);
  });

  it("collapses the same business seen by two providers", () => {
    const merged = mergePlaces(
      [place({ id: "osm:node/1", website: "https://tonys.example" })],
      [
        place({
          id: "fsq:2",
          source: "foursquare",
          name: "Tonys Barbershop",
          rating: 4.5,
          reviewCount: 120,
        }),
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "osm:node/1",
      website: "https://tonys.example",
      rating: 4.5,
      reviewCount: 120,
    });
  });

  it("does not merge same-named businesses that are far apart", () => {
    const merged = mergePlaces(
      [place({ id: "osm:node/1" })],
      [place({ id: "fsq:2", source: "foursquare", lat: 30.4, lng: -97.9 })]
    );

    expect(merged).toHaveLength(2);
  });

  it("lets the first provider win on conflicting values", () => {
    const merged = mergePlaces(
      [place({ phone: "111" })],
      [place({ id: "fsq:2", source: "foursquare", phone: "222" })]
    );

    expect(merged[0].phone).toBe("111");
  });

  it("fills gaps left by the first provider", () => {
    const merged = mergePlaces(
      [place({ phone: undefined })],
      [place({ id: "fsq:2", source: "foursquare", phone: "222" })]
    );

    expect(merged[0].phone).toBe("222");
  });

  it("does not mutate its inputs", () => {
    const first = place({ phone: undefined });
    mergePlaces([first], [place({ id: "fsq:2", phone: "222" })]);

    expect(first.phone).toBeUndefined();
  });

  it("handles being given no groups at all", () => {
    expect(mergePlaces()).toEqual([]);
  });

  it("deduplicates within a single group", () => {
    expect(mergePlaces([place({ id: "osm:node/1" }), place({ id: "osm:node/1" })]))
      .toHaveLength(1);
  });
});

describe("normalizeName", () => {
  it("ignores punctuation, case and spacing", () => {
    expect(normalizeName("Tony's Barbershop")).toBe("tonysbarbershop");
    expect(normalizeName("TONYS  BARBER-SHOP")).toBe("tonysbarbershop");
  });

  it("strips legal suffixes", () => {
    expect(normalizeName("Riverside Plumbing Co.")).toBe(
      normalizeName("Riverside Plumbing")
    );
  });

  it("folds accents onto their base letters", () => {
    expect(normalizeName("Café Verde")).toBe(normalizeName("Cafe Verde"));
  });
});

describe("distanceMeters", () => {
  it("is zero for identical points", () => {
    expect(distanceMeters(30.2672, -97.7431, 30.2672, -97.7431)).toBe(0);
  });

  it("measures a known distance", () => {
    // Austin to Houston is roughly 235 km.
    const km = distanceMeters(30.2672, -97.7431, 29.7604, -95.3698) / 1000;
    expect(km).toBeGreaterThan(225);
    expect(km).toBeLessThan(245);
  });
});
