"use client";

import { Business } from "@/types";
import { TrendingUp, WifiOff, AlertTriangle, Smartphone, Globe } from "lucide-react";
import clsx from "clsx";

interface StatsBarProps {
  businesses: Business[];
}

export default function StatsBar({ businesses }: StatsBarProps) {
  if (businesses.length === 0) return null;

  const noWebsite = businesses.filter((b) => b.websiteScore.status === "NO_WEBSITE").length;
  const broken = businesses.filter((b) => b.websiteScore.status === "BROKEN").length;
  const poorMobile = businesses.filter(
    (b) => b.websiteScore.status === "POOR_MOBILE" || b.websiteScore.status === "OUTDATED"
  ).length;
  const contacted = businesses.filter((b) => b.contacted).length;
  const hotLeads = noWebsite + broken;
  const avgRating =
    businesses.reduce((acc, b) => acc + (b.rating ?? 0), 0) / businesses.length;

  const stats = [
    {
      icon: TrendingUp,
      label: "Total Leads",
      value: businesses.length,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: WifiOff,
      label: "Hot Leads",
      value: hotLeads,
      color: "text-red-400",
      bg: "bg-red-500/10",
      sub: "No website / broken",
    },
    {
      icon: Smartphone,
      label: "Mobile Issues",
      value: poorMobile,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      icon: Globe,
      label: "Avg Rating",
      value: avgRating.toFixed(1),
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      sub: "across all leads",
    },
    {
      icon: AlertTriangle,
      label: "Contacted",
      value: `${contacted}/${businesses.length}`,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-bg-card border border-bg-border rounded-xl p-4 flex items-start gap-3"
        >
          <div className={clsx("p-2 rounded-lg flex-shrink-0", s.bg)}>
            <s.icon size={14} className={s.color} />
          </div>
          <div className="min-w-0">
            <div className={clsx("text-xl font-display font-bold", s.color)}>
              {s.value}
            </div>
            <div className="text-[11px] font-mono text-slate-500 leading-tight mt-0.5">
              {s.label}
            </div>
            {s.sub && (
              <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                {s.sub}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
