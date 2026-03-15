import { Card, CardContent, Skeleton } from "@data-projects/ui";

export default function ChannelLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 animate-fade-up">
      {/* Channel header skeleton */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-full" />
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Video table skeleton */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          {["a", "b", "c", "d", "e", "f"].map((id) => (
            <div key={id} className="flex items-center gap-3">
              <Skeleton className="h-10 w-16 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
