"use client";

import { useState } from "react";
import { X, Copy, Check, Sparkles, RefreshCw } from "lucide-react";
import { Business } from "@/types";
import { generatePitch } from "@/lib/pitchGenerator";
import clsx from "clsx";

interface PitchModalProps {
  business: Business;
  onClose: () => void;
}

export default function PitchModal({ business, onClose }: PitchModalProps) {
  const [pitch, setPitch] = useState(() => generatePitch(business));
  const [copied, setCopied] = useState(false);

  const regenerate = () => setPitch(generatePitch(business));

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-bg-surface border border-bg-border rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Amber glow top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bg-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Sparkles size={14} className="text-amber-500" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-200 text-sm">
                Cold Pitch
              </h3>
              <p className="text-xs font-mono text-slate-500">
                {business.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Business info strip */}
        <div className="px-5 py-3 bg-bg-card border-b border-bg-border flex items-center gap-4 text-xs font-mono">
          <span className="text-amber-500">{business.industry}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">{business.city}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">
            {business.websiteScore.label}
          </span>
          {business.rating && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400">★ {business.rating}</span>
            </>
          )}
        </div>

        {/* Pitch text */}
        <div className="p-5">
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            className={clsx(
              "w-full h-56 bg-bg-card border border-bg-border rounded-lg",
              "p-4 text-sm font-mono text-slate-300 leading-relaxed",
              "focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/10",
              "resize-none transition-all duration-200"
            )}
          />
          <p className="mt-2 text-xs font-mono text-slate-600">
            Edit to personalize · Fill in [brackets] before sending
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={regenerate}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg border border-bg-border",
              "text-sm font-mono text-slate-400 hover:text-amber-400 hover:border-amber-500/30",
              "transition-all duration-200 bg-bg-card hover:bg-amber-500/5"
            )}
          >
            <RefreshCw size={13} />
            Regenerate
          </button>

          <button
            onClick={copyToClipboard}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
              "text-sm font-mono font-semibold tracking-wide transition-all duration-200",
              copied
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-amber-500 text-bg-base hover:bg-amber-400 shadow-amber-sm"
            )}
          >
            {copied ? (
              <>
                <Check size={14} />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy Pitch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
