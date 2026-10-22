import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@data-projects/ui";
import Image from "next/image";

import { buildCardProfile } from "@/lib/card-knowledge";
import { normalizeCardLevel } from "@/lib/level-warnings";
import type { ClashCard } from "@/lib/types";

interface CardTileProps {
  card: ClashCard;
  isNew?: boolean;
  priority?: boolean;
}

export function CardTile({ card, isNew = false, priority = false }: CardTileProps) {
  const profile = buildCardProfile(card);
  const evolved = Boolean(profile.evolved ?? profile.isEvolutionUnlocked);
  const imageUrl =
    evolved && card.iconUrls.evolutionMedium
      ? card.iconUrls.evolutionMedium
      : card.iconUrls.medium;
  const level = normalizeCardLevel(card);

  const elixirRarityLine = `${profile.elixirCost} Elixir · ${profile.rarity}`;
  const levelReadinessLine = `Level ${profile.level}/16 (${
    profile.level >= 14
      ? "Competitive ready"
      : `${14 - profile.level} under L14 standard`
  })`;
  const evolutionLine = `Evolution: ${
    evolved
      ? "Active"
      : profile.canEvolve
        ? "Available (Unlocked: No)"
        : "None"
  }${profile.isChampion ? " · Champion" : ""}`;
  const rolesTargetsLine = `Roles: ${profile.roles.join(", ") || "utility"} · Targets: ${profile.targets}`;
  const archetypesLine = profile.archetypes.join(", ");

  const fullTitle = [
    card.name,
    elixirRarityLine,
    levelReadinessLine,
    evolutionLine,
    rolesTargetsLine,
    archetypesLine ? `Archetypes: ${archetypesLine}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            title={fullTitle}
            className={[
              "royal-focus relative min-w-0 cursor-help rounded-xl bg-white p-1 shadow-[0_4px_12px_rgba(11,31,58,0.06)]",
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
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 border-[#d9e1ec] bg-white p-2.5 text-xs text-[#0b1f3a] shadow-lg">
          <p className="font-extrabold">{card.name}</p>
          <p className="font-semibold text-[#33445c]">{elixirRarityLine}</p>
          <p
            className={
              profile.level >= 14
                ? "font-bold text-[#087454]"
                : "font-bold text-[#b42318]"
            }
          >
            {levelReadinessLine}
          </p>
          <p className="text-[#5c6b7f]">{evolutionLine}</p>
          <p className="text-[#5c6b7f]">{rolesTargetsLine}</p>
          {archetypesLine ? (
            <p className="text-[#5c6b7f]">Archetypes: {archetypesLine}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
