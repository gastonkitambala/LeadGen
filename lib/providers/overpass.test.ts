import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildQuery,
  parseElements,
  searchOverpass,
  clearOverpassCache,
  OverpassError,
} from "./overpass";
import { resolveIndustry } from "./industryTags";
import { GeoArea } from "./types";

const AREA: GeoArea = {
  displayName: "Austin, Texas, United States",
  lat: 30.2672,
  lng: -97.7431,
  bbox: [30.0986, -97.9383, 30.5168, -97.5614],
  radiusM: 15_000,
};

const BOXLESS: GeoArea = { ...AREA, bbox: undefined };

describe("buildQuery", () => {
  it("scopes to the bounding box when one is known", () => {
    const query = buildQuery(AREA, resolveIndustry("Barbershop"));

    expect(query).toContain(
      'nwr["shop"="hairdresser"](30.0986,-97.9383,30.5168,-97.5614);'
    );
    expect(query).not.toContain("around:");
  });

  // Scoping by administrative boundary is more precise, but it makes the public
  // Overpass instance load an area index and time out under normal load.
  it("never uses the expensive area() form", () => {
    expect(buildQuery(AREA, resolveIndustry("Barbershop"))).not.toContain("area(");
  });

  it("falls back to a radius when there is no usable box", () => {
    const query = buildQuery(BOXLESS, resolveIndustry("Barbershop"));

    expect(query).toContain("(around:15000,30.2672,-97.7431)");
  });

  it("emits one clause per tag filter", () => {
    const query = buildQuery(AREA, resolveIndustry("Barbershop"));

    expect(query).toContain('["shop"="hairdresser"]');
    expect(query).toContain('["craft"="barber"]');
  });

  it("ANDs the tags within a single filter", () => {
    const query = buildQuery(AREA, resolveIndustry("Pizza"));

    expect(query).toContain('["amenity"="restaurant"]["cuisine"="pizza"]');
  });

  it("requests center coordinates so ways and relations are usable", () => {
    expect(buildQuery(AREA, resolveIndustry("Barbershop"))).toContain("out center tags");
  });

  it("constrains a free-text name search to business categories", () => {
    const query = buildQuery(AREA, resolveIndustry("escape room"));

    expect(query).toContain('["name"~"escape room",i]');
    expect(query).toContain('nwr["shop"]');
    expect(query).toContain('nwr["amenity"]');
    expect(query).toContain('nwr["leisure"]');
  });

  // A name regex is unindexed, so each category costs a full scan of the bounding box.
  // Six categories blew the query's own timeout against the public instance.
  it("keeps the free-text scan to three categories", () => {
    const clauses = buildQuery(AREA, resolveIndustry("escape room"))
      .split(/\r?\n/)
      .filter((line) => line.includes("nwr["));

    expect(clauses).toHaveLength(3);
  });

  it("throws when an industry yields nothing searchable", () => {
    expect(() => buildQuery(AREA, { label: "X", filters: [] })).toThrow(OverpassError);
  });
});

describe("parseElements", () => {
  it("keeps named elements and drops the rest", () => {
    const places = parseElements([
      { type: "node", id: 1, lat: 30, lon: -97, tags: { name: "Kept" } },
      { type: "node", id: 2, lat: 30, lon: -97, tags: { shop: "hairdresser" } },
      { type: "way", id: 3, tags: { name: "No coordinates" } },
    ]);

    expect(places.map((p) => p.name)).toEqual(["Kept"]);
  });

  it("returns an empty array for an empty response", () => {
    expect(parseElements([])).toEqual([]);
  });
});

describe("searchOverpass", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearOverpassCache();
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

  function withElements(...names: string[]) {
    return mockResponse({
      elements: names.map((name, i) => ({
        type: "node",
        id: i + 1,
        lat: 30,
        lon: -97,
        tags: { name },
      })),
    });
  }

  it("returns parsed places from the first healthy mirror", async () => {
    global.fetch = vi.fn(async () => withElements("Tony's")) as unknown as typeof fetch;

    const places = await searchOverpass(AREA, resolveIndustry("Barbershop"));

    expect(places).toHaveLength(1);
    expect(places[0].name).toBe("Tony's");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("rotates to the next mirror when one is busy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({}, 504))
      .mockResolvedValueOnce(withElements("Backup"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const places = await searchOverpass(AREA, resolveIndustry("Barbershop"));

    expect(places[0].name).toBe("Backup");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rotates when a mirror throws outright", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(mockResponse({ elements: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(searchOverpass(AREA, resolveIndustry("Barbershop"))).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // The public instance 504s a valid query a good share of the time, then serves the
  // identical query seconds later. Rotating mirrors alone does not survive that.
  it("retries the same mirrors after every one reports busy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({}, 504))
      .mockResolvedValueOnce(mockResponse({}, 504))
      .mockResolvedValueOnce(mockResponse({}, 504))
      .mockResolvedValueOnce(withElements("Eventually"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const places = await searchOverpass(AREA, resolveIndustry("Barbershop"));

    expect(places[0].name).toBe("Eventually");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  }, 20_000);

  it("gives up after exhausting every round", async () => {
    global.fetch = vi.fn(async () => mockResponse({}, 503)) as unknown as typeof fetch;

    await expect(
      searchOverpass(AREA, resolveIndustry("Barbershop"))
    ).rejects.toThrow(OverpassError);
    // Three mirrors across three rounds, and no more.
    expect(global.fetch).toHaveBeenCalledTimes(9);
  }, 30_000);

  // Overpass grants two query slots per IP. A 429 needs a wait long enough for one to
  // be released, not the short backoff that suits a momentarily busy server.
  it("waits longer after a rate limit than after a plain failure", async () => {
    global.fetch = vi.fn(async () => mockResponse({}, 429)) as unknown as typeof fetch;
    const started = Date.now();

    await expect(
      searchOverpass(AREA, resolveIndustry("Barbershop"))
    ).rejects.toThrow(OverpassError);

    expect(Date.now() - started).toBeGreaterThan(12_000);
  }, 40_000);

  it("fails fast on a rejected query instead of retrying it everywhere", async () => {
    const fetchMock = vi.fn(async () => mockResponse({}, 400));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      searchOverpass(AREA, resolveIndustry("Barbershop"))
    ).rejects.toThrow(/rejected the query/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves a repeat search from cache without another request", async () => {
    const fetchMock = vi.fn(async () => mockResponse({ elements: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await searchOverpass(AREA, resolveIndustry("Barbershop"));
    await searchOverpass(AREA, resolveIndustry("Barbershop"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tolerates a response with no elements key", async () => {
    global.fetch = vi.fn(async () => mockResponse({})) as unknown as typeof fetch;

    await expect(searchOverpass(AREA, resolveIndustry("Barbershop"))).resolves.toEqual([]);
  });
});
