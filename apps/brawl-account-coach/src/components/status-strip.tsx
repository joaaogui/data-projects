import { formatNumber } from "@data-projects/shared";
import { RefreshCw, Trophy } from "lucide-react";

import type { AccountHealth } from "@/lib/schemas";
import type { AccountMetrics, PlayerProfile } from "@/lib/types";

interface StatusStripProps {
  player: PlayerProfile;
  metrics: AccountMetrics;
  health: AccountHealth;
  generatedAt: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function StatusStrip({
  player,
  metrics,
  health,
  generatedAt,
  isRefreshing,
  onRefresh,
}: StatusStripProps) {
  const p11Entry = metrics.powerDistribution.find(
    (entry) => entry.power === 11,
  );
  const refreshedAt = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-labelledby="status-strip-title"
      className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]"
    >
      <div className="dossier-stripe h-2.5" />
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border-2 border-[#101631] bg-[#155eef] px-2.5 py-0.5 text-xs font-black text-white">
                {player.tag}
              </span>
              <span className="border-2 border-[#101631] bg-[#ffcb2f] px-2.5 py-0.5 text-xs font-black text-[#101631]">
                {player.club?.name ?? "No club"}
              </span>
              <span className="text-xs font-bold text-[#5d6681]">
                Updated {refreshedAt}
              </span>
            </div>
            <h1
              id="status-strip-title"
              className="font-display mt-2 truncate text-2xl leading-tight sm:text-3xl"
            >
              {player.name}
            </h1>
            <p className="mt-1 text-xs font-bold text-[#3d4663] sm:text-sm">
              {health.verdict}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 border-2 border-[#101631] bg-[#ffcb2f] px-3.5 py-2 shadow-[3px_3px_0_#101631]">
              <span className="font-display text-2xl leading-none text-[#101631]">
                {health.score}
              </span>
              <span className="text-[11px] font-black leading-tight text-[#101631]">
                Coach
                <br />
                score
              </span>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="arcade-focus inline-flex min-h-11 items-center justify-center gap-2 border-2 border-[#101631] bg-white px-4 py-2 text-xs font-black text-[#101631] shadow-[3px_3px_0_#101631] transition-transform hover:bg-[#f7f9ff] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#101631] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={[
                  "size-4 text-[#155eef]",
                  isRefreshing ? "animate-spin" : "",
                ].join(" ")}
              />
              {isRefreshing ? "Refreshing…" : "Refresh dossier"}
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t-2 border-[#101631] pt-4 sm:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1 text-xs font-extrabold text-[#5d6681]">
              <Trophy aria-hidden="true" className="size-3.5 text-[#a36f00]" />
              Trophies
            </dt>
            <dd className="mt-0.5 text-lg font-black tabular-nums text-[#101631]">
              {formatNumber(player.trophies)}
              <span className="ml-1.5 text-xs font-bold text-[#5d6681]">
                peak {formatNumber(player.highestTrophies)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold text-[#5d6681]">
              Recent battles
            </dt>
            <dd className="mt-0.5 text-lg font-black tabular-nums text-[#101631]">
              {metrics.recentTrend.wins}W–{metrics.recentTrend.losses}L ·{" "}
              {metrics.recentTrend.winRate}%
            </dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold text-[#5d6681]">
              Net recent trophies
            </dt>
            <dd
              className={[
                "mt-0.5 text-lg font-black tabular-nums",
                metrics.recentTrend.netTrophies > 0
                  ? "text-[#08694e]"
                  : metrics.recentTrend.netTrophies < 0
                    ? "text-[#a51458]"
                    : "text-[#101631]",
              ].join(" ")}
            >
              {metrics.recentTrend.netTrophies > 0 ? "+" : ""}
              {metrics.recentTrend.netTrophies}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-extrabold text-[#5d6681]">
              Roster unlock
            </dt>
            <dd className="mt-0.5 text-lg font-black tabular-nums text-[#101631]">
              {metrics.rosterCompletion.owned}/
              {metrics.rosterCompletion.total}
              <span className="ml-1.5 text-xs font-bold text-[#5d6681]">
                {p11Entry?.count ?? 0} at P11
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
