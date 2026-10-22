import { formatNumber, normalizeKey } from "@data-projects/shared";
import { ArrowUpRight, Coins, Trophy } from "lucide-react";

import type { BuildAdvice, PushTarget, UpgradePriority } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

import { BrawlerCard } from "./brawler-card";

interface UpgradePrioritiesProps {
  priorities: UpgradePriority[];
  brawlers: PlayerBrawler[];
  builds?: BuildAdvice[];
  pushTargets?: PushTarget[];
  pinnedBrawlers?: string[];
  excludedBrawlers?: string[];
  onTogglePin?: (brawlerName: string) => void;
  onToggleExclude?: (brawlerName: string) => void;
}

const impactStyles = {
  high: "bg-[#f42f8c] text-white",
  medium: "bg-[#ffcb2f] text-[#101631]",
  low: "bg-[#eaf1ff] text-[#0d3fbb]",
};

export function UpgradePriorities({
  priorities,
  brawlers,
  builds = [],
  pushTargets = [],
  pinnedBrawlers = [],
  excludedBrawlers = [],
  onTogglePin,
  onToggleExclude,
}: UpgradePrioritiesProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [normalizeKey(brawler.name), brawler]),
  );
  const buildsByName = new Map(
    builds.map((build) => [normalizeKey(build.brawlerName), build]),
  );
  const pushesByName = new Map(
    pushTargets.map((target) => [normalizeKey(target.brawlerName), target]),
  );
  const pinnedKeys = new Set(pinnedBrawlers.map(normalizeKey));
  const excludedKeys = new Set(excludedBrawlers.map(normalizeKey));

  const rows = priorities.flatMap((priority) => {
    const key = normalizeKey(priority.brawlerName);
    const brawler = brawlersByName.get(key);
    return brawler
      ? [
          {
            priority,
            brawler,
            inlineBuild: buildsByName.get(key),
            matchingPush: pushesByName.get(key),
            isPinned: pinnedKeys.has(key),
            isExcluded: excludedKeys.has(key),
          },
        ]
      : [];
  });

  return (
    <section aria-labelledby="upgrade-priorities-title">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#155eef]">
            <Coins aria-hidden="true" className="size-4" />
            Spend order
          </p>
          <h3
            id="upgrade-priorities-title"
            className="font-display mt-1 text-xl leading-tight sm:text-2xl"
          >
            Upgrades that move the account
          </h3>
        </div>
        <p className="max-w-md text-xs font-semibold leading-5 text-[#5d6681]">
          Owned builds and trophy targets are attached inline on each card.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(
            (
              {
                priority,
                brawler,
                inlineBuild,
                matchingPush,
                isPinned,
                isExcluded,
              },
              index,
            ) => (
              <BrawlerCard
                key={priority.brawlerName}
                brawler={brawler}
                index={index}
                label={
                  matchingPush
                    ? "Upgrade + push target"
                    : "Upgrade priority"
                }
                accent={index === 0 ? "pink" : "blue"}
                inlineBuild={inlineBuild}
                isPinned={isPinned}
                isExcluded={isExcluded}
                onTogglePin={onTogglePin}
                onToggleExclude={onToggleExclude}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border-2 border-[#101631] px-2 py-0.5 text-[10px] font-black ${impactStyles[priority.accountImpact]}`}
                  >
                    {priority.accountImpact} account impact
                  </span>
                  <span className="text-xs font-bold text-[#5d6681]">
                    Current power {priority.currentPower} · Rank {brawler.rank}
                  </span>
                  {matchingPush ? (
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#101631] bg-[#fff8db] px-2 py-0.5 text-[10px] font-black text-[#a36f00]">
                      <Trophy aria-hidden="true" className="size-3" />
                      Push to {formatNumber(matchingPush.targetTrophies)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2.5 text-sm font-semibold leading-6 text-[#3d4663]">
                  {priority.reason}
                </p>
              </BrawlerCard>
            ),
          )}
        </div>
      ) : (
        <div className="arcade-panel rounded-[1rem_0.3rem_1rem_0.3rem] p-5">
          <ArrowUpRight
            aria-hidden="true"
            className="size-6 text-[#155eef]"
          />
          <h4 className="font-display mt-3 text-base">Hold the resources</h4>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#5d6681]">
            No upgrade has enough account-wide evidence in this snapshot.
          </p>
        </div>
      )}
    </section>
  );
}
