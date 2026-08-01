import { describe, expect, it } from "vitest";
import { buildCsv, toCsvRows } from "./exportCsv";
import { Business } from "@/types";

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

describe("buildCsv", () => {
  it("starts with a header row", () => {
    const [header] = buildCsv([business()]).split("\r\n");

    expect(header).toContain('"Business Name"');
    expect(header).toContain('"Issues Found"');
    expect(header).toContain('"Data Source"');
  });

  it("emits one row per business", () => {
    const rows = buildCsv([business(), business({ id: "osm:node/2" })]).split("\r\n");

    expect(rows).toHaveLength(3);
  });

  it("escapes quotes by doubling them", () => {
    const csv = buildCsv([business({ name: 'The "Best" Cuts' })]);

    expect(csv).toContain('"The ""Best"" Cuts"');
  });

  it("keeps a comma inside a field from splitting the row", () => {
    const csv = buildCsv([business({ address: "142 Main St, Austin, TX" })]);
    const dataRow = csv.split("\r\n")[1];

    // Sixteen quoted cells means fifteen separators; a leaked comma would add more.
    expect(dataRow.split('","')).toHaveLength(16);
  });

  it("survives a newline inside a field", () => {
    const csv = buildCsv([business({ address: "Line one\nLine two" })]);

    expect(csv).toContain("Line one\nLine two");
  });

  it("writes 'No website' rather than an empty cell", () => {
    expect(toCsvRows([business()])[0]).toContain("No website");
  });

  it("blanks rating and review count rather than writing zero", () => {
    const row = toCsvRows([business()])[0];

    expect(row[10]).toBe("");
    expect(row[11]).toBe("");
  });

  it("joins the audit's issues into one cell", () => {
    const row = toCsvRows([
      business({
        websiteScore: {
          status: "OUTDATED",
          score: 20,
          label: "Outdated",
          reason: "r",
          issues: ["no HTTPS", "Flash content"],
        },
      }),
    ])[0];

    expect(row[8]).toBe("no HTTPS; Flash content");
  });

  it("falls back to raw hours when the parsed ones are missing", () => {
    const row = toCsvRows([business({ rawHours: "by appointment" })])[0];

    expect(row[12]).toBe("by appointment");
  });

  it("handles an empty result set", () => {
    expect(buildCsv([]).split("\r\n")).toHaveLength(1);
  });
});
