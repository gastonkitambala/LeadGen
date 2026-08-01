import { WebsiteStatus } from "@/types";

/**
 * Presentation config for each website status.
 *
 * The scoring logic that produces these statuses lives in `lib/audit/score.ts`. This
 * file is purely how they look, and `priority` is what "worst website first" sorts on.
 */
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

export { noWebsiteScore, socialOnlyScore, scoreAudit } from "@/lib/audit/score";
