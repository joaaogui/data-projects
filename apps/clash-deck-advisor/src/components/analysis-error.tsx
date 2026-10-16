"use client";

import { SUPERCELL_ERROR_GUIDANCE } from "@data-projects/shared/supercell";
import { CloudOff, RotateCcw } from "lucide-react";

interface AnalysisErrorProps {
  code?: string;
  message: string;
  onRetry: () => void;
  onClearHistory?: () => void;
}

const guidance: Record<string, { title: string; detail: string }> = {
  ...SUPERCELL_ERROR_GUIDANCE,
  INVALID_REQUEST: {
    title: "Saved history could not be read",
    detail:
      "The battle history saved in this browser did not pass validation. Clearing it starts a fresh one.",
  },
  PAYLOAD_TOO_LARGE: {
    title: "Saved history is too large",
    detail:
      "The battle history saved in this browser is bigger than the server accepts. Clearing it starts a fresh one.",
  },
};

export function AnalysisError({
  code = "ANALYSIS_FAILED",
  message,
  onRetry,
  onClearHistory,
}: AnalysisErrorProps) {
  const copy = guidance[code] ?? {
    title: "The workshop lost its live feed",
    detail:
      "The current deck was not changed. Confirm the server configuration and upstream services, then run the analysis again.",
  };

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-12 sm:px-6"
    >
      <section
        aria-live="polite"
        className="paper-panel w-full overflow-hidden rounded-[1.6rem]"
      >
        <div className="h-1.5 bg-[#d6a11f]" />
        <div className="p-6 sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#fff0ef] text-[#b42318]">
            <CloudOff aria-hidden="true" className="size-6" />
          </span>
          <h1 className="font-display mt-6 text-4xl font-semibold tracking-[-0.04em]">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5c6b7f]">
            {message}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#7a8798]">
            {copy.detail}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              className="royal-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#164fc9] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(22,79,201,0.18)] transition-colors hover:bg-[#103fa5]"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Run analysis again
            </button>
            {onClearHistory ? (
              <button
                type="button"
                onClick={onClearHistory}
                className="royal-focus inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cdd8e8] bg-white px-5 py-2.5 text-sm font-extrabold text-[#33445c] transition-colors hover:border-[#b42318] hover:text-[#b42318]"
              >
                Clear saved history
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
