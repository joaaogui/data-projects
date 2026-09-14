import { Crown, Sparkles } from "lucide-react";
import Image from "next/image";

import { normalizeCardLevel } from "@/lib/level-warnings";
import type { ClashCard } from "@/lib/types";

interface CardTileProps {
  card: ClashCard;
  change?: "added" | "removed";
  priority?: boolean;
}

export function CardTile({ card, change, priority = false }: CardTileProps) {
  const evolved = (card.evolutionLevel ?? 0) > 0;
  const champion = card.rarity.toLowerCase() === "champion";
  const imageUrl =
    evolved && card.iconUrls.evolutionMedium
      ? card.iconUrls.evolutionMedium
      : card.iconUrls.medium;

  return (
    <article
      className={[
        "group relative min-w-0 overflow-hidden rounded-[0.9rem] border bg-white p-1.5 shadow-[0_6px_16px_rgba(11,31,58,0.07)] sm:p-2",
        change === "added"
          ? "border-[#d6a11f] ring-2 ring-[#f3c95e]/35"
          : change === "removed"
            ? "border-[#e4a09b] opacity-75"
            : "border-[#d9e1ec]",
      ].join(" ")}
    >
      {change ? (
        <span
          className={[
            "absolute left-1.5 top-1.5 z-20 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] sm:text-[9px]",
            change === "added"
              ? "bg-[#fff5d6] text-[#76530a]"
              : "bg-[#fff0ef] text-[#9b2c24]",
          ].join(" ")}
        >
          {change === "added" ? "New" : "Out"}
        </span>
      ) : null}

      <div className="blueprint-grid relative aspect-[4/5] overflow-hidden rounded-[0.65rem]">
        <Image
          src={imageUrl}
          alt={`${card.name} card art`}
          fill
          priority={priority}
          sizes="(max-width: 767px) 22vw, (max-width: 1279px) 11vw, 120px"
          className="object-contain px-0.5 pt-1"
        />

        <div className="absolute bottom-1 left-1 z-10 flex min-w-6 items-center justify-center rounded-full border border-white/80 bg-[#0b1f3a] px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-sm sm:text-[10px]">
          L{normalizeCardLevel(card)}
        </div>

        <div className="absolute bottom-1 right-1 z-10 flex gap-0.5">
          {evolved ? (
            <span
              title="Evolution unlocked"
              className="flex size-5 items-center justify-center rounded-full border border-white/80 bg-[#6f42c1] text-white shadow-sm"
            >
              <Sparkles aria-hidden="true" className="size-3" />
              <span className="sr-only">Evolution unlocked</span>
            </span>
          ) : null}
          {champion ? (
            <span
              title="Champion"
              className="flex size-5 items-center justify-center rounded-full border border-white/80 bg-[#d6a11f] text-[#0b1f3a] shadow-sm"
            >
              <Crown aria-hidden="true" className="size-3" />
              <span className="sr-only">Champion</span>
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="mt-1.5 truncate text-center text-[9px] font-extrabold leading-tight text-[#0b1f3a] sm:text-[11px]">
        {card.name}
      </h3>
    </article>
  );
}
