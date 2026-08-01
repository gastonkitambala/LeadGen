import { WebsiteScore } from "@/types";
import { createCache, createCachedLoader } from "@/lib/cache";
import { pool } from "@/lib/rateLimit";
import { fetchSite, normalizeUrl } from "./fetchSite";
import { scoreAudit, noWebsiteScore } from "./score";

export { scoreAudit, noWebsiteScore } from "./score";
export { analyzeHtml } from "./signals";
export type { AuditSignals, HtmlSignals } from "./types";

const AUDIT_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 6;

const auditCache = createCache<WebsiteScore>(AUDIT_TTL_MS, 1000);

const loadAudit = createCachedLoader(auditCache, async (url: string) => {
  const signals = await fetchSite(url);
  return scoreAudit(signals);
});

/** Audits one website. Returns a NO_WEBSITE score when the URL is missing or blank. */
export async function auditWebsite(url: string | undefined): Promise<WebsiteScore> {
  if (!url || url.trim().length === 0) return noWebsiteScore();
  return loadAudit(normalizeUrl(url));
}

/**
 * Audits many websites with bounded concurrency.
 *
 * Six at a time keeps a 20-result search inside a few seconds without opening enough
 * sockets to look like an attack to anyone on the receiving end.
 */
export async function auditMany(
  urls: (string | undefined)[]
): Promise<WebsiteScore[]> {
  return pool(
    urls.map((url) => async () => {
      try {
        return await auditWebsite(url);
      } catch {
        // fetchSite already swallows its own failures; this is belt and braces so a
        // surprise rejection degrades one card instead of the entire search.
        return {
          status: "NEEDS_WORK",
          score: 50,
          label: "Needs Work",
          reason: "Could not complete the website audit",
          issues: ["audit failed"],
        } satisfies WebsiteScore;
      }
    }),
    CONCURRENCY
  );
}

/** Exposed so tests and future cache-backed storage can reset state. */
export function clearAuditCache(): void {
  auditCache.clear();
}
