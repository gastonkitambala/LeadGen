import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AuditSignals } from "./types";
import { analyzeHtml } from "./signals";

const USER_AGENT =
  "LeadHunter/1.0 (website quality audit; +https://github.com/leadhunter)";
const TOTAL_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;

/**
 * Fetches a site and reports what we can observe about it.
 *
 * Never throws: every failure mode becomes an unreachable result with a reason, so one
 * dead domain cannot fail a whole search.
 */
export async function fetchSite(rawUrl: string): Promise<AuditSignals> {
  const started = Date.now();

  const base: AuditSignals = {
    url: rawUrl,
    reachable: false,
    isHttps: false,
    responseMs: 0,
    htmlBytes: 0,
  };

  let url: URL;
  try {
    url = new URL(normalizeUrl(rawUrl));
  } catch {
    return { ...base, error: "invalid-url", responseMs: Date.now() - started };
  }

  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);

  try {
    const response = await followRedirects(url, deadline);
    const finalUrl = new URL(response.url);
    const elapsed = Date.now() - started;

    if (!response.ok) {
      // Drain so the socket is released rather than left hanging.
      await response.body?.cancel().catch(() => undefined);
      return {
        ...base,
        statusCode: response.status,
        finalUrl: finalUrl.toString(),
        isHttps: finalUrl.protocol === "https:",
        responseMs: elapsed,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("html") || contentType === "";

    const body = isHtml ? await readCapped(response) : "";
    const responseMs = Date.now() - started;

    return {
      url: rawUrl,
      reachable: true,
      statusCode: response.status,
      finalUrl: finalUrl.toString(),
      isHttps: finalUrl.protocol === "https:",
      responseMs,
      htmlBytes: Buffer.byteLength(body),
      html: body.length > 0 ? analyzeHtml(body) : undefined,
    };
  } catch (error) {
    return {
      ...base,
      responseMs: Date.now() - started,
      error: classifyError(error),
    };
  }
}

/**
 * Follows redirects by hand so every hop can be re-checked against the SSRF guard.
 *
 * `redirect: "follow"` would validate only the first URL, leaving a public domain free
 * to bounce us into a private address — the classic way a server-side fetcher gets
 * turned into a probe of its own network.
 */
async function followRedirects(start: URL, signal: AbortSignal): Promise<Response> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current);

    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400 && location;
    if (!isRedirect) return response;

    await response.body?.cancel().catch(() => undefined);
    current = new URL(location, current);
  }

  throw new Error("too-many-redirects");
}

/** Reads at most MAX_HTML_BYTES of the body, then abandons the rest. */
async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(
    Buffer.concat(chunks.map((c) => Buffer.from(c)))
  );
}

/**
 * Rejects hosts that resolve to addresses inside our own network.
 *
 * The URLs audited here come from a public, world-editable dataset. Without this the
 * route is a request forgery primitive pointed at whatever the deployment can reach —
 * cloud metadata endpoints being the obvious prize.
 */
async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("blocked-protocol");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new Error("blocked-host");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true }).catch(() => {
        throw new Error("dns");
      });

  if (addresses.length === 0) throw new Error("dns");

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) throw new Error("blocked-host");
  }
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true; // Unparseable means we cannot prove it is safe.
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;

  return (
    a === 0 || // "this network"
    a === 10 || // RFC 1918
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, incl. cloud metadata at 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // RFC 1918
    (a === 192 && b === 168) || // RFC 1918
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();

  // IPv4-mapped addresses (::ffff:10.0.0.1) must be judged by their IPv4 half.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") || // unique local
    normalized.startsWith("fd") || // unique local
    normalized.startsWith("fe80") || // link-local
    normalized.startsWith("ff") // multicast
  );
}

/** Adds a scheme to bare domains, which OSM `website` tags frequently are. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed; // some other scheme; let URL reject it
  return `https://${trimmed}`;
}

function classifyError(error: unknown): string {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (/timeout|aborted|TimeoutError/i.test(message)) return "timeout";
  if (/blocked-host|blocked-protocol/i.test(message)) return "blocked";
  if (/\bdns\b|ENOTFOUND|EAI_AGAIN/i.test(message)) return "dns";
  if (/certificate|SSL|TLS/i.test(message)) return "tls";
  if (/too-many-redirects/i.test(message)) return "redirect-loop";
  return "network";
}
