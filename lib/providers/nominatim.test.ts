import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { geocodeCity, clearGeocodeCache, GeocodeError, toGeoArea } from "./nominatim";

const AUSTIN = {
  lat: "30.2711286",
  lon: "-97.7436995",
  display_name: "Austin, Travis County, Texas, United States",
  osm_type: "relation" as const,
  osm_id: 113314,
  boundingbox: ["30.0986", "30.5168", "-97.9383", "-97.5614"] as [
    string,
    string,
    string,
    string,
  ],
};

describe("toGeoArea", () => {
  it("reorders Nominatim's box into the order Overpass expects", () => {
    // Nominatim gives [south, north, west, east]; Overpass wants [S, W, N, E].
    expect(toGeoArea(AUSTIN).bbox).toEqual([30.0986, -97.9383, 30.5168, -97.5614]);
  });

  it("discards a box big enough to make the query abusive", () => {
    const area = toGeoArea({ ...AUSTIN, boundingbox: ["25", "37", "-107", "-93"] });

    expect(area.bbox).toBeUndefined();
    expect(area.radiusM).toBe(10_000);
  });

  it("discards an inverted box", () => {
    const area = toGeoArea({
      ...AUSTIN,
      boundingbox: ["30.5168", "30.0986", "-97.5614", "-97.9383"],
    });

    expect(area.bbox).toBeUndefined();
  });

  it("discards a box with unparseable numbers", () => {
    const area = toGeoArea({ ...AUSTIN, boundingbox: ["a", "b", "c", "d"] });

    expect(area.bbox).toBeUndefined();
  });

  it("derives a radius that covers the bounding box", () => {
    // Austin's box is roughly 46 km tall, so the half-diagonal is well over 20 km.
    expect(toGeoArea(AUSTIN).radiusM).toBeGreaterThan(20_000);
  });

  it("clamps the radius for a tiny match", () => {
    const area = toGeoArea({
      ...AUSTIN,
      boundingbox: ["30.2670", "30.2673", "-97.7433", "-97.7430"],
    });

    expect(area.radiusM).toBeGreaterThanOrEqual(2_000);
  });

  it("uses a default radius when there is no bounding box", () => {
    const area = toGeoArea({ ...AUSTIN, boundingbox: undefined });

    expect(area.radiusM).toBe(10_000);
    expect(area.bbox).toBeUndefined();
  });
});

describe("geocodeCity", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearGeocodeCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }

  it("resolves a city to coordinates and an area", async () => {
    global.fetch = vi.fn(async () => mockResponse([AUSTIN])) as unknown as typeof fetch;

    const area = await geocodeCity("Austin, TX");

    expect(area.lat).toBeCloseTo(30.2711, 3);
    expect(area.lng).toBeCloseTo(-97.7437, 3);
    expect(area.bbox).toBeDefined();
  });

  it("sends a descriptive User-Agent, as Nominatim's policy requires", async () => {
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      mockResponse([AUSTIN])
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocodeCity("Austin");

    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("LeadHunter");
  });

  it("reports a not-found error for an unknown place", async () => {
    global.fetch = vi.fn(async () => mockResponse([])) as unknown as typeof fetch;

    await expect(geocodeCity("Nowheresville")).rejects.toMatchObject({
      name: "GeocodeError",
      kind: "not-found",
    });
  });

  it("reports an upstream error when Nominatim is unhappy", async () => {
    global.fetch = vi.fn(async () => mockResponse([], 503)) as unknown as typeof fetch;

    await expect(geocodeCity("Austin")).rejects.toMatchObject({ kind: "upstream" });
  });

  it("rejects an empty city without calling out", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(geocodeCity("   ")).rejects.toThrow(GeocodeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches by normalized city name", async () => {
    const fetchMock = vi.fn(async () => mockResponse([AUSTIN]));
    global.fetch = fetchMock as unknown as typeof fetch;

    await geocodeCity("Austin, TX");
    await geocodeCity("  austin, tx  ");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const fetchMock = vi.fn(async () => mockResponse([AUSTIN]));
    global.fetch = fetchMock as unknown as typeof fetch;

    await Promise.all([geocodeCity("Austin"), geocodeCity("Austin")]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
