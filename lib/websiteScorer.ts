import { WebsiteScore, WebsiteStatus } from "@/types";

export function scoreFromPageSpeed(
  mobileScore: number,
  desktopScore: number,
  hasSSL: boolean
): WebsiteScore {
  const composite = mobileScore * 0.65 + desktopScore * 0.35;

  if (!hasSSL || mobileScore < 20) {
    return {
      status: "OUTDATED",
      score: Math.round(composite),
      label: "Outdated",
      reason: `No HTTPS + mobile score: ${mobileScore} — security risk and poor experience`,
      mobileScore,
      desktopScore,
      lastChecked: new Date().toISOString().split("T")[0],
    };
  }

  if (mobileScore < 35) {
    return {
      status: "POOR_MOBILE",
      score: Math.round(composite),
      label: "Poor Mobile",
      reason: `Mobile PageSpeed score: ${mobileScore} — critical performance issues`,
      mobileScore,
      desktopScore,
      lastChecked: new Date().toISOString().split("T")[0],
    };
  }

  if (mobileScore < 60 || desktopScore < 65) {
    return {
      status: "NEEDS_WORK",
      score: Math.round(composite),
      label: "Needs Work",
      reason: `Mobile: ${mobileScore}/100, Desktop: ${desktopScore}/100 — below average`,
      mobileScore,
      desktopScore,
      lastChecked: new Date().toISOString().split("T")[0],
    };
  }

  return {
    status: "DECENT",
    score: Math.round(composite),
    label: "Decent",
    reason: `Mobile: ${mobileScore}/100, Desktop: ${desktopScore}/100`,
    mobileScore,
    desktopScore,
    lastChecked: new Date().toISOString().split("T")[0],
  };
}

export function noWebsiteScore(): WebsiteScore {
  return {
    status: "NO_WEBSITE",
    score: 0,
    label: "No Website",
    reason: "No website listed on Google Business Profile",
  };
}

export function brokenSiteScore(url: string): WebsiteScore {
  return {
    status: "BROKEN",
    score: 5,
    label: "Broken Site",
    reason: `Website at ${url} is unreachable or returns errors`,
    mobileScore: 0,
    desktopScore: 0,
    lastChecked: new Date().toISOString().split("T")[0],
  };
}

export const STATUS_CONFIG: Record<
  WebsiteStatus,
  { color: string; bg: string; border: string; dot: string; priority: number }
> = {
  NO_WEBSITE: {
    color: "text-red-400",
    bg: "bg-red-950/40",
    border: "border-red-500/30",
    dot: "bg-red-500",
    priority: 0,
  },
  BROKEN: {
    color: "text-orange-400",
    bg: "bg-orange-950/40",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
    priority: 1,
  },
  OUTDATED: {
    color: "text-yellow-400",
    bg: "bg-yellow-950/30",
    border: "border-yellow-500/30",
    dot: "bg-yellow-500",
    priority: 2,
  },
  POOR_MOBILE: {
    color: "text-violet-400",
    bg: "bg-violet-950/30",
    border: "border-violet-500/30",
    dot: "bg-violet-500",
    priority: 3,
  },
  NEEDS_WORK: {
    color: "text-sky-400",
    bg: "bg-sky-950/30",
    border: "border-sky-500/30",
    dot: "bg-sky-500",
    priority: 4,
  },
  DECENT: {
    color: "text-emerald-400",
    bg: "bg-emerald-950/30",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    priority: 5,
  },
};
