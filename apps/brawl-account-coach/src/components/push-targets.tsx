import { Crosshair, Trophy } from "lucide-react";

import type { PushTarget } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

import { BrawlerCard } from "./brawler-card";

interface PushTargetsProps {
  targets: PushTarget[];
  brawlers: PlayerBrawler[];
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function PushTargets({ targets, brawlers }: PushTargetsProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [brawler.name, brawler]),
  );
  const rows = targets.flatMap((target) => {
    const brawler = brawlersByName.get(target.brawlerName);
    return brawler ? [{ target, brawler }] : [];
  });

  return (
    <section aria-labelledby="push-targets-title">
      <div className="mb-5">
        <p className="flex items-center gap-2 text-sm font-extrabold text-[#a36f00]">
          <Crosshair aria-hidden="true" className="size-4" />
          Trophy routes
        </p>
        <h2
          id="push-targets-title"
          className="font-display mt-2 text-2xl leading-tight sm:text-3xl"
        >
          Best places to push next
        </h2>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(({ target, brawler }, index) => {
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
                <p className="mt-3 text-sm font-semibold leading-6 text-[#3d4663]">
                  {target.reason}
                </p>
              </BrawlerCard>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#b8c5df] bg-white p-6 text-sm leading-6 text-[#5d6681]">
          No trophy push is supported strongly enough by this snapshot.
        </div>
      )}
    </section>
  );
}
