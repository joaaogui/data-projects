import { formatSigned } from "@data-projects/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@data-projects/ui";
import { ArrowRight, Ban, Crosshair, Lock } from "lucide-react";
import Image from "next/image";

import { buildCardProfile } from "@/lib/card-knowledge";
import { CARD_ATTRIBUTES } from "@/lib/card-roles.data";
import type { CardSwap } from "@/lib/schemas";
import type { ClashCard } from "@/lib/types";

interface SwapListProps {
  changes: CardSwap[];
  cardsByName: Map<string, ClashCard>;
  lockedCards: string[];
  excludedCards: string[];
  onToggleLock: (cardName: string) => void;
  onToggleExclude: (cardName: string) => void;
}

function SwapCard({
  name,
  card,
  direction,
}: {
  name: string;
  card?: ClashCard;
  direction: "out" | "in";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={[
          "relative size-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 sm:size-14",
          direction === "in" ? "ring-2 ring-[#d6a11f]" : "ring-[#d9e1ec]",
        ].join(" ")}
      >
        {card ? (
          <Image
            src={card.iconUrls.medium}
            alt=""
            fill
            sizes="56px"
            className="object-contain p-0.5"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <span className="block text-[11px] font-bold text-[#6d7a8b]">
          {direction === "in" ? "Bring in" : "Take out"}
        </span>
        <span className="block break-words text-sm font-extrabold leading-tight text-[#0b1f3a]">
          {name}
        </span>
      </div>
    </div>
  );
}

function ConstraintButton({
  kind,
  cardName,
  active,
  onToggle,
}: {
  kind: "keep" | "avoid";
  cardName: string;
  active: boolean;
  onToggle: (cardName: string) => void;
}) {
  const isKeep = kind === "keep";
  const Icon = isKeep ? Lock : Ban;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${isKeep ? "Keep" : "Avoid"} ${cardName}`}
      title={
        isKeep
          ? `Keep ${cardName}: never swap it out`
          : `Avoid ${cardName}: stop suggesting it`
      }
      onClick={() => onToggle(cardName)}
      className={[
        "royal-focus inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-extrabold transition-colors",
        active
          ? isKeep
            ? "border-[#164fc9] bg-[#164fc9] text-white"
            : "border-[#b42318] bg-[#b42318] text-white"
          : isKeep
            ? "border-[#c9d6ec] bg-white text-[#164fc9] hover:border-[#164fc9] hover:bg-[#f2f6ff]"
            : "border-[#efcdc9] bg-white text-[#b42318] hover:border-[#b42318] hover:bg-[#fff6f5]",
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {isKeep ? "Keep" : "Avoid"}
    </button>
  );
}

export function SwapList({
  changes,
  cardsByName,
  lockedCards,
  excludedCards,
  onToggleLock,
  onToggleExclude,
}: SwapListProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <ol aria-label="Recommended swaps" className="divide-y divide-[#e2e7ee]">
        {changes.map((change) => {
          const outCard = cardsByName.get(change.out);
          const inCard = cardsByName.get(change.in);
          const outProfile = outCard ? buildCardProfile(outCard) : null;
          const inProfile = inCard ? buildCardProfile(inCard) : null;
          const outRoles =
            (outProfile?.roles ?? CARD_ATTRIBUTES[change.out]?.roles ?? []).join(
              ", ",
            ) || "utility";
          const inRoles =
            (inProfile?.roles ?? CARD_ATTRIBUTES[change.in]?.roles ?? []).join(
              ", ",
            ) || "utility";
          const outElixir = outProfile?.elixirCost;
          const inElixir = inProfile?.elixirCost;
          const outLevel = outProfile?.level;
          const inLevel = inProfile?.level;
          const levelDelta =
            outLevel !== undefined && inLevel !== undefined
              ? inLevel - outLevel
              : null;

          return (
            <li
              key={`${change.out}-${change.in}`}
              className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-3">
                <SwapCard
                  name={change.out}
                  card={outCard}
                  direction="out"
                />
                <ArrowRight
                  aria-hidden="true"
                  className="mt-4 size-5 justify-self-center text-[#6d7a8b]"
                />
                <SwapCard
                  name={change.in}
                  card={inCard}
                  direction="in"
                />
                <ConstraintButton
                  kind="keep"
                  cardName={change.out}
                  active={lockedCards.includes(change.out)}
                  onToggle={onToggleLock}
                />
                <span aria-hidden="true" />
                <ConstraintButton
                  kind="avoid"
                  cardName={change.in}
                  active={excludedCards.includes(change.in)}
                  onToggle={onToggleExclude}
                />
              </div>

              <div className="min-w-0 md:pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      tabIndex={0}
                      className="mb-2 flex flex-wrap items-center gap-1.5 cursor-help"
                    >
                      {outElixir !== undefined && inElixir !== undefined ? (
                        <span className="inline-flex items-center rounded-full bg-[#eaf1ff] px-2.5 py-0.5 text-[11px] font-extrabold text-[#164fc9] tabular-nums">
                          {outElixir} → {inElixir} elixir
                        </span>
                      ) : null}
                      {outLevel !== undefined && inLevel !== undefined ? (
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums",
                            levelDelta !== null && levelDelta > 0
                              ? "bg-[#e8f6f0] text-[#087454]"
                              : levelDelta !== null && levelDelta < 0
                                ? "bg-[#fff0ef] text-[#b42318]"
                                : "bg-[#eef1f5] text-[#33445c]",
                          ].join(" ")}
                        >
                          L{outLevel} → L{inLevel}
                          {levelDelta !== null && levelDelta !== 0
                            ? ` (${formatSigned(levelDelta)})`
                            : ""}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center rounded-full bg-[#f2f5fa] px-2.5 py-0.5 text-[11px] font-bold text-[#5c6b7f]">
                        {outRoles} → {inRoles}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs space-y-1 border-[#d9e1ec] bg-white p-2.5 text-xs text-[#0b1f3a] shadow-lg">
                    <p className="font-extrabold">
                      {change.out} → {change.in}
                    </p>
                    {outElixir !== undefined && inElixir !== undefined ? (
                      <p className="text-[#33445c]">
                        Elixir delta: {outElixir} → {inElixir} elixir (
                        {formatSigned(inElixir - outElixir)})
                      </p>
                    ) : null}
                    {outLevel !== undefined && inLevel !== undefined ? (
                      <p className="text-[#33445c]">
                        Level delta: L{outLevel} → L{inLevel} (
                        {formatSigned(inLevel - outLevel)})
                      </p>
                    ) : null}
                    <p className="text-[#5c6b7f]">
                      Role shift: {outRoles} → {inRoles}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-sm leading-6 text-[#33445c]">{change.reason}</p>
                {change.counterTargets && change.counterTargets.length > 0 ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-bold leading-5 text-[#087454]">
                    <Crosshair aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    Counters {change.counterTargets.join(", ")} from your losses
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
