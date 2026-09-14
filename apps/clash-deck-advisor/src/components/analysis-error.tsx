"use client";

import { CloudOff, RotateCcw } from "lucide-react";

interface AnalysisErrorProps {
  message: string;
  onRetry: () => void;
}

export function AnalysisError({ message, onRetry }: AnalysisErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-12 sm:px-6">
      <section className="paper-panel w-full overflow-hidden rounded-[1.6rem]">
        <div className="h-1.5 bg-[#d6a11f]" />
        <div className="p-6 sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#fff0ef] text-[#b42318]">
            <CloudOff aria-hidden="true" className="size-6" />
          </span>
          <h1 className="font-display mt-6 text-4xl font-semibold tracking-[-0.04em]">
            The workshop lost its live feed
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5c6b7f]">
            {message}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#7a8798]">
            The current deck was not changed. Confirm the server configuration
            and upstream services, then run the analysis again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="royal-focus mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#164fc9] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(22,79,201,0.18)] transition-colors hover:bg-[#103fa5]"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Run analysis again
          </button>
        </div>
      </section>
    </main>
  );
}
