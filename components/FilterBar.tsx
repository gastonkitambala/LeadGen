"use client";

import { SortOption, FilterState, WebsiteStatus } from "@/types";
import { ArrowUpDown, Eye, EyeOff, Download } from "lucide-react";
import clsx from "clsx";

interface FilterBarProps {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  total: number;
  shown: number;
  contactedCount: number;
  onExport: () => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "worst_website", label: "Worst Website First" },
  { value: "most_reviews", label: "Most Reviews" },
  { value: "highest_rating", label: "Highest Rating" },
  { value: "alphabetical", label: "A → Z" },
];

const STATUS_FILTERS: { value: WebsiteStatus | "ALL"; label: string; dot: string }[] = [
  { value: "ALL", label: "All", dot: "bg-slate-500" },
  { value: "NO_WEBSITE", label: "No Website", dot: "bg-red-500" },
  { value: "BROKEN", label: "Broken", dot: "bg-orange-500" },
  { value: "OUTDATED", label: "Outdated", dot: "bg-yellow-500" },
  { value: "POOR_MOBILE", label: "Poor Mobile", dot: "bg-violet-500" },
  { value: "NEEDS_WORK", label: "Needs Work", dot: "bg-sky-500" },
];

export default function FilterBar({
  filter,
  onChange,
  total,
  shown,
  contactedCount,
  onExport,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">
            <span className="text-amber-400 font-semibold">{shown}</span>
            <span className="text-slate-600"> / {total}</span>
            <span className="text-slate-500"> leads</span>
          </span>
          {contactedCount > 0 && (
            <span className="text-emerald-500">
              {contactedCount} contacted
            </span>
          )}
        </div>

        <button
          onClick={onExport}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-bg-border",
            "text-xs font-mono text-slate-400 hover:text-amber-400 hover:border-amber-500/30",
            "transition-all duration-200 bg-bg-card hover:bg-amber-500/5"
          )}
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <div className="flex items-center gap-1.5 bg-bg-card border border-bg-border rounded-lg px-3 py-1.5">
          <ArrowUpDown size={12} className="text-amber-500/60" />
          <select
            value={filter.sort}
            onChange={(e) =>
              onChange({ ...filter, sort: e.target.value as SortOption })
            }
            className="bg-transparent text-xs font-mono text-slate-300 focus:outline-none cursor-pointer pr-1"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-bg-surface">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ ...filter, statusFilter: s.value })}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150",
                filter.statusFilter === s.value
                  ? "bg-amber-500/10 border border-amber-500/40 text-amber-400"
                  : "bg-bg-card border border-bg-border text-slate-500 hover:border-bg-muted hover:text-slate-400"
              )}
            >
              <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Hide contacted toggle */}
        <button
          onClick={() =>
            onChange({ ...filter, hideContacted: !filter.hideContacted })
          }
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ml-auto",
            filter.hideContacted
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-bg-card border border-bg-border text-slate-500 hover:text-slate-400"
          )}
        >
          {filter.hideContacted ? <EyeOff size={12} /> : <Eye size={12} />}
          {filter.hideContacted ? "Showing uncontacted" : "Show all"}
        </button>
      </div>
    </div>
  );
}
