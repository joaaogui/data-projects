import { Crosshair, Swords } from "lucide-react";
import Image from "next/image";

import type { CardSwap } from "@/lib/schemas";
import type { ClashCard, LossAutopsy, ThreatCardStat } from "@/lib/types";

interface LossReasonsProps {
  lossAutopsy: LossAutopsy;
  changes: CardSwap[];
  cardsByName: Map<string, ClashCard>;
}

function answeringSwaps(threat: ThreatCardStat, changes: CardSwap[]): string[] {
  return changes
    .filter(
      (change) =>
        change.counterTargets?.includes(threat.cardName) ||
        threat.recommendedCounters.includes(change.in),
    )
    .map((change) => change.in);
}

export function LossReasons({
  lossAutopsy,
  changes,
  cardsByName,
}: LossReasonsProps) {
  const deckBattles =
    lossAutopsy.currentDeckBattles ?? lossAutopsy.totalBattlesAnalyzed;
  const deckLosses =
    lossAutopsy.currentDeckLosses ?? lossAutopsy.recentLosses;
  const threats = lossAutopsy.topThreatCards.slice(0, 3);

  return (
    <section
      aria-labelledby="losing-title"
      className="paper-panel rounded-2xl p-5 sm:p-6"
    >
      <h2
        id="losing-title"
        className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
      >
        Why you&apos;re losing
      </h2>

      {threats.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-[#5c6b7f]">
          {deckBattles === 0
            ? "No recorded battles with your current 8-card deck yet. Play matches with this deck to track which opposing cards beat it."
            : deckLosses === 0
              ? `No losses in your ${deckBattles} recorded ${deckBattles === 1 ? "battle" : "battles"} with this deck. Keep it up.`
              : "No recurring threat cards spotted against this deck yet."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#5c6b7f]">
            The cards that beat your current deck most across {deckBattles} recorded{" "}
            {deckBattles === 1 ? "battle" : "battles"}.
          </p>
          <ol className="mt-4 space-y-4">
            {threats.map((threat) => {
              const card = cardsByName.get(threat.cardName);
              const answers = answeringSwaps(threat, changes);
              return (
                <li key={threat.cardName} className="flex items-start gap-3">
                  <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fff6f5] ring-1 ring-[#f1d3cf]">
                    {card ? (
                      <Image
                        src={card.iconUrls.medium}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-contain p-0.5"
                      />
                    ) : (
                      <Swords aria-hidden="true" className="size-5 text-[#b42318]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold leading-tight text-[#0b1f3a]">
                      {threat.cardName}
                    </p>
                    <p className="mt-0.5 text-sm text-[#5c6b7f]">
                      You lost {threat.lossesAgainst} of {threat.totalSeen}{" "}
                      {threat.totalSeen === 1 ? "game" : "games"} against it with this deck
                    </p>
                    {answers.length > 0 ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#087454]">
                        <Crosshair aria-hidden="true" className="size-3.5 shrink-0" />
                        Answered by {answers.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
