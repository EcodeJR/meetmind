export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-outline-variant">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={`h-4 bg-surface-container rounded ${j === 0 ? 'w-32' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl p-6 soft-shadow animate-pulse ${className}`}>
      <div className="flex justify-between mb-4">
        <div className="w-10 h-10 bg-surface-container rounded-xl" />
        <div className="w-16 h-6 bg-surface-container rounded-full" />
      </div>
      <div className="w-24 h-4 bg-surface-container rounded mb-2" />
      <div className="w-32 h-8 bg-surface-container rounded" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow h-64" />
    </div>
  );
}
