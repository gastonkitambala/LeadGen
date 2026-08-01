export default function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="h-36 bg-bg-muted relative overflow-hidden">
        <div className="absolute inset-0 bg-shimmer bg-shimmer animate-shimmer" />
      </div>

      <div className="p-5 space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-bg-muted rounded-full" />
          <div className="h-5 w-16 bg-bg-muted rounded-full" />
        </div>

        {/* Business name */}
        <div className="space-y-1.5">
          <div className="h-5 bg-bg-muted rounded w-3/4" />
          <div className="h-3.5 bg-bg-muted rounded w-1/2" />
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="h-3 bg-bg-muted rounded w-full" />
          <div className="h-3 bg-bg-muted rounded w-5/6" />
          <div className="h-3 bg-bg-muted rounded w-2/3" />
        </div>

        {/* Score bar */}
        <div className="h-2 bg-bg-muted rounded-full w-full" />

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <div className="h-8 bg-bg-muted rounded-lg flex-1" />
          <div className="h-8 bg-bg-muted rounded-lg w-24" />
        </div>
      </div>
    </div>
  );
}
