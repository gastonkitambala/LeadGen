import { describe, expect, it } from "vitest";
import { elementToPlace, placeToBusiness, OverpassElement } from "./toBusiness";
import { noWebsiteScore } from "@/lib/audit/score";
import { RawPlace } from "@/lib/providers/types";

function element(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: "node",
    id: 12345,
    lat: 30.2672,
    lon: -97.7431,
    tags: { name: "Tony's Barbershop", shop: "hairdresser" },
    ...overrides,
  };
}

describe("elementToPlace", () => {
  it("maps a well-tagged node", () => {
    const place = elementToPlace(
      element({
        tags: {
          name: "Tony's Barbershop",
          shop: "hairdresser",
          phone: "+1 512-555-0142",
          website: "https://tonysbarbers.com",
          opening_hours: "Mo-Fr 09:00-19:00",
          "addr:housenumber": "142",
          "addr:street": "Main St",
          "addr:city": "Austin",
          "addr:state": "TX",
          "addr:postcode": "78701",
        },
      })
    );

    expect(place).toMatchObject({
      id: "osm:node/12345",
      source: "osm",
      name: "Tony's Barbershop",
      address: "142 Main St, Austin, TX 78701",
      phone: "+1 512-555-0142",
      website: "https://tonysbarbers.com/",
      openingHours: "Mo-Fr 09:00-19:00",
    });
  });

  it("skips unnamed features", () => {
    expect(elementToPlace(element({ tags: { shop: "hairdresser" } }))).toBeNull();
  });

  it("skips elements with no resolvable coordinate", () => {
    expect(
      elementToPlace(element({ type: "way", lat: undefined, lon: undefined }))
    ).toBeNull();
  });

  it("uses the center point for ways and relations", () => {
    const place = elementToPlace(
      element({
        type: "way",
        lat: undefined,
        lon: undefined,
        center: { lat: 51.5, lon: -0.12 },
      })
    );

    expect(place).toMatchObject({ id: "osm:way/12345", lat: 51.5, lng: -0.12 });
  });

  it("falls back to contact:* tags", () => {
    const place = elementToPlace(
      element({
        tags: {
          name: "Golden Crust",
          "contact:phone": "+1 512-555-0189",
          "contact:website": "goldencrust.example",
        },
      })
    );

    expect(place?.phone).toBe("+1 512-555-0189");
    expect(place?.website).toBe("https://goldencrust.example/");
  });

  it("builds a partial address from whatever tags exist", () => {
    const place = elementToPlace(
      element({ tags: { name: "Shop", "addr:street": "Main St", "addr:city": "Austin" } })
    );

    expect(place?.address).toBe("Main St, Austin");
  });

  it("leaves the address undefined when there are no address tags", () => {
    expect(elementToPlace(element())?.address).toBeUndefined();
  });

  it.each([
    ["mailto:hi@example.com", "a mailto link"],
    ["tel:+15125550142", "a tel link"],
    ["not a url", "free text with no dot"],
    ["", "an empty value"],
  ])("rejects %s as a website (%s)", (website) => {
    const place = elementToPlace(element({ tags: { name: "Shop", website } }));
    expect(place?.website).toBeUndefined();
  });

  it("takes the first of several semicolon-separated websites", () => {
    const place = elementToPlace(
      element({ tags: { name: "Shop", website: "a.example;b.example" } })
    );

    expect(place?.website).toBe("https://a.example/");
  });
});

describe("placeToBusiness", () => {
  const place: RawPlace = {
    id: "osm:node/1",
    source: "osm",
    name: "Tony's Barbershop",
    address: "142 Main St, Austin",
    lat: 30.2672,
    lng: -97.7431,
    openingHours: "Mo-Fr 09:00-19:00",
  };

  const context = {
    industry: "Barbershop",
    city: "Austin",
    websiteScore: noWebsiteScore(),
  };

  it("parses hours into weekday text", () => {
    const business = placeToBusiness(place, context);

    expect(business.hours?.weekday_text?.[0]).toBe("Monday: 9:00 AM – 7:00 PM");
    expect(business.rawHours).toBeUndefined();
  });

  it("keeps unparseable hours verbatim so the card can still show them", () => {
    const business = placeToBusiness(
      { ...place, openingHours: "by appointment only" },
      context
    );

    expect(business.hours).toBeUndefined();
    expect(business.rawHours).toBe("by appointment only");
  });

  it("builds a maps link from the name and address", () => {
    const business = placeToBusiness(place, context);

    expect(business.mapsUrl).toContain("google.com/maps/search/");
    expect(business.mapsUrl).toContain(encodeURIComponent("Tony's Barbershop"));
  });

  it("falls back to coordinates in the maps link when there is no address", () => {
    const business = placeToBusiness({ ...place, address: undefined }, context);

    expect(business.mapsUrl).toContain(encodeURIComponent("30.2672,-97.7431"));
  });

  it("falls back to the searched city when the place has no address", () => {
    expect(placeToBusiness({ ...place, address: undefined }, context).address)
      .toBe("Austin");
  });

  it("starts every business as not contacted", () => {
    expect(placeToBusiness(place, context).contacted).toBe(false);
  });
});
