"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Briefcase, ChevronDown, Zap } from "lucide-react";
import { INDUSTRY_OPTIONS } from "@/lib/providers/industryTags";
import clsx from "clsx";

interface SearchBarProps {
  onSearch: (city: string, industry: string, mock: boolean) => void;
  loading: boolean;
  mockMode: boolean;
  onToggleMock: () => void;
}

export default function SearchBar({
  onSearch,
  loading,
  mockMode,
  onToggleMock,
}: SearchBarProps) {
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = INDUSTRY_OPTIONS.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !industry.trim()) return;
    onSearch(city.trim(), industry.trim(), mockMode);
  };

  const selectIndustry = (val: string) => {
    setIndustry(val);
    setQuery(val);
    setDropdownOpen(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col lg:flex-row gap-3">
        {/* City Input */}
        <div className="flex-1 relative group">
          <label className="block text-xs font-mono text-amber-500/70 mb-1.5 tracking-widest uppercase">
            Target City
          </label>
          <div className="relative">
            <MapPin
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-500 transition-colors"
            />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Austin, TX"
              className={clsx(
                "w-full bg-bg-card border border-bg-border rounded-lg pl-10 pr-4 py-3",
                "text-sm font-mono text-slate-200 placeholder-slate-600",
                "focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20",
                "transition-all duration-200"
              )}
            />
          </div>
        </div>

        {/* Industry Input */}
        <div className="flex-1 relative group" ref={dropdownRef}>
          <label className="block text-xs font-mono text-amber-500/70 mb-1.5 tracking-widest uppercase">
            Industry
          </label>
          <div className="relative">
            <Briefcase
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-500 transition-colors z-10"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIndustry(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Barbershop, Bakery, Plumber..."
              className={clsx(
                "w-full bg-bg-card border border-bg-border rounded-lg pl-10 pr-9 py-3",
                "text-sm font-mono text-slate-200 placeholder-slate-600",
                "focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20",
                "transition-all duration-200"
              )}
            />
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors"
            >
              <ChevronDown
                size={15}
                className={clsx(
                  "transition-transform duration-200",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            {/* Dropdown */}
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-bg-card border border-bg-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectIndustry(opt)}
                    className={clsx(
                      "w-full text-left px-4 py-2.5 text-sm font-mono",
                      "hover:bg-amber-500/10 hover:text-amber-400 transition-colors",
                      industry === opt
                        ? "text-amber-400 bg-amber-500/5"
                        : "text-slate-400"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search Button */}
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-mono text-amber-500/70 mb-1.5 tracking-widest uppercase opacity-0 select-none">
              Search
            </label>
            <button
              type="submit"
              disabled={loading || !city.trim() || !industry.trim()}
              className={clsx(
                "relative px-6 py-3 rounded-lg font-mono text-sm font-semibold tracking-wider uppercase",
                "bg-amber-500 text-bg-base hover:bg-amber-400",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                "transition-all duration-200 flex items-center gap-2.5",
                "shadow-amber-sm hover:shadow-amber active:scale-[0.98]",
                loading && "animate-pulse-amber"
              )}
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-bg-base/30 border-t-bg-base rounded-full animate-spin" />
                  Hunting...
                </>
              ) : (
                <>
                  <Search size={15} />
                  Hunt Leads
                </>
              )}
            </button>
          </div>

          {/* Mock mode toggle */}
          <div>
            <label className="block text-xs font-mono text-amber-500/70 mb-1.5 tracking-widest uppercase opacity-0 select-none">
              Mode
            </label>
            <button
              type="button"
              onClick={onToggleMock}
              title={mockMode ? "Demo mode active — showing sample leads" : "Click for demo mode"}
              className={clsx(
                "px-3 py-3 rounded-lg border font-mono text-xs tracking-wider flex items-center gap-1.5 transition-all duration-200",
                mockMode
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
                  : "bg-bg-card border-bg-border text-slate-500 hover:border-amber-500/30 hover:text-amber-500/70"
              )}
            >
              <Zap size={13} className={mockMode ? "fill-amber-500" : ""} />
              DEMO
            </button>
          </div>
        </div>
      </div>

      {mockMode && (
        <p className="mt-2 text-xs font-mono text-amber-500/60 flex items-center gap-1.5">
          <Zap size={11} className="fill-amber-500/60" />
          Demo mode active — showing sample leads instead of running a live search
        </p>
      )}
    </form>
  );
}
