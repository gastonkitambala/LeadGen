import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  parseFoursquare,
  searchFoursquare,
  isFoursquareEnabled,
} from "./foursquare";
import { GeoArea } from "./types";

const AREA: GeoArea = {
  displayName: "Austin",
  lat: 30.2672,
  lng: -97.7431,
  radiusM: 15_000,
};

describe("parseFoursquare", () => {
  it("maps a complete result", () => {
    const [place] = parseFoursquare([
      {
        fsq_place_id: "abc123",
        name: "Tony's Barbershop",
        latitude: 30.2672,
        longitude: -97.7431,
        location: { formatted_address: "142 Main St, Austin, TX 78701" },
        tel: "(512) 555-0142",
        website: "https://tonysbarbers.com",
        rating: 9.0,
        stats: { total_ratings: 120 },
      },
    ]);

    expect(place).toMatchObject({
      id: "fsq:abc123",
      source: "foursquare",
      name: "Tony's Barbershop",
      address: "142 Main St, Austin, TX 78701",
      phone: "(512) 555-0142",
      reviewCount: 120,
    });
  });

  it("converts Foursquare's ten-point rating to the five-point scale the UI shows", () => {
    const [place] = parseFoursquare([
      { fsq_place_id: "a", name: "X", latitude: 1, longitude: 2, rating: 9.0 },
    ]);

    expect(place.rating).toBe(4.5);
  });

  it("reads coordinates from the nested geocodes shape", () => {
    const [place] = parseFoursquare([
      {
        fsq_place_id: "a",
        name: "X",
        geocodes: { main: { latitude: 10, longitude: 20 } },
      },
    ]);

    expect(place).toMatchObject({ lat: 10, lng: 20 });
  });

  it("assembles an address from parts when there is no formatted one", () => {
    const [place] = parseFoursquare([
      {
        fsq_place_id: "a",
        name: "X",
        latitude: 1,
        longitude: 2,
        location: {
          address: "142 Main St",
          locality: "Austin",
          region: "TX",
          postcode: "78701",
        },
      },
    ]);

    expect(place.address).toBe("142 Main St, Austin, TX 78701");
  });

  it("skips results missing an id, a name, or coordinates", () => {
    const places = parseFoursquare([
      { name: "No id", latitude: 1, longitude: 2 },
      { fsq_place_id: "a", latitude: 1, longitude: 2 },
      { fsq_place_id: "b", name: "No coordinates" },
    ]);

    expect(places).toEqual([]);
  });

  it("accepts the legacy fsq_id field", () => {
    const [place] = parseFoursquare([
      { fsq_id: "legacy", name: "X", latitude: 1, longitude: 2 },
    ]);

    expect(place.id).toBe("fsq:legacy");
  });
});

describe("searchFoursquare", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FOURSQUARE_API_KEY;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FOURSQUARE_API_KEY;
    else process.env.FOURSQUARE_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("does nothing without a key, keeping the app keyless by default", async () => {
    delete process.env.FOURSQUARE_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(isFoursquareEnabled()).toBe(false);
    await expect(searchFoursquare(AREA, "Barbershop")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to an empty result rather than throwing on an API error", async () => {
    process.env.FOURSQUARE_API_KEY = "test-key";
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(searchFoursquare(AREA, "Barbershop")).resolves.toEqual([]);
  });

  it("degrades to an empty result when the request throws", async () => {
    process.env.FOURSQUARE_API_KEY = "test-key";
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(searchFoursquare(AREA, "Barbershop")).resolves.toEqual([]);
  });

  it("sends the key as a bearer token", async () => {
    process.env.FOURSQUARE_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await searchFoursquare(AREA, "Barbershop");

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
  });
});
