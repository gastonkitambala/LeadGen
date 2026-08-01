/** Everything the audit engine observes about a website. */
export interface AuditSignals {
  /** The URL we were asked to check. */
  url: string;
  /** True when the site answered with a status below 400. */
  reachable: boolean;
  /** HTTP status of the final response, absent when the request never completed. */
  statusCode?: number;
  /** URL after following redirects — a http->https upgrade shows up here. */
  finalUrl?: string;
  /** Whether the final URL is served over HTTPS. */
  isHttps: boolean;
  /** Wall-clock milliseconds to receive the (capped) response body. */
  responseMs: number;
  /** Bytes of HTML read, capped by the fetcher. */
  htmlBytes: number;
  /** Reason the request failed, when it did. */
  error?: string;
  /** HTML-derived signals, absent when nothing was fetched. */
  html?: HtmlSignals;
}

export interface HtmlSignals {
  /** A `<meta name="viewport">` tag exists. */
  hasViewport: boolean;
  /** The viewport tag actually opts into responsive layout via width=device-width. */
  viewportResponsive: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  /** Newest four-digit year found near a copyright notice. */
  copyrightYear?: number;
  /** Named legacy-technology markers found in the markup. */
  legacyMarkers: LegacyMarker[];
}

export type LegacyMarker =
  | "flash"
  | "frameset"
  | "marquee"
  | "font-tag"
  | "table-layout"
  | "jquery-1.x"
  | "xhtml-doctype";

export const LEGACY_MARKER_LABELS: Record<LegacyMarker, string> = {
  flash: "Flash content",
  frameset: "frame-based layout",
  marquee: "<marquee> tags",
  "font-tag": "<font> tags",
  "table-layout": "table-based layout",
  "jquery-1.x": "jQuery 1.x",
  "xhtml-doctype": "XHTML doctype",
};
