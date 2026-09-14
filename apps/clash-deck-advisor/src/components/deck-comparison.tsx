import { ArrowDown, ArrowRight, Droplets } from "lucide-react";

import type { DeckAnalysis } from "@/lib/schemas";
import type { ClashCard, Player } from "@/lib/types";

import { CardTile } from "./card-tile";

interface DeckComparisonProps {
  analysis: DeckAnalysis;
  player: Player;
}

function averageElixir(cards: ClashCard[]): number {
  const elixirValues = cards.flatMap((card) =>
    typeof card.elixirCost === "number" ? [card.elixirCost] : [],
  );

  if (elixirValues.length === 0) {
    return 0;
  }

  return (
    elixirValues.reduce((total, elixir) => total + elixir, 0) /
    elixirValues.length
  );
}

export function DeckComparison({ analysis, player }: DeckComparisonProps) {
  const cardsByName = new Map(
    [...player.cards, ...player.currentDeck].map((card) => [card.name, card]),
  );
  const originalCards = analysis.originalDeck
    .map((name) => cardsByName.get(name))
    .filter((card): card is ClashCard => Boolean(card));
  const improvedCards = analysis.improvedDeck
    .map((name) => cardsByName.get(name))
    .filter((card): card is ClashCard => Boolean(card));
  const improvedNames = new Set(analysis.improvedDeck);
  const originalNames = new Set(analysis.originalDeck);

  return (
    <section id="deck-comparison" aria-labelledby="deck-comparison-title">
      <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-[#164fc9]">
            Workbench comparison
          </p>
          <h2
            id="deck-comparison-title"
            className="font-display mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#0b1f3a] sm:text-4xl"
          >
            Current deck vs. workshop build
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#5c6b7f]">
          Gold-framed cards are the recommended additions. Faded cards leave the
          deck.
        </p>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]">
        <div className="paper-panel rounded-[1.4rem] border-t-[3px] border-t-[#0b1f3a] p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-[#5c6b7f]">
                In your battle deck
              </p>
              <h3 className="font-display mt-0.5 text-2xl font-semibold">
                Current eight
              </h3>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-[#eef1f5] px-3 py-1.5 text-xs font-extrabold text-[#0b1f3a]">
              <Droplets
                aria-hidden="true"
                className="size-3.5 text-[#164fc9]"
              />
              {averageElixir(originalCards).toFixed(1)}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {originalCards.map((card, index) => (
              <CardTile
                key={card.id}
                card={card}
                change={improvedNames.has(card.name) ? undefined : "removed"}
                priority={index < 4}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center py-1 xl:py-0">
          <div className="flex size-10 items-center justify-center rounded-full border border-[#e2be57] bg-[#fff5d6] text-[#76530a] shadow-sm xl:size-11">
            <ArrowDown aria-hidden="true" className="size-5 xl:hidden" />
            <ArrowRight aria-hidden="true" className="hidden size-5 xl:block" />
          </div>
        </div>

        <div className="blueprint-grid relative overflow-hidden rounded-[1.4rem] border border-[#cfb45d] border-t-[3px] border-t-[#d6a11f] p-3 shadow-[0_18px_48px_rgba(22,79,201,0.08)] sm:p-5">
          <div
            aria-hidden="true"
            className="absolute -right-7 -top-8 size-28 rounded-full border-[18px] border-[#f3c95e]/15"
          />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-[#76530a]">
                Recommended configuration
              </p>
              <h3 className="font-display mt-0.5 text-2xl font-semibold">
                {analysis.verdict === "keep"
                  ? "Keep this build"
                  : "Improved eight"}
              </h3>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-[#e4c66e] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0b1f3a]">
              <Droplets
                aria-hidden="true"
                className="size-3.5 text-[#164fc9]"
              />
              {analysis.averageElixir.toFixed(1)}
            </span>
          </div>

          <div className="relative grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {improvedCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                change={originalNames.has(card.name) ? undefined : "added"}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
