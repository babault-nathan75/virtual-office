import { SkeletonChat } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <SkeletonChat />
        </div>
      </div>
    </div>
  );
}
