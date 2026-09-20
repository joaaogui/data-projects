import Image from "next/image";
import type { ReactNode } from "react";

import type { PlayerBrawler } from "@/lib/types";

interface BrawlerCardProps {
  brawler: PlayerBrawler;
  index?: number;
  label?: string;
  children: ReactNode;
  accent?: "blue" | "yellow" | "pink";
}

const numberFormatter = new Intl.NumberFormat("en-US");

const accentClasses = {
  blue: "bg-[#155eef] text-white",
  yellow: "bg-[#ffcb2f] text-[#101631]",
  pink: "bg-[#f42f8c] text-white",
};

export function BrawlerCard({
  brawler,
  index,
  label,
  children,
  accent = "blue",
}: BrawlerCardProps) {
  return (
    <article className="arcade-panel relative overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]">
      <div className="grid min-h-full grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[8.25rem_minmax(0,1fr)]">
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
            className="absolute bottom-0 left-1/2 h-auto w-[8.4rem] max-w-none -translate-x-1/2 sm:w-[10rem]"
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
                <p className="text-xs font-extrabold text-[#5d6681]">
                  {label}
                </p>
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
          <div className="mt-3 flex-1">{children}</div>
        </div>
      </div>
    </article>
  );
}
