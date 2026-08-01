import { Business } from "@/types";

export function exportToCSV(businesses: Business[], filename = "leadhunter-results.csv") {
  const headers = [
    "Business Name",
    "Industry",
    "City",
    "Address",
    "Phone",
    "Website",
    "Website Status",
    "Website Score",
    "Mobile PageSpeed",
    "Desktop PageSpeed",
    "Google Rating",
    "Review Count",
    "Open Now",
    "Hours",
    "Google Maps URL",
    "Contacted",
  ];

  const rows = businesses.map((b) => [
    b.name,
    b.industry,
    b.city,
    b.address,
    b.phone ?? "",
    b.website ?? "No website",
    b.websiteScore.label,
    b.websiteScore.score,
    b.websiteScore.mobileScore ?? "",
    b.websiteScore.desktopScore ?? "",
    b.rating ?? "",
    b.reviewCount ?? "",
    b.hours?.open_now ? "Yes" : "No",
    b.hours?.weekday_text?.join(" | ") ?? "",
    b.mapsUrl,
    b.contacted ? "Yes" : "No",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
