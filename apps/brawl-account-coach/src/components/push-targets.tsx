import { Crosshair, Trophy } from "lucide-react";

import type { BuildAdvice, PushTarget } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

import { BrawlerCard } from "./brawler-card";

interface PushTargetsProps {
  targets: PushTarget[];
  brawlers: PlayerBrawler[];
  builds?: BuildAdvice[];
  pinnedBrawlers?: string[];
  excludedBrawlers?: string[];
  onTogglePin?: (brawlerName: string) => void;
  onToggleExclude?: (brawlerName: string) => void;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function nameKey(name: string): string {
  return name.trim().toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function PushTargets({
  targets,
  brawlers,
  builds = [],
  pinnedBrawlers = [],
  excludedBrawlers = [],
  onTogglePin,
  onToggleExclude,
}: PushTargetsProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [nameKey(brawler.name), brawler]),
  );
  const buildsByName = new Map(
    builds.map((build) => [nameKey(build.brawlerName), build]),
  );
  const pinnedKeys = new Set(pinnedBrawlers.map(nameKey));
  const excludedKeys = new Set(excludedBrawlers.map(nameKey));

  const rows = targets.flatMap((target) => {
    const key = nameKey(target.brawlerName);
    const brawler = brawlersByName.get(key);
    return brawler
      ? [
          {
            target,
            brawler,
            inlineBuild: buildsByName.get(key),
            isPinned: pinnedKeys.has(key),
            isExcluded: excludedKeys.has(key),
          },
        ]
      : [];
  });

  return (
    <section aria-labelledby="push-targets-title">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#a36f00]">
            <Crosshair aria-hidden="true" className="size-4" />
            Trophy routes
          </p>
          <h3
            id="push-targets-title"
            className="font-display mt-1 text-xl leading-tight sm:text-2xl"
          >
            Best places to push next
          </h3>
        </div>
        <p className="max-w-md text-xs font-semibold leading-5 text-[#5d6681]">
          High-power brawlers with trophy headroom and ready loadouts.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(
            ({ target, brawler, inlineBuild, isPinned, isExcluded }, index) => {
              const progress = Math.min(
                100,
                (target.currentTrophies / target.targetTrophies) * 100,
              );
              return (
                <BrawlerCard
                  key={target.brawlerName}
                  brawler={brawler}
                  index={index}
                  label="Push target"
                  accent="yellow"
                  inlineBuild={inlineBuild}
                  isPinned={isPinned}
                  isExcluded={isExcluded}
                  onTogglePin={onTogglePin}
                  onToggleExclude={onToggleExclude}
                >
                  <div className="flex items-center justify-between gap-4 text-xs font-black">
                    <span>{numberFormatter.format(target.currentTrophies)}</span>
                    <span className="flex items-center gap-1 text-[#a36f00]">
                      <Trophy aria-hidden="true" className="size-3.5" />
                      {numberFormatter.format(target.targetTrophies)}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[#101631] bg-white"
                    aria-label={`${Math.round(progress)} percent toward ${target.targetTrophies} trophies`}
                  >
                    <div
                      className="h-full bg-[#ffcb2f]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-semibold leading-6 text-[#3d4663]">
                    {target.reason}
                  </p>
                </BrawlerCard>
              );
            },
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#b8c5df] bg-white p-5 text-sm leading-6 text-[#5d6681]">
          No trophy push is supported strongly enough by this snapshot.
        </div>
      )}
    </section>
  );
}
