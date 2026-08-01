import { HtmlSignals, LegacyMarker } from "./types";

/**
 * Extracts quality signals from raw HTML.
 *
 * Regex rather than a DOM parser: we only need a handful of coarse yes/no signals from
 * the first chunk of a document, we run this against dozens of sites per search, and
 * the input is frequently malformed legacy markup that a strict parser would reject.
 * Every pattern below is written to fail closed — an unreadable document simply
 * reports fewer signals rather than throwing.
 */
export function analyzeHtml(html: string): HtmlSignals {
  const metas = extractMetaTags(html);
  const viewport = metas.find((m) => m.name === "viewport");

  return {
    hasViewport: viewport !== undefined,
    viewportResponsive: /width\s*=\s*device-width/i.test(viewport?.content ?? ""),
    hasTitle: hasNonEmptyTitle(html),
    hasMetaDescription: metas.some(
      (m) => m.name === "description" && m.content.trim().length >= 10
    ),
    copyrightYear: findCopyrightYear(html),
    legacyMarkers: findLegacyMarkers(html),
  };
}

interface MetaTag {
  name: string;
  content: string;
}

function extractMetaTags(html: string): MetaTag[] {
  const tags: MetaTag[] = [];
  const metaPattern = /<meta\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1]);
    const name = attrs.name ?? attrs.property;
    if (name) tags.push({ name: name.toLowerCase(), content: attrs.content ?? "" });
  }

  return tags;
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function hasNonEmptyTitle(html: string): boolean {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match !== null && match[1].trim().length > 0;
}

/**
 * Finds the newest year appearing next to a copyright notice.
 *
 * Handles "© 2011", "Copyright 2009-2014", and "&copy; 2018". A range reports its end
 * year, since that is what the site last claimed to be current.
 */
function findCopyrightYear(html: string): number | undefined {
  const pattern =
    /(?:©|&copy;|&#169;|copyright)\s*(?:\(c\)\s*)?(?:(\d{4})\s*[-–—]\s*)?(\d{4})/gi;
  const currentYear = new Date().getFullYear();
  let newest: number | undefined;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const year = Number(match[2]);
    // Ignore nonsense: pre-web years and years beyond next year are not copyrights.
    if (year < 1990 || year > currentYear + 1) continue;
    if (newest === undefined || year > newest) newest = year;
  }

  return newest;
}

function findLegacyMarkers(html: string): LegacyMarker[] {
  const markers: LegacyMarker[] = [];

  if (
    /<(?:object|embed)\b[^>]*(?:\.swf|application\/x-shockwave-flash)/i.test(html) ||
    /\bswfobject\b/i.test(html)
  ) {
    markers.push("flash");
  }

  if (/<frameset\b/i.test(html)) markers.push("frameset");
  if (/<(?:marquee|blink)\b/i.test(html)) markers.push("marquee");
  if (/<font\b/i.test(html) || /<center\b/i.test(html)) markers.push("font-tag");
  if (hasLayoutTables(html)) markers.push("table-layout");
  if (hasLegacyJQuery(html)) markers.push("jquery-1.x");
  if (/<!DOCTYPE\s+html\s+PUBLIC[^>]*XHTML/i.test(html)) markers.push("xhtml-doctype");

  return markers;
}

/**
 * Detects tables used for page layout rather than tabular data.
 *
 * A data table has headers or a caption. A layout table is spotted by the presentation
 * attributes that only ever appeared in hand-rolled 2000s markup.
 */
function hasLayoutTables(html: string): boolean {
  const tablePattern = /<table\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  let layoutTables = 0;

  while ((match = tablePattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1]);
    const hasPresentationAttrs =
      "cellpadding" in attrs ||
      "cellspacing" in attrs ||
      "bgcolor" in attrs ||
      attrs.border === "0" ||
      (attrs.width ?? "").endsWith("%");
    if (hasPresentationAttrs) layoutTables++;
  }

  // One decorated table can be a legitimate data table; nesting them is a layout grid.
  return layoutTables >= 2 || (layoutTables >= 1 && !/<th\b|<caption\b/i.test(html));
}

function hasLegacyJQuery(html: string): boolean {
  const match = /jquery[/@.-]?(\d+)\.(\d+)(?:\.\d+)?(?:\.min)?\.js/i.exec(html);
  if (match) return Number(match[1]) < 2;
  return /jquery\/1\.\d/i.test(html);
}
