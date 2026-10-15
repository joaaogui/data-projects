import Image from "next/image";

import { normalizeCardLevel } from "@/lib/level-warnings";
import type { ClashCard } from "@/lib/types";

interface CardTileProps {
  card: ClashCard;
  isNew?: boolean;
  priority?: boolean;
}

export function CardTile({ card, isNew = false, priority = false }: CardTileProps) {
  const evolved = (card.evolutionLevel ?? 0) > 0;
  const imageUrl =
    evolved && card.iconUrls.evolutionMedium
      ? card.iconUrls.evolutionMedium
      : card.iconUrls.medium;
  const level = normalizeCardLevel(card);

  return (
    <div
      title={card.name}
      className={[
        "relative min-w-0 rounded-xl bg-white p-1 shadow-[0_4px_12px_rgba(11,31,58,0.06)]",
        isNew ? "ring-2 ring-[#d6a11f]" : "ring-1 ring-[#d9e1ec]",
      ].join(" ")}
    >
      <div className="blueprint-grid relative aspect-[4/5] overflow-hidden rounded-lg">
        <Image
          src={imageUrl}
          alt={`${card.name}, level ${level}${isNew ? ", new in this deck" : ""}`}
          fill
          priority={priority}
          sizes="(max-width: 639px) 22vw, 96px"
          className="object-contain p-0.5"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 rounded-full bg-[#0b1f3a] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white"
        >
          L{level}
        </span>
        {isNew ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 rounded-full bg-[#fff5d6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wide text-[#76530a]"
          >
            New
          </span>
        ) : null}
      </div>
    </div>
  );
}
