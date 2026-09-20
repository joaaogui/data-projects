import { ArrowUpRight, Coins } from "lucide-react";

import type { UpgradePriority } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

import { BrawlerCard } from "./brawler-card";

interface UpgradePrioritiesProps {
  priorities: UpgradePriority[];
  brawlers: PlayerBrawler[];
}

const impactStyles = {
  high: "bg-[#f42f8c] text-white",
  medium: "bg-[#ffcb2f] text-[#101631]",
  low: "bg-[#eaf1ff] text-[#0d3fbb]",
};

export function UpgradePriorities({
  priorities,
  brawlers,
}: UpgradePrioritiesProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [brawler.name, brawler]),
  );
  const rows = priorities.flatMap((priority) => {
    const brawler = brawlersByName.get(priority.brawlerName);
    return brawler ? [{ priority, brawler }] : [];
  });

  return (
    <section aria-labelledby="upgrade-priorities-title">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#155eef]">
            <Coins aria-hidden="true" className="size-4" />
            Spend order
          </p>
          <h2
            id="upgrade-priorities-title"
            className="font-display mt-2 text-2xl leading-tight sm:text-3xl"
          >
            Upgrades that move the account
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#5d6681]">
          The ranking can stay short when the evidence does not justify more
          spending.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ priority, brawler }, index) => (
            <BrawlerCard
              key={priority.brawlerName}
              brawler={brawler}
              index={index}
              label="Upgrade priority"
              accent={index === 0 ? "pink" : "blue"}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border-2 border-[#101631] px-2 py-0.5 text-[10px] font-black ${impactStyles[priority.accountImpact]}`}
                >
                  {priority.accountImpact} account impact
                </span>
                <span className="text-xs font-bold text-[#5d6681]">
                  Current power {priority.currentPower}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#3d4663]">
                {priority.reason}
              </p>
            </BrawlerCard>
          ))}
        </div>
      ) : (
        <div className="arcade-panel rounded-[1rem_0.3rem_1rem_0.3rem] p-6">
          <ArrowUpRight
            aria-hidden="true"
            className="size-7 text-[#155eef]"
          />
          <h3 className="font-display mt-4 text-lg">Hold the resources</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5d6681]">
            No upgrade has enough account-wide evidence in this snapshot.
          </p>
        </div>
      )}
    </section>
  );
}
