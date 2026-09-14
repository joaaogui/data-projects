import { ArrowRight, Wrench } from "lucide-react";
import Image from "next/image";

import type { DeckAnalysis } from "@/lib/schemas";
import type { ClashCard, Player } from "@/lib/types";

interface SwapListProps {
  changes: DeckAnalysis["changes"];
  player: Player;
}

function MiniCard({
  card,
  direction,
}: {
  card: ClashCard;
  direction: "out" | "in";
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={[
          "relative size-14 shrink-0 overflow-hidden rounded-xl border bg-white",
          direction === "in" ? "border-[#d6a11f]" : "border-[#d9e1ec]",
        ].join(" ")}
      >
        <Image
          src={card.iconUrls.medium}
          alt=""
          fill
          sizes="56px"
          className="object-contain p-1"
        />
      </div>
      <div className="min-w-0">
        <span className="block text-[11px] font-bold text-[#7a8798]">
          {direction === "in" ? "Bring in" : "Take out"}
        </span>
        <span className="block truncate text-sm font-extrabold text-[#0b1f3a]">
          {card.name}
        </span>
      </div>
    </div>
  );
}

export function SwapList({ changes, player }: SwapListProps) {
  if (changes.length === 0) {
    return null;
  }

  const cardsByName = new Map(
    [...player.cards, ...player.currentDeck].map((card) => [card.name, card]),
  );

  return (
    <section aria-labelledby="swap-list-title">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[#164fc9]">
            <Wrench aria-hidden="true" className="size-4" />
            Workshop orders
          </p>
          <h2
            id="swap-list-title"
            className="font-display mt-1 text-3xl font-semibold tracking-[-0.035em]"
          >
            {changes.length === 1
              ? "One clear swap"
              : `${changes.length} clear swaps`}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border border-[#d9e1ec] bg-white">
        {changes.map((change, index) => {
          const outgoingCard = cardsByName.get(change.out);
          const incomingCard = cardsByName.get(change.in);
          if (!outgoingCard || !incomingCard) {
            return null;
          }

          return (
            <article
              key={`${change.out}-${change.in}`}
              className={[
                "grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,1.25fr)] sm:items-center sm:p-5",
                index > 0 ? "border-t border-[#d9e1ec]" : "",
              ].join(" ")}
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-2">
                <MiniCard card={outgoingCard} direction="out" />
                <span className="flex size-8 items-center justify-center rounded-full bg-[#eaf1ff] text-[#164fc9]">
                  <ArrowRight aria-hidden="true" className="size-4" />
                </span>
                <MiniCard card={incomingCard} direction="in" />
              </div>

              <div className="border-l-2 border-[#e5c45e] pl-4">
                <p className="text-sm font-bold text-[#0b1f3a]">
                  Why this earns a slot
                </p>
                <p className="mt-1 text-sm leading-6 text-[#5c6b7f]">
                  {change.reason}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
