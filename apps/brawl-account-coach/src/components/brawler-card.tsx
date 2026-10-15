import { Ban, Bolt, Pin, Settings2, Star, Wrench } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import type { BuildAdvice } from "@/lib/schemas";
import type { PlayerBrawler } from "@/lib/types";

interface BrawlerCardProps {
  brawler: PlayerBrawler;
  index?: number;
  label?: string;
  children: ReactNode;
  accent?: "blue" | "yellow" | "pink";
  inlineBuild?: BuildAdvice;
  isPinned?: boolean;
  isExcluded?: boolean;
  onTogglePin?: (brawlerName: string) => void;
  onToggleExclude?: (brawlerName: string) => void;
}

const numberFormatter = new Intl.NumberFormat("en-US");

const accentClasses = {
  blue: "bg-[#155eef] text-white",
  yellow: "bg-[#ffcb2f] text-[#101631]",
  pink: "bg-[#f42f8c] text-white",
};

function InlineBuildBadge({ build }: { build: BuildAdvice }) {
  const slots = [
    build.gadget
      ? {
          label: "Gadget",
          value: build.gadget,
          icon: <Bolt aria-hidden="true" className="size-3.5 text-[#155eef]" />,
        }
      : null,
    build.starPower
      ? {
          label: "Star Power",
          value: build.starPower,
          icon: <Star aria-hidden="true" className="size-3.5 text-[#a36f00]" />,
        }
      : null,
    build.gears.length > 0
      ? {
          label: build.gears.length === 1 ? "Gear" : "Gears",
          value: build.gears.join(" + "),
          icon: (
            <Settings2 aria-hidden="true" className="size-3.5 text-[#155eef]" />
          ),
        }
      : null,
    build.hypercharge
      ? {
          label: "Hypercharge",
          value: build.hypercharge,
          icon: <Bolt aria-hidden="true" className="size-3.5 text-[#f42f8c]" />,
        }
      : null,
  ].filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));

  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-2 border-[#101631] bg-[#f7f9ff] p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#155eef]">
        <Wrench aria-hidden="true" className="size-3" />
        Owned loadout ready
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <li
            key={slot.label}
            className="inline-flex items-center gap-1.5 border border-[#101631] bg-white px-2 py-1 text-xs font-extrabold text-[#101631]"
          >
            {slot.icon}
            <span className="text-[10px] font-black uppercase text-[#5d6681]">
              {slot.label}:
            </span>
            <span>{slot.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrawlerCard({
  brawler,
  index,
  label,
  children,
  accent = "blue",
  inlineBuild,
  isPinned = false,
  isExcluded = false,
  onTogglePin,
  onToggleExclude,
}: BrawlerCardProps) {
  const showControls = Boolean(onTogglePin || onToggleExclude);

  return (
    <article className="arcade-panel relative flex flex-col overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]">
      <div className="grid flex-1 grid-cols-[6.25rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div className="portrait-stage relative min-h-36 overflow-hidden border-r-2 border-[#101631] sm:min-h-44">
          {typeof index === "number" ? (
            <span className="font-display absolute left-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border-2 border-[#101631] bg-[#ffcb2f] text-sm shadow-[2px_2px_0_#101631]">
              {index + 1}
            </span>
          ) : null}
          <Image
            src={`https://cdn.brawlify.com/brawlers/borderless/${brawler.id}.png`}
            alt={`${brawler.name} portrait`}
            width={170}
            height={170}
            className="absolute bottom-0 left-1/2 h-auto w-[8rem] max-w-none -translate-x-1/2 sm:w-[9.5rem]"
          />
          <div className="absolute inset-x-2 bottom-2 flex justify-center">
            <span className="rounded-full border-2 border-[#101631] bg-white px-2.5 py-0.5 text-[11px] font-black shadow-[2px_2px_0_#101631]">
              Power {brawler.power}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {label ? (
                <p className="text-xs font-extrabold text-[#5d6681]">{label}</p>
              ) : null}
              <h3 className="font-display mt-1 truncate text-lg leading-tight text-[#101631] sm:text-xl">
                {brawler.name}
              </h3>
            </div>
            <span
              className={`shrink-0 rounded-full border-2 border-[#101631] px-2.5 py-1 text-[11px] font-black ${accentClasses[accent]}`}
            >
              {numberFormatter.format(brawler.trophies)} trophies
            </span>
          </div>
          <div className="mt-3 flex-1">
            {children}
            {inlineBuild ? <InlineBuildBadge build={inlineBuild} /> : null}
          </div>
        </div>
      </div>

      {showControls ? (
        <div className="grid grid-cols-2 gap-2.5 border-t-2 border-[#101631] bg-[#f7f9ff] p-2.5 sm:px-4">
          {onTogglePin ? (
            <button
              type="button"
              aria-pressed={isPinned}
              aria-label={`Focus ${brawler.name}`}
              title={`Focus ${brawler.name}: prioritize in upgrades and pushes`}
              onClick={() => onTogglePin(brawler.name)}
              className={[
                "arcade-focus inline-flex min-h-11 w-full items-center justify-center gap-2 border-2 border-[#101631] px-3 text-xs font-black transition-colors sm:text-sm",
                isPinned
                  ? "bg-[#155eef] text-white shadow-[2px_2px_0_#101631]"
                  : "bg-white text-[#101631] hover:bg-[#eaf1ff]",
              ].join(" ")}
            >
              <Pin aria-hidden="true" className="size-3.5 shrink-0" />
              {isPinned ? "Focused" : "Focus"}
            </button>
          ) : null}
          {onToggleExclude ? (
            <button
              type="button"
              aria-pressed={isExcluded}
              aria-label={`Hide ${brawler.name}`}
              title={`Hide ${brawler.name}: skip in upgrade and push suggestions`}
              onClick={() => onToggleExclude(brawler.name)}
              className={[
                "arcade-focus inline-flex min-h-11 w-full items-center justify-center gap-2 border-2 border-[#101631] px-3 text-xs font-black transition-colors sm:text-sm",
                isExcluded
                  ? "bg-[#f42f8c] text-white shadow-[2px_2px_0_#101631]"
                  : "bg-white text-[#101631] hover:bg-[#fff0f7]",
              ].join(" ")}
            >
              <Ban aria-hidden="true" className="size-3.5 shrink-0" />
              {isExcluded ? "Hidden" : "Hide"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
