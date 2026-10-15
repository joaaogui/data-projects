import { ArrowRight, Ban, Crosshair, Lock } from "lucide-react";
import Image from "next/image";

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
    <ol aria-label="Recommended swaps" className="divide-y divide-[#e2e7ee]">
      {changes.map((change) => (
        <li
          key={`${change.out}-${change.in}`}
          className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-6"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-3">
            <SwapCard
              name={change.out}
              card={cardsByName.get(change.out)}
              direction="out"
            />
            <ArrowRight
              aria-hidden="true"
              className="mt-4 size-5 justify-self-center text-[#6d7a8b]"
            />
            <SwapCard
              name={change.in}
              card={cardsByName.get(change.in)}
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
            <p className="text-sm leading-6 text-[#33445c]">{change.reason}</p>
            {change.counterTargets && change.counterTargets.length > 0 ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-bold leading-5 text-[#087454]">
                <Crosshair aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                Counters {change.counterTargets.join(", ")} from your losses
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
