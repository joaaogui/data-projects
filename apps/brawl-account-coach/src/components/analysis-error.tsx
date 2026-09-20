import { AlertTriangle, RotateCcw, ServerCog } from "lucide-react";

interface AnalysisErrorProps {
  code: string;
  message: string;
  onRetry: () => void;
}

const guidance: Record<string, { title: string; detail: string }> = {
  CONFIGURATION_MISSING: {
    title: "Server setup needed",
    detail:
      "Add the Brawl Stars and AI provider server environment variables, then check again.",
  },
  AUTHORIZATION_FAILED: {
    title: "Brawl access was rejected",
    detail:
      "Verify the API token and confirm the RoyaleAPI proxy IP is allowed for that token.",
  },
  PLAYER_NOT_FOUND: {
    title: "Player tag was not found",
    detail:
      "The coach is fixed to #Y0GLCU0GL. Confirm that account is available through the API.",
  },
  UPSTREAM_RATE_LIMITED: {
    title: "Brawl Stars needs a timeout",
    detail: "Wait a few minutes before requesting another fresh snapshot.",
  },
  UPSTREAM_MAINTENANCE: {
    title: "Brawl Stars is under maintenance",
    detail: "The account will be available after the official API returns.",
  },
  RATE_LIMITED: {
    title: "Too many refreshes",
    detail:
      "This dossier refreshes every 30 minutes, so another request is not needed yet.",
  },
};

export function AnalysisError({
  code,
  message,
  onRetry,
}: AnalysisErrorProps) {
  const copy = guidance[code] ?? {
    title: "The dossier could not be completed",
    detail:
      "The live services did not return a valid account analysis. Try again shortly.",
  };

  return (
    <main className="mx-auto flex min-h-[72vh] w-full max-w-5xl items-center px-4 py-12 sm:px-6">
      <section
        aria-live="polite"
        className="arcade-panel w-full overflow-hidden rounded-[1.4rem_0.4rem_1.4rem_0.4rem]"
      >
        <div className="dossier-stripe h-4" />
        <div className="grid md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center justify-center border-b-2 border-[#101631] bg-[#fff0f7] p-8 md:border-b-0 md:border-r-2">
            <span className="score-burst flex size-32 items-center justify-center bg-[#f42f8c] text-white">
              <AlertTriangle aria-hidden="true" className="size-14" />
            </span>
          </div>
          <div className="p-6 sm:p-9">
            <p className="flex items-center gap-2 text-sm font-extrabold text-[#155eef]">
              <ServerCog aria-hidden="true" className="size-4" />
              Analysis status
            </p>
            <h1 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#3d4663]">
              {message}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6681]">
              {copy.detail}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="arcade-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 border-2 border-[#101631] bg-[#155eef] px-5 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#101631] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#101631]"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Check again
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
