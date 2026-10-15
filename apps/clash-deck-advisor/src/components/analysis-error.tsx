"use client";

import { CloudOff, RotateCcw } from "lucide-react";

interface AnalysisErrorProps {
  code?: string;
  message: string;
  onRetry: () => void;
}

const guidance: Record<string, { title: string; detail: string }> = {
  CONFIGURATION_MISSING: {
    title: "Server setup needed",
    detail:
      "Add the Clash Royale and AI provider server environment variables, then run the analysis again.",
  },
  AUTHORIZATION_FAILED: {
    title: "Clash Royale access was rejected",
    detail:
      "Verify the API token and confirm the RoyaleAPI proxy IP is allowed for that token.",
  },
  PLAYER_NOT_FOUND: {
    title: "Player tag was not found",
    detail:
      "The advisor is fixed to #VGURQ0QQ2. Confirm that account is available through the API.",
  },
  UPSTREAM_RATE_LIMITED: {
    title: "Clash Royale needs a timeout",
    detail: "Wait a few minutes before requesting another fresh snapshot.",
  },
  UPSTREAM_MAINTENANCE: {
    title: "Clash Royale is under maintenance",
    detail: "The workshop will return once the official API is back online.",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "Clash Royale is temporarily unavailable",
    detail:
      "The upstream service could not be reached. Wait a moment and run the analysis again.",
  },
  RATE_LIMITED: {
    title: "Too many refreshes",
    detail:
      "This recommendation refreshes every 30 minutes, so another request is not needed yet.",
  },
};

export function AnalysisError({
  code = "ANALYSIS_FAILED",
  message,
  onRetry,
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
