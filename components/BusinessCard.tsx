"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Phone,
  Globe,
  MapPin,
  Star,
  Clock,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  WifiOff,
  Smartphone,
  Zap,
} from "lucide-react";
import { Business } from "@/types";
import { STATUS_CONFIG } from "@/lib/websiteScorer";
import { isOpenNow } from "@/lib/osm/openingHours";
import PitchModal from "@/components/PitchModal";
import clsx from "clsx";

interface BusinessCardProps {
  business: Business;
  onToggleContacted: (id: string) => void;
  index: number;
}

const STATUS_ICONS = {
  NO_WEBSITE: WifiOff,
  BROKEN: AlertTriangle,
  OUTDATED: Clock,
  POOR_MOBILE: Smartphone,
  NEEDS_WORK: Zap,
  DECENT: CheckCircle2,
};

const OPPORTUNITY_LABELS: Record<string, string> = {
  NO_WEBSITE: "Hot Lead",
  BROKEN: "Hot Lead",
  OUTDATED: "Strong Lead",
  POOR_MOBILE: "Good Lead",
  NEEDS_WORK: "Warm Lead",
  DECENT: "Soft Lead",
};

/**
 * The audit measures load time directly; demo records predate it and carry a
 * PageSpeed number instead. Show whichever the record actually has.
 */
function formatAuditMetric(business: Business): string {
  const { loadMs, mobileScore } = business.websiteScore;
  if (loadMs !== undefined) {
    return loadMs >= 1000
      ? `Loads in ${(loadMs / 1000).toFixed(1)}s`
      : `Loads in ${Math.round(loadMs)}ms`;
  }
  if (mobileScore !== undefined) return `Mobile: ${mobileScore}/100`;
  return "";
}

const OPPORTUNITY_COLORS: Record<string, string> = {
  NO_WEBSITE: "text-red-400 bg-red-950/50 border-red-500/30",
  BROKEN: "text-orange-400 bg-orange-950/50 border-orange-500/30",
  OUTDATED: "text-yellow-400 bg-yellow-950/40 border-yellow-500/30",
  POOR_MOBILE: "text-violet-400 bg-violet-950/40 border-violet-500/30",
  NEEDS_WORK: "text-sky-400 bg-sky-950/40 border-sky-500/30",
  DECENT: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
};

export default function BusinessCard({
  business,
  onToggleContacted,
  index,
}: BusinessCardProps) {
  const [showPitch, setShowPitch] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [openNow, setOpenNow] = useState<boolean | undefined>(undefined);

  // Resolved after mount, not during render: open/closed depends on the viewer's
  // clock, and the server's answer would differ and trip a hydration mismatch.
  useEffect(() => {
    setOpenNow(business.hours?.open_now ?? isOpenNow(business.hours));
  }, [business.hours]);

  const status = business.websiteScore.status;
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = STATUS_ICONS[status];
  const opportunityLabel = OPPORTUNITY_LABELS[status];

  // Score bar: lower score = better lead = more filled (inverted)
  const leadStrength = Math.max(0, 100 - business.websiteScore.score);

  const animDelay = `${Math.min(index * 60, 400)}ms`;

  return (
    <>
      <div
        className={clsx(
          "group relative bg-bg-card border rounded-xl overflow-hidden transition-all duration-300",
          "animate-card-in",
          business.contacted
            ? "border-bg-border opacity-60 hover:opacity-80"
            : "border-bg-border hover:border-amber-500/25 hover:shadow-card-hover"
        )}
        style={{ animationDelay: animDelay, animationFillMode: "backwards" }}
      >
        {/* Top accent line */}
        <div
          className={clsx(
            "absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
          )}
        />

        {/* Contacted overlay indicator */}
        {business.contacted && (
          <div className="absolute top-3 right-3 z-20">
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-900/80 border border-emerald-500/30 rounded-full text-xs font-mono text-emerald-400">
              <CheckCircle2 size={10} />
              Contacted
            </div>
          </div>
        )}

        {/* Photo */}
        <div className="relative h-36 bg-bg-surface overflow-hidden">
          {business.photoUrl && !imgError ? (
            <Image
              src={business.photoUrl}
              alt={business.name}
              fill
              className="object-cover opacity-80 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-bg-muted flex items-center justify-center">
              <div className="text-4xl opacity-20">
                {business.industry.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/30 to-transparent" />

          {/* Status badge (bottom of image) */}
          <div className="absolute bottom-2 left-3">
            <div
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border",
                statusCfg.color,
                statusCfg.bg,
                statusCfg.border
              )}
            >
              <StatusIcon size={11} />
              {business.websiteScore.label}
            </div>
          </div>

          {/* Opportunity badge */}
          <div className="absolute bottom-2 right-3">
            <div
              className={clsx(
                "px-2 py-1 rounded-full text-xs font-mono border",
                OPPORTUNITY_COLORS[status]
              )}
            >
              {opportunityLabel}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          {/* Business name + rating */}
          <div>
            <h3 className="font-display font-semibold text-slate-100 text-base leading-tight truncate">
              {business.name}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {business.rating && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  <span className="text-xs font-mono text-amber-400 font-semibold">
                    {business.rating.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    ({business.reviewCount?.toLocaleString()})
                  </span>
                </div>
              )}
              {openNow !== undefined && (
                <span
                  className={clsx(
                    "text-xs font-mono",
                    openNow ? "text-emerald-500" : "text-red-400"
                  )}
                >
                  {openNow ? "● Open" : "● Closed"}
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            {business.address && (
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-slate-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-mono text-slate-500 leading-relaxed line-clamp-2">
                  {business.address}
                </span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-slate-600 flex-shrink-0" />
                <a
                  href={`tel:${business.phone}`}
                  className="text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {business.phone}
                </a>
              </div>
            )}
            {business.website ? (
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-slate-600 flex-shrink-0" />
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors truncate"
                >
                  {business.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-red-600 flex-shrink-0" />
                <span className="text-xs font-mono text-red-400/70 italic">
                  No website found
                </span>
              </div>
            )}
          </div>

          {/* Website quality reason */}
          <div
            className={clsx(
              "px-3 py-2 rounded-lg border text-xs font-mono leading-relaxed",
              statusCfg.bg,
              statusCfg.border,
              statusCfg.color
            )}
          >
            {business.websiteScore.reason}
          </div>

          {/* Lead strength bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                Lead Strength
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {formatAuditMetric(business)}
              </span>
            </div>
            <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-700",
                  status === "NO_WEBSITE" || status === "BROKEN"
                    ? "bg-red-500"
                    : status === "OUTDATED"
                    ? "bg-yellow-500"
                    : status === "POOR_MOBILE"
                    ? "bg-violet-500"
                    : status === "NEEDS_WORK"
                    ? "bg-sky-500"
                    : "bg-emerald-500"
                )}
                style={{
                  width: `${leadStrength}%`,
                }}
              />
            </div>
          </div>

          {/* Hours we could not parse are still worth showing verbatim. */}
          {!business.hours?.weekday_text && business.rawHours && (
            <div className="flex items-start gap-2">
              <Clock size={11} className="text-slate-600 mt-0.5 flex-shrink-0" />
              <span className="text-[11px] font-mono text-slate-500 leading-relaxed">
                {business.rawHours}
              </span>
            </div>
          )}

          {/* Hours toggle */}
          {business.hours?.weekday_text && (
            <button
              onClick={() => setShowHours((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-amber-500 transition-colors"
            >
              <Clock size={11} />
              Business hours
              {showHours ? (
                <ChevronUp size={11} />
              ) : (
                <ChevronDown size={11} />
              )}
            </button>
          )}
          {showHours && business.hours?.weekday_text && (
            <div className="bg-bg-surface border border-bg-border rounded-lg p-3 space-y-1">
              {business.hours.weekday_text.map((line, i) => (
                <p key={i} className="text-[11px] font-mono text-slate-400 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPitch(true)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg",
                "text-xs font-mono font-semibold tracking-wide",
                "bg-amber-500 text-bg-base hover:bg-amber-400",
                "transition-all duration-150 active:scale-[0.98]",
                "shadow-amber-sm"
              )}
            >
              <MessageSquare size={12} />
              Copy Pitch
            </button>

            <a
              href={business.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2.5 rounded-lg",
                "text-xs font-mono text-slate-400 hover:text-sky-400",
                "bg-bg-surface border border-bg-border hover:border-sky-500/30",
                "transition-all duration-150"
              )}
            >
              <ExternalLink size={12} />
              Maps
            </a>

            <button
              onClick={() => onToggleContacted(business.id)}
              title={business.contacted ? "Mark as not contacted" : "Mark as contacted"}
              className={clsx(
                "flex items-center justify-center px-3 py-2.5 rounded-lg border transition-all duration-150",
                business.contacted
                  ? "bg-emerald-900/50 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/80"
                  : "bg-bg-surface border-bg-border text-slate-500 hover:border-emerald-500/30 hover:text-emerald-500"
              )}
            >
              {business.contacted ? (
                <CheckCircle2 size={13} />
              ) : (
                <Circle size={13} />
              )}
            </button>
          </div>
        </div>
      </div>

      {showPitch && (
        <PitchModal business={business} onClose={() => setShowPitch(false)} />
      )}
    </>
  );
}
