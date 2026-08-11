'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

const AVATAR_SIZES: Record<number, string> = { 8: 'w-8 h-8', 10: 'w-10 h-10', 12: 'w-12 h-12', 16: 'w-16 h-16', 20: 'w-20 h-20' };
export function SkeletonAvatar({ size = 10 }: { size?: number }) {
  return <Skeleton className={`${AVATAR_SIZES[size] || 'w-10 h-10'} rounded-full shrink-0`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[70%] space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
            <Skeleton className={`h-10 ${i % 2 === 0 ? 'w-48' : 'w-56'} rounded-2xl`} />
            <Skeleton className="h-2 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-10 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-2xl shrink-0" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-24 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <SkeletonStats />

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="space-y-6">
            <Skeleton className="h-6 w-36" />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    </div>
  );
}
