import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export function SkeletonLoader({ className, variant = 'rect' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white/5 border border-white/10',
        variant === 'circle' ? 'rounded-full' : 'rounded-lg',
        className
      )}
    >
      <div
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(201, 169, 98, 0.12) 50%, transparent)',
          animation: 'skeleton-shimmer 2s infinite',
        }}
      />
    </div>
  );
}

export function SkeletonDashboardGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div 
          key={i} 
          className="h-48 rounded-2xl border border-white/8 bg-noya-sidebar/40 p-6"
        >
          <div className="flex items-center gap-4">
            <SkeletonLoader className="h-12 w-12" variant="rect" />
            <SkeletonLoader className="h-4 w-32" variant="text" />
          </div>
          <SkeletonLoader className="mt-6 h-4 w-full" variant="text" />
          <SkeletonLoader className="mt-2 h-4 w-2/3" variant="text" />
          <SkeletonLoader className="mt-auto h-3 w-24" variant="text" />
        </div>
      ))}
    </div>
  );
}
