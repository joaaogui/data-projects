"use client";

import { AlertCircle } from "lucide-react";

export default function ChannelError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-scale-in">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 max-w-md w-full">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
