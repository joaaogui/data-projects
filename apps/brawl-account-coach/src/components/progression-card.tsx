import {
  ArrowUpRight,
  BookmarkCheck,
  History,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type { ProgressionSummary } from "@/lib/progression-store";

interface ProgressionCardProps {
  summary: ProgressionSummary;
  snapshotCount: number;
  currentTrophies: number;
  ownedCount: number;
  onClearHistory?: () => void;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatBaselineDate(iso: string | null): string {
  if (!iso) {
    return "last check-in";
  }
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return "last check-in";
  }
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${numberFormatter.format(value)}`;
  }
  if (value < 0) {
    return `−${numberFormatter.format(Math.abs(value))}`;
  }
  return "0";
}

export function ProgressionCard({
  summary,
  snapshotCount,
  currentTrophies,
  ownedCount,
  onClearHistory,
}: ProgressionCardProps) {
  const sinceLabel = formatBaselineDate(summary.baselineRecordedAt);

  return (
    <section
      aria-labelledby="progression-card-title"
      className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#101631] bg-[#eaf1ff] px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center border-2 border-[#101631] bg-[#ffcb2f] shadow-[2px_2px_0_#101631]">
            <History aria-hidden="true" className="size-4 text-[#101631]" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#155eef]">
              Section 2 · Progression memory
            </p>
            <h2
              id="progression-card-title"
              className="font-display text-lg leading-tight text-[#101631] sm:text-xl"
            >
              Progress since last check-in
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="border-2 border-[#101631] bg-white px-2.5 py-1 text-xs font-black text-[#3d4663]">
            {snapshotCount} {snapshotCount === 1 ? "snapshot" : "snapshots"} in
            browser
          </span>
          {onClearHistory && snapshotCount > 1 ? (
            <button
              type="button"
              onClick={onClearHistory}
              className="arcade-focus inline-flex min-h-11 items-center gap-1.5 border-2 border-[#101631] bg-white px-3 text-xs font-black text-[#3d4663] transition-colors hover:bg-[#fff0f7] hover:text-[#a51458]"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Reset log
            </button>
          ) : null}
        </div>
      </div>

      {!summary.hasBaseline ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-bold text-[#3d4663]">
            <Sparkles aria-hidden="true" className="size-4 shrink-0 text-[#155eef]" />
            Baseline recorded at{" "}
            <strong className="font-black text-[#101631]">
              {numberFormatter.format(currentTrophies)} trophies
            </strong>{" "}
            across{" "}
            <strong className="font-black text-[#101631]">
              {ownedCount} brawlers
            </strong>
            . Play a set or upgrade a brawler and check back to see what moved.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]">
          <div className="border-2 border-[#101631] bg-[#f7f9ff] p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#5d6681]">
              Net trophies since {sinceLabel}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={[
                  "font-display text-3xl tabular-nums",
                  summary.trophyDelta > 0
                    ? "text-[#08694e]"
                    : summary.trophyDelta < 0
                      ? "text-[#a51458]"
                      : "text-[#101631]",
                ].join(" ")}
              >
                {formatSigned(summary.trophyDelta)}
              </span>
              <span className="text-xs font-black text-[#5d6681]">trophies</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#3d4663]">
              {summary.trophyDelta >= 0 ? (
                <TrendingUp aria-hidden="true" className="size-3.5 text-[#08694e]" />
              ) : (
                <TrendingDown
                  aria-hidden="true"
                  className="size-3.5 text-[#a51458]"
                />
              )}
              {summary.followedRecommendationsCount > 0
                ? `${summary.followedRecommendationsCount} coach pick${summary.followedRecommendationsCount === 1 ? "" : "s"} acted on`
                : "Comparing against your previous saved dossier"}
            </p>
          </div>

          <div className="border-2 border-[#101631] bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#5d6681]">
              Upgraded brawlers
            </p>
            {summary.upgradedBrawlers.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {summary.upgradedBrawlers.map((item) => (
                  <li
                    key={item.id}
                    className="inline-flex items-center gap-1.5 border-2 border-[#101631] bg-[#fff8db] px-2.5 py-1 text-xs font-black text-[#101631]"
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 text-[#a36f00]"
                    />
                    <span>{item.label}</span>
                    {item.wasRecommendedUpgrade ? (
                      <span className="rounded bg-[#155eef] px-1.5 py-0.5 text-[10px] font-black text-white">
                        Coach pick
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5d6681]">
                No power or build level changes since {sinceLabel}.
              </p>
            )}
          </div>

          <div className="border-2 border-[#101631] bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#5d6681]">
              Did your last push/upgrade work?
            </p>
            {summary.brawlerTrophyGains.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {summary.brawlerTrophyGains.map((gain) => {
                  const positive = gain.trophyDelta > 0;
                  const wasPicked =
                    gain.wasRecommendedPush || gain.wasRecommendedUpgrade;
                  return (
                    <li
                      key={gain.id}
                      className={[
                        "inline-flex items-center gap-1.5 border-2 border-[#101631] px-2.5 py-1 text-xs font-black",
                        positive
                          ? "bg-[#e9fbf4] text-[#08694e]"
                          : "bg-[#fff0f7] text-[#a51458]",
                      ].join(" ")}
                    >
                      <span>{gain.name}</span>
                      <span>{formatSigned(gain.trophyDelta)}</span>
                      {wasPicked ? (
                        <span
                          title="Recommended in your prior snapshot"
                          className="inline-flex items-center gap-0.5 rounded bg-[#101631] px-1.5 py-0.5 text-[10px] font-black text-[#ffcb2f]"
                        >
                          <BookmarkCheck
                            aria-hidden="true"
                            className="size-2.5"
                          />
                          Pick
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5d6681]">
                No individual brawler trophy swings recorded since {sinceLabel}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
