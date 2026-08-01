import { WebsiteScore } from "@/types";
import { AuditSignals, LegacyMarker, LEGACY_MARKER_LABELS } from "./types";

/**
 * Turns observed signals into a lead score.
 *
 * Pure and deterministic apart from the current date, which is injected so the
 * copyright-staleness rule is testable. Lower scores mean a worse website, which for
 * this app means a better lead.
 */
export function scoreAudit(signals: AuditSignals, now = new Date()): WebsiteScore {
  const checkedOn = toIsoDate(now);

  if (!signals.reachable) {
    return {
      status: "BROKEN",
      score: 5,
      label: "Broken Site",
      reason: brokenReason(signals),
      loadMs: signals.responseMs,
      issues: [signals.statusCode ? `HTTP ${signals.statusCode}` : "unreachable"],
      lastChecked: checkedOn,
    };
  }

  const html = signals.html;

  // Reachable but served something we cannot read as a page. Not broken, not gradeable.
  if (!html) {
    return {
      status: "NEEDS_WORK",
      score: 55,
      label: "Needs Work",
      reason: "Site responds but serves no readable HTML — likely a placeholder or redirect loop",
      loadMs: signals.responseMs,
      issues: ["no readable HTML"],
      lastChecked: checkedOn,
    };
  }

  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 100;

  if (!signals.isHttps) {
    score -= 25;
    issues.push("no HTTPS");
  } else {
    strengths.push("HTTPS");
  }

  if (!html.hasViewport) {
    score -= 30;
    issues.push("no mobile viewport tag");
  } else if (!html.viewportResponsive) {
    score -= 18;
    issues.push("viewport not set to device width");
  } else {
    strengths.push("mobile-ready");
  }

  const loadPenalty = loadTimePenalty(signals.responseMs);
  if (loadPenalty > 0) {
    score -= loadPenalty;
    issues.push(`${formatMs(signals.responseMs)} load time`);
  } else {
    strengths.push(`loads in ${formatMs(signals.responseMs)}`);
  }

  if (signals.htmlBytes > 1_500_000) {
    score -= 8;
    issues.push("very heavy page");
  }

  if (html.legacyMarkers.length > 0) {
    score -= Math.min(html.legacyMarkers.length * 12, 36);
    issues.push(...html.legacyMarkers.map((m) => LEGACY_MARKER_LABELS[m]));
  }

  const staleYears = copyrightAge(html.copyrightYear, now);
  if (staleYears !== undefined && staleYears >= 6) {
    score -= 22;
    issues.push(`copyright still says ${html.copyrightYear}`);
  } else if (staleYears !== undefined && staleYears >= 3) {
    score -= 12;
    issues.push(`copyright last updated ${html.copyrightYear}`);
  }

  if (!html.hasTitle) {
    score -= 8;
    issues.push("no page title");
  }
  if (!html.hasMetaDescription) {
    score -= 6;
    issues.push("no meta description");
  }

  score = clamp(score);
  const status = classify(signals, staleYears, score);

  return {
    status,
    score,
    label: STATUS_LABELS[status],
    reason: buildReason(status, issues, strengths),
    loadMs: signals.responseMs,
    issues,
    lastChecked: checkedOn,
  };
}

export function noWebsiteScore(): WebsiteScore {
  return {
    status: "NO_WEBSITE",
    score: 0,
    label: "No Website",
    reason:
      "No website listed — invisible to everyone searching online for this service",
    issues: ["no website"],
  };
}

const SOCIAL_PLATFORMS: Record<string, string> = {
  "facebook.com": "Facebook page",
  "fb.com": "Facebook page",
  "instagram.com": "Instagram profile",
  "twitter.com": "X profile",
  "x.com": "X profile",
  "linktr.ee": "Linktree",
  "linkedin.com": "LinkedIn page",
  "tiktok.com": "TikTok profile",
  "yelp.com": "Yelp listing",
  "google.com": "Google listing",
  "sites.google.com": "Google Sites page",
  "wa.me": "WhatsApp link",
};

/** Returns a human label when a URL is a social profile rather than a real site. */
export function detectSocialPlatform(url: string): string | undefined {
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return undefined;
  }

  const bare = host.replace(/^www\./, "").toLowerCase();
  return SOCIAL_PLATFORMS[bare];
}

/**
 * A business whose only web presence is a social profile is effectively a no-website
 * lead, and a particularly good one — they already understand they need to be online.
 */
export function socialOnlyScore(platform: string): WebsiteScore {
  return {
    status: "NO_WEBSITE",
    score: 2,
    label: "No Website",
    reason: `Only a ${platform} — no real website, and no control over how they are found`,
    issues: [`${platform} only`],
  };
}

const STATUS_LABELS = {
  NO_WEBSITE: "No Website",
  BROKEN: "Broken Site",
  OUTDATED: "Outdated",
  POOR_MOBILE: "Poor Mobile",
  NEEDS_WORK: "Needs Work",
  DECENT: "Decent",
} as const;

/**
 * jQuery 1.x alone says "the dependency is old". The rest say "nobody has opened this
 * site in a decade", which is a different and much stronger sales signal.
 */
const SOFT_MARKERS: ReadonlySet<LegacyMarker> = new Set<LegacyMarker>(["jquery-1.x"]);

function classify(
  signals: AuditSignals,
  staleYears: number | undefined,
  score: number
): WebsiteScore["status"] {
  const markers = signals.html?.legacyMarkers ?? [];
  const hardMarkers = markers.filter((m) => !SOFT_MARKERS.has(m));

  const outdated =
    hardMarkers.length >= 1 ||
    markers.length >= 2 ||
    (staleYears !== undefined && staleYears >= 6) ||
    (!signals.isHttps && staleYears !== undefined && staleYears >= 3);

  if (outdated) return "OUTDATED";

  const mobileBroken =
    !signals.html?.hasViewport || !signals.html?.viewportResponsive;
  if (mobileBroken) return "POOR_MOBILE";

  // Serving over plain HTTP is a concrete, pitchable defect on its own — a site with
  // no other faults still scores above the NEEDS_WORK threshold, so say it explicitly
  // rather than letting an otherwise-clean insecure site come back as "Decent".
  if (!signals.isHttps) return "NEEDS_WORK";

  if (score < 70) return "NEEDS_WORK";
  return "DECENT";
}

function buildReason(
  status: WebsiteScore["status"],
  issues: string[],
  strengths: string[]
): string {
  const listed = formatList(issues.slice(0, 3));

  switch (status) {
    case "OUTDATED":
      return `${capitalize(listed)} — this site has not been touched in years`;
    case "POOR_MOBILE":
      return `${capitalize(listed)} — unusable on phones, where most local searches start`;
    case "NEEDS_WORK":
      return `${capitalize(listed)} — costing search ranking and visitors`;
    case "DECENT":
      return strengths.length > 0
        ? `${capitalize(formatList(strengths))} — solid, but there is room to convert better`
        : "No obvious problems found";
    default:
      return capitalize(listed);
  }
}

function brokenReason(signals: AuditSignals): string {
  if (signals.statusCode) {
    return `Site returns HTTP ${signals.statusCode} — anyone trying to reach this business online hits a dead end`;
  }
  if (signals.error === "timeout") {
    return "Site timed out — visitors give up long before it loads";
  }
  if (signals.error === "dns") {
    return "Domain does not resolve — it has most likely expired";
  }
  return "Site is unreachable — customers looking for this business online find nothing";
}

function loadTimePenalty(ms: number): number {
  if (ms > 6000) return 25;
  if (ms > 3000) return 15;
  if (ms > 1500) return 7;
  return 0;
}

function copyrightAge(year: number | undefined, now: Date): number | undefined {
  if (year === undefined) return undefined;
  return Math.max(0, now.getFullYear() - year);
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function formatList(items: string[]): string {
  if (items.length === 0) return "no issues found";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
