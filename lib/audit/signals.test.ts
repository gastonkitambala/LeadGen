import { describe, expect, it } from "vitest";
import { analyzeHtml } from "./signals";

const MODERN_PAGE = `
<!DOCTYPE html>
<html><head>
  <title>Riverside Plumbing</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Emergency plumbing across Austin, 24 hours a day.">
</head><body><p>&copy; 2026 Riverside Plumbing</p></body></html>
`;

const LEGACY_PAGE = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN">
<html><head><title>Bob's Autos</title>
<script src="/js/jquery-1.7.2.min.js"></script>
</head><body>
<table cellpadding="0" cellspacing="0" width="100%"><tr><td>
  <table border="0" bgcolor="#ffffff"><tr><td>
    <font size="2">Welcome!</font>
    <object data="intro.swf" type="application/x-shockwave-flash"></object>
  </td></tr></table>
</td></tr></table>
<p>Copyright 2009-2011 Bob's Autos</p>
</body></html>
`;

describe("analyzeHtml", () => {
  it("recognises a modern, mobile-ready page", () => {
    const signals = analyzeHtml(MODERN_PAGE);

    expect(signals.hasViewport).toBe(true);
    expect(signals.viewportResponsive).toBe(true);
    expect(signals.hasTitle).toBe(true);
    expect(signals.hasMetaDescription).toBe(true);
    expect(signals.legacyMarkers).toEqual([]);
    expect(signals.copyrightYear).toBe(2026);
  });

  it("finds every legacy marker on a 2000s-era page", () => {
    const signals = analyzeHtml(LEGACY_PAGE);

    expect(signals.legacyMarkers).toEqual(
      expect.arrayContaining([
        "flash",
        "font-tag",
        "table-layout",
        "jquery-1.x",
        "xhtml-doctype",
      ])
    );
    expect(signals.hasViewport).toBe(false);
  });

  it("reports the end of a copyright range, not the start", () => {
    expect(analyzeHtml("<p>Copyright 2009-2011 Bob</p>").copyrightYear).toBe(2011);
  });

  it("ignores four-digit numbers that are not copyright years", () => {
    expect(analyzeHtml("<p>Established 1885. Call 5551234.</p>").copyrightYear)
      .toBeUndefined();
  });

  it("treats a fixed-width viewport as present but not responsive", () => {
    const signals = analyzeHtml('<meta name="viewport" content="width=1024">');

    expect(signals.hasViewport).toBe(true);
    expect(signals.viewportResponsive).toBe(false);
  });

  it("does not mistake a data table for a layout table", () => {
    const html = `
      <table><caption>Prices</caption>
        <tr><th>Service</th><th>Cost</th></tr>
        <tr><td>Drain</td><td>$90</td></tr>
      </table>`;

    expect(analyzeHtml(html).legacyMarkers).not.toContain("table-layout");
  });

  it("treats an empty title element as no title", () => {
    expect(analyzeHtml("<title>   </title>").hasTitle).toBe(false);
  });

  it("survives malformed markup without throwing", () => {
    expect(() => analyzeHtml('<meta name=viewport content=<<>> <title>')).not.toThrow();
  });

  it("reads unquoted attribute values", () => {
    const signals = analyzeHtml("<meta name=viewport content=width=device-width>");
    expect(signals.hasViewport).toBe(true);
  });
});
