"use client";

import { Skeleton } from "@data-projects/ui";
import { AlertTriangle } from "lucide-react";

export function LoadingGrid({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

export function QueryError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="size-4" aria-hidden />
        Could not load this view
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function NoData() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm font-medium">No scrobbles stored yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Run a full import (authenticated) to pull your Last.fm history into the database.
      </p>
    </div>
  );
}
