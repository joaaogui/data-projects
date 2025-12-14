import { Skeleton } from "@data-projects/ui"

export function TracksTableLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 flex-1 max-w-xs" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <div 
              key={`loading-row-${n}`} 
              className="flex items-center gap-4 px-4 py-3"
              style={{ animationDelay: `${(n - 1) * 50}ms` }}
            >
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-12 hidden sm:block" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-24 hidden sm:block" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

