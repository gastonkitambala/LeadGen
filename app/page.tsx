"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Target,
  Crosshair,
  AlertCircle,
  SearchX,
  ChevronRight,
  Activity,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import BusinessCard from "@/components/BusinessCard";
import SkeletonCard from "@/components/SkeletonCard";
import FilterBar from "@/components/FilterBar";
import StatsBar from "@/components/StatsBar";
import { Business, FilterState } from "@/types";
import { STATUS_CONFIG } from "@/lib/websiteScorer";
import { exportToCSV } from "@/lib/exportCsv";
import clsx from "clsx";

const CONTACTED_KEY = "leadhunter_contacted";

function loadContacted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(CONTACTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveContacted(ids: Set<string>) {
  try {
    localStorage.setItem(CONTACTED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

const DEFAULT_FILTER: FilterState = {
  sort: "worst_website",
  hideContacted: false,
  statusFilter: "ALL",
  minReviews: 0,
};

const TICKER_ITEMS = [
  "12,400+ businesses found last month",
  "Avg cold pitch reply rate: 18%",
  "No website = instant hot lead",
  "Sort by worst website to find the best opportunities",
  "Export CSV to manage your pipeline",
  "Mark businesses as contacted to track progress",
  "Demo mode works without API keys",
];

export default function HomePage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [mockMode, setMockMode] = useState(true);
  const [contacted, setContacted] = useState<Set<string>>(new Set());
  const [searchMeta, setSearchMeta] = useState<{
    city: string;
    industry: string;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [source, setSource] = useState<"google" | "mock" | null>(null);

  // Load contacted from localStorage
  useEffect(() => {
    setContacted(loadContacted());
  }, []);

  const toggleContacted = useCallback(
    (id: string) => {
      setContacted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveContacted(next);
        return next;
      });
    },
    []
  );

  // Merge contacted state into businesses
  const businessesWithContacted = useMemo(
    () =>
      businesses.map((b) => ({
        ...b,
        contacted: contacted.has(b.id),
      })),
    [businesses, contacted]
  );

  // Apply filters and sorting
  const filteredBusinesses = useMemo(() => {
    let result = [...businessesWithContacted];

    // Status filter
    if (filter.statusFilter !== "ALL") {
      result = result.filter(
        (b) => b.websiteScore.status === filter.statusFilter
      );
    }

    // Hide contacted
    if (filter.hideContacted) {
      result = result.filter((b) => !b.contacted);
    }

    // Sort
    switch (filter.sort) {
      case "worst_website":
        result.sort(
          (a, b) =>
            STATUS_CONFIG[a.websiteScore.status].priority -
            STATUS_CONFIG[b.websiteScore.status].priority ||
            a.websiteScore.score - b.websiteScore.score
        );
        break;
      case "most_reviews":
        result.sort(
          (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
        );
        break;
      case "highest_rating":
        result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "alphabetical":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [businessesWithContacted, filter]);

  const handleSearch = useCallback(
    async (city: string, industry: string, isMock: boolean) => {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      setSearchMeta({ city, industry });

      try {
        const params = new URLSearchParams({ city, industry });
        if (isMock) params.set("mock", "true");

        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch results");
        }

        setBusinesses(data.businesses ?? []);
        setSource(data.source);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setBusinesses([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleExport = useCallback(() => {
    exportToCSV(filteredBusinesses, `leadhunter-${searchMeta?.city ?? "results"}.csv`);
  }, [filteredBusinesses, searchMeta]);

  const contactedCount = useMemo(
    () => businessesWithContacted.filter((b) => b.contacted).length,
    [businessesWithContacted]
  );

  return (
    <div className="min-h-screen grid-bg">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/3 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-bg-border bg-bg-base/80 backdrop-blur-md sticky top-0 z-40">
        {/* Ticker tape */}
        <div className="border-b border-bg-border bg-bg-surface/60 py-1.5 overflow-hidden">
          <div className="ticker-wrap">
            <div className="ticker-content text-[10px] font-mono text-amber-500/40 tracking-wider">
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                <span key={i} className="mx-8">
                  <span className="text-amber-500/60 mr-2">›</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center">
                <Crosshair size={18} className="text-amber-500" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-ping-slow" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full" />
            </div>

            <div>
              <h1 className="font-display font-bold text-xl tracking-tight">
                Lead<span className="text-amber-500">Hunter</span>
              </h1>
              <p className="text-[11px] font-mono text-slate-600 -mt-0.5">
                Find businesses that need your services
              </p>
            </div>

            <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-600">
              <Activity size={11} className="text-emerald-500" />
              <span className="text-emerald-500">LIVE</span>
              <span className="text-slate-700">|</span>
              <span>Web Audit Engine v2.4</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero + Search */}
        <section className="space-y-6">
          {/* Hero text */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Target size={11} className="text-amber-500" />
                <span className="text-[11px] font-mono text-amber-500 tracking-widest uppercase">
                  Lead Intelligence
                </span>
              </div>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
              Find businesses{" "}
              <span className="text-amber-500 relative">
                bleeding money
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-amber-500/30" />
              </span>{" "}
              with a bad web presence.
            </h2>
            <p className="text-slate-500 text-sm font-mono leading-relaxed">
              Search any city + industry to surface local businesses with no
              website, broken sites, or poor mobile scores. Generate a
              personalized pitch in one click.
            </p>
          </div>

          {/* Search bar */}
          <div className="bg-bg-surface border border-bg-border rounded-2xl p-5 amber-pulse">
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              mockMode={mockMode}
              onToggleMock={() => setMockMode((v) => !v)}
            />
          </div>
        </section>

        {/* Results */}
        {loading && (
          <section className="space-y-5 animate-fade-in">
            <div className="h-5 w-48 bg-bg-muted rounded skeleton-shimmer" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-4 py-16 animate-fade-in">
            <div className="w-14 h-14 bg-red-950/50 border border-red-500/20 rounded-2xl flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <div className="text-center">
              <h3 className="font-display font-semibold text-slate-200 mb-1">
                Search Failed
              </h3>
              <p className="text-sm font-mono text-slate-500 max-w-md">{error}</p>
              <p className="text-xs font-mono text-amber-500/60 mt-3">
                Tip: Enable Demo mode to test without API keys
              </p>
            </div>
          </div>
        )}

        {!loading && !error && hasSearched && businesses.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 animate-fade-in">
            <div className="w-14 h-14 bg-bg-muted border border-bg-border rounded-2xl flex items-center justify-center">
              <SearchX size={24} className="text-slate-500" />
            </div>
            <div className="text-center">
              <h3 className="font-display font-semibold text-slate-300 mb-1">
                No Results Found
              </h3>
              <p className="text-sm font-mono text-slate-500 max-w-md">
                No businesses matched your search for{" "}
                <span className="text-amber-400">
                  {searchMeta?.industry}
                </span>{" "}
                in{" "}
                <span className="text-amber-400">{searchMeta?.city}</span>.
                Try a different city or industry.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && businessesWithContacted.length > 0 && (
          <section className="space-y-5 animate-slide-up">
            {/* Search context */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
              <span className="text-slate-500">{searchMeta?.industry}</span>
              <ChevronRight size={12} />
              <span className="text-slate-500">{searchMeta?.city}</span>
              {source === "mock" && (
                <>
                  <ChevronRight size={12} />
                  <span className="text-amber-500/60">Demo data</span>
                </>
              )}
            </div>

            {/* Stats */}
            <StatsBar businesses={businessesWithContacted} />

            {/* Filter bar */}
            <FilterBar
              filter={filter}
              onChange={setFilter}
              total={businessesWithContacted.length}
              shown={filteredBusinesses.length}
              contactedCount={contactedCount}
              onExport={handleExport}
            />

            {/* Empty filter state */}
            {filteredBusinesses.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <SearchX size={20} className="text-slate-600" />
                <p className="text-sm font-mono text-slate-500">
                  No results match your current filters
                </p>
                <button
                  onClick={() => setFilter(DEFAULT_FILTER)}
                  className="text-xs font-mono text-amber-500 hover:text-amber-400 transition-colors underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* Business cards grid */}
            {filteredBusinesses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredBusinesses.map((business, i) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    onToggleContacted={toggleContacted}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty state — before any search */}
        {!hasSearched && !loading && (
          <section className="py-12 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              {[
                {
                  icon: "🎯",
                  title: "Find Hot Leads",
                  desc: "Surfaces businesses with no website or broken sites — the easiest pitch.",
                },
                {
                  icon: "📊",
                  title: "Score & Rank",
                  desc: "PageSpeed + mobile scores instantly rank every business by opportunity.",
                },
                {
                  icon: "✉️",
                  title: "Pitch in One Click",
                  desc: "AI-generated cold outreach tailored to each business's specific weakness.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={clsx(
                    "bg-bg-card border border-bg-border rounded-xl p-5",
                    "hover:border-amber-500/20 transition-colors duration-200"
                  )}
                >
                  <div className="text-2xl mb-3">{card.icon}</div>
                  <h3 className="font-display font-semibold text-slate-200 text-sm mb-1.5">
                    {card.title}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-bg-border mt-16 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-700">
            <Crosshair size={12} className="text-amber-500/40" />
            <span>LeadHunter — Web Audit Engine</span>
          </div>
          <div className="text-[11px] font-mono text-slate-700">
            Data sourced from Google Places API · PageSpeed Insights
          </div>
        </div>
      </footer>
    </div>
  );
}
