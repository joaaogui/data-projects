import { Bolt, Settings2, ShieldCheck, Star, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import type { BuildAdvice as BuildAdviceItem } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

import { BrawlerCard } from "./brawler-card";

interface BuildAdviceProps {
  builds: BuildAdviceItem[];
  brawlers: PlayerBrawler[];
}

interface BuildSlotProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function BuildSlot({ icon, label, value }: BuildSlotProps) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 border-t border-[#d7def0] py-2.5 first:border-t-0 first:pt-0">
      <span className="mt-0.5 text-[#155eef]" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block text-[10px] font-black text-[#707a97]">
          {label}
        </span>
        <span className="block text-sm font-extrabold text-[#101631]">
          {value}
        </span>
      </span>
    </li>
  );
}

export function BuildAdvice({ builds, brawlers }: BuildAdviceProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [brawler.name, brawler]),
  );
  const rows = builds.flatMap((build) => {
    const brawler = brawlersByName.get(build.brawlerName);
    return brawler ? [{ build, brawler }] : [];
  });

  return (
    <section aria-labelledby="build-advice-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#155eef]">
            <Wrench aria-hidden="true" className="size-4" />
            Loadout desk
          </p>
          <h2
            id="build-advice-title"
            className="font-display mt-2 text-2xl leading-tight sm:text-3xl"
          >
            Builds already in your account
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#101631] bg-[#dff9ef] px-3 py-1 text-xs font-black text-[#08694e]">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Owned items only
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ build, brawler }) => {
            const slots = [
              build.gadget
                ? {
                    label: "Gadget",
                    value: build.gadget,
                    icon: <Bolt className="size-4" />,
                  }
                : null,
              build.starPower
                ? {
                    label: "Star Power",
                    value: build.starPower,
                    icon: <Star className="size-4" />,
                  }
                : null,
              build.gears.length > 0
                ? {
                    label: build.gears.length === 1 ? "Gear" : "Gears",
                    value: build.gears.join(" + "),
                    icon: <Settings2 className="size-4" />,
                  }
                : null,
              build.hypercharge
                ? {
                    label: "Hypercharge",
                    value: build.hypercharge,
                    icon: <Bolt className="size-4 text-[#f42f8c]" />,
                  }
                : null,
            ].filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));

            return (
              <BrawlerCard
                key={build.brawlerName}
                brawler={brawler}
                label="Owned build"
              >
                {slots.length > 0 ? (
                  <ul>{slots.map((slot) => <BuildSlot key={slot.label} {...slot} />)}</ul>
                ) : (
                  <p className="text-sm font-semibold text-[#5d6681]">
                    No complete owned loadout is ready yet.
                  </p>
                )}
                <p className="mt-3 border-l-4 border-[#f42f8c] pl-3 text-sm leading-6 text-[#3d4663]">
                  {build.reason}
                </p>
              </BrawlerCard>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#b8c5df] bg-white p-6 text-sm leading-6 text-[#5d6681]">
          No owned loadout has enough evidence for a recommendation yet.
        </div>
      )}
    </section>
  );
}
