import { describe, expect, it } from "vitest";
import {
  resolveIndustry,
  escapeRegex,
  INDUSTRY_OPTIONS,
} from "./industryTags";

describe("resolveIndustry", () => {
  it("resolves a canonical label to its tag filters", () => {
    const result = resolveIndustry("Barbershop");

    expect(result.label).toBe("Barbershop");
    expect(result.filters).toContainEqual({ shop: "hairdresser" });
    expect(result.nameRegex).toBeUndefined();
  });

  it("is case and whitespace insensitive", () => {
    expect(resolveIndustry("  bArBeRsHoP  ").label).toBe("Barbershop");
  });

  it("resolves aliases people actually type", () => {
    expect(resolveIndustry("mechanic").label).toBe("Auto Repair");
    expect(resolveIndustry("coffee shop").label).toBe("Cafe");
    expect(resolveIndustry("attorney").label).toBe("Law Firm");
    expect(resolveIndustry("vet").label).toBe("Veterinarian");
  });

  it("resolves plurals", () => {
    expect(resolveIndustry("bakeries").label).toBe("Bakery");
    expect(resolveIndustry("gyms").label).toBe("Gym");
    expect(resolveIndustry("dentists").label).toBe("Dentist");
  });

  it("supports multi-tag filters for cuisine-specific industries", () => {
    expect(resolveIndustry("Pizza").filters).toContainEqual({
      amenity: "restaurant",
      cuisine: "pizza",
    });
  });

  it("falls back to a name search for unknown input", () => {
    const result = resolveIndustry("escape room");

    expect(result.filters).toEqual([]);
    expect(result.nameRegex).toBe("escape room");
    expect(result.label).toBe("Escape Room");
  });

  it("escapes regex metacharacters in free-text input", () => {
    expect(resolveIndustry("bob's .* shop").nameRegex).not.toContain(".*");
  });

  it("never returns an empty label", () => {
    expect(resolveIndustry("x").label.length).toBeGreaterThan(0);
  });
});

describe("escapeRegex", () => {
  it("neutralises characters that would break an Overpass regex literal", () => {
    expect(escapeRegex('a.b*c"d')).toBe('a\\.b\\*c\\"d');
  });
});

describe("INDUSTRY_OPTIONS", () => {
  it("is sorted and free of duplicates", () => {
    const sorted = [...INDUSTRY_OPTIONS].sort((a, b) => a.localeCompare(b));

    expect(INDUSTRY_OPTIONS).toEqual(sorted);
    expect(new Set(INDUSTRY_OPTIONS).size).toBe(INDUSTRY_OPTIONS.length);
  });

  it("resolves every offered option to real tag filters", () => {
    for (const option of INDUSTRY_OPTIONS) {
      const resolved = resolveIndustry(option);
      expect(resolved.filters.length, `${option} has no filters`).toBeGreaterThan(0);
    }
  });
});
