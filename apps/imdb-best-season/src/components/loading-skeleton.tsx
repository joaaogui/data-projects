import { Skeleton } from "@data-projects/ui";

const SKELETON_ROWS = [
  { id: "row-1" },
  { id: "row-2" },
  { id: "row-3" },
  { id: "row-4" },
  { id: "row-5" },
] as const;

const BOUNCE_DOTS = [
  { id: "dot-1", delay: 0 },
  { id: "dot-2", delay: 150 },
  { id: "dot-3", delay: 300 },
] as const;

export function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <Skeleton className="w-48 md:w-56 aspect-[2/3] rounded-xl mx-auto md:mx-0" />
        <div className="flex flex-col justify-center space-y-4 flex-1">
          <Skeleton className="h-10 w-64 mx-auto md:mx-0" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="rounded-xl border bg-card/50 overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {SKELETON_ROWS.map((row) => (
          <div
            key={row.id}
            className="p-4 border-b last:border-b-0 flex items-center gap-8"
          >
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <div className="flex-1" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex gap-1">
        {BOUNCE_DOTS.map((dot) => (
          <div
            key={dot.id}
            className="w-3 h-3 rounded-full bg-gold animate-bounce"
            style={{ animationDelay: `${dot.delay}ms` }}
          />
        ))}
      </div>
      <p className="text-muted-foreground animate-pulse">
        Searching for your show...
      </p>
    </div>
  );
}
