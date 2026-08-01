import { Business } from "@/types";

const HEADERS = [
  "Business Name",
  "Industry",
  "City",
  "Address",
  "Phone",
  "Website",
  "Website Status",
  "Website Score",
  "Issues Found",
  "Load Time (ms)",
  "Rating",
  "Review Count",
  "Hours",
  "Maps URL",
  "Data Source",
  "Contacted",
];

export function toCsvRows(businesses: Business[]): (string | number)[][] {
  return businesses.map((b) => [
    b.name,
    b.industry,
    b.city,
    b.address,
    b.phone ?? "",
    b.website ?? "No website",
    b.websiteScore.label,
    b.websiteScore.score,
    b.websiteScore.issues?.join("; ") ?? "",
    b.websiteScore.loadMs ?? "",
    b.rating ?? "",
    b.reviewCount ?? "",
    b.hours?.weekday_text?.join(" | ") ?? b.rawHours ?? "",
    b.mapsUrl,
    b.source,
    b.contacted ? "Yes" : "No",
  ]);
}

export function buildCsv(businesses: Business[]): string {
  return [HEADERS, ...toCsvRows(businesses)]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

/**
 * Quotes every cell rather than only the ones that need it. Business names are full of
 * commas, quotes and newlines, and unconditional quoting is the one rule that never
 * produces a broken row.
 */
function escapeCell(cell: string | number): string {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

export function exportToCSV(
  businesses: Business[],
  filename = "leadhunter-results.csv"
) {
  // The BOM is what makes Excel read the file as UTF-8 rather than mangling accents.
  const blob = new Blob(["﻿" + buildCsv(businesses)], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
