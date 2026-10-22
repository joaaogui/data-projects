import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@data-projects/ui";
import { Crosshair, ShieldAlert, Swords } from "lucide-react";
import Image from "next/image";

import type { CardSwap } from "@/lib/schemas";
import type {
  ClashCard,
  LossAutopsy,
  ThreatCardStat,
  ThreatCategory,
} from "@/lib/types";

interface LossReasonsProps {
  lossAutopsy: LossAutopsy;
  changes: CardSwap[];
  cardsByName: Map<string, ClashCard>;
}

const THREAT_CATEGORY_LABELS: Record<ThreatCategory, string> = {
  heavyTank: "Heavy tank",
  fastCycleWinCon: "Fast cycle win con",
  spellBait: "Spell bait",
  airBeatdown: "Air beatdown",
  splashSupport: "Splash support",
  buildingSiege: "Building siege",
  other: "General threat",
};

const BLIND_SPOT_SEVERITY: Record<
  "high" | "medium" | "low",
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-[#fff0ef] text-[#b42318]" },
  medium: { label: "Medium", className: "bg-[#fff5d6] text-[#76530a]" },
  low: { label: "Low", className: "bg-[#eef1f5] text-[#33445c]" },
};

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
  const blindSpots = lossAutopsy.dominantBlindSpots ?? [];
  const threatArchetypes = lossAutopsy.topThreatArchetypes ?? [];

  return (
    <TooltipProvider delayDuration={150}>
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
                const categoryLabel =
                  THREAT_CATEGORY_LABELS[threat.threatCategory] ??
                  threat.threatCategory;
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold leading-tight text-[#0b1f3a]">
                          {threat.cardName}
                        </p>
                        <span className="rounded-full bg-[#fff0ef] px-2 py-0.5 text-[11px] font-extrabold text-[#b42318] tabular-nums">
                          {Math.round(threat.lossRateAgainst)}% loss rate
                        </span>
                        <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[11px] font-bold text-[#33445c]">
                          {categoryLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-[#5c6b7f]">
                        You lost {threat.lossesAgainst} of {threat.totalSeen}{" "}
                        {threat.totalSeen === 1 ? "game" : "games"} against it with this deck
                      </p>
                      {threat.recommendedCounters.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p
                              tabIndex={0}
                              className="mt-1 text-xs font-medium text-[#5c6b7f] cursor-help"
                            >
                              Viable counters in your collection:{" "}
                              <span className="font-bold text-[#33445c]">
                                {threat.recommendedCounters.join(", ")}
                              </span>
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs border-[#d9e1ec] bg-white p-2.5 text-xs text-[#0b1f3a] shadow-lg">
                            Viable counters in your collection:{" "}
                            {threat.recommendedCounters.join(", ")}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
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

        {blindSpots.length > 0 ? (
          <div className="mt-5 border-t border-[#e2e7ee] pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
              <ShieldAlert aria-hidden="true" className="size-3.5 text-[#b42318]" />
              Dominant blind spots
            </h3>
            <ul className="mt-2.5 space-y-2.5">
              {blindSpots.map((spot) => {
                const badge = BLIND_SPOT_SEVERITY[spot.severity];
                return (
                  <li
                    key={`${spot.category}-${spot.label}`}
                    className="rounded-xl bg-[#f8faff] p-3 text-xs leading-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-[#0b1f3a]">
                        {spot.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[#5c6b7f]">
                        Needs: {spot.neededRole}
                      </span>
                    </div>
                    <p className="mt-1 text-[#5c6b7f]">{spot.evidence}</p>
                    {spot.counterCards.length > 0 ? (
                      <p className="mt-1 font-bold text-[#33445c]">
                        Collection answers: {spot.counterCards.join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {threatArchetypes.length > 0 ? (
          <div className="mt-5 border-t border-[#e2e7ee] pt-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
              Top threat archetypes
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {threatArchetypes.map((item) => (
                <li
                  key={item.archetype}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#fff6f5] px-3 py-1 text-xs font-bold text-[#0b1f3a] ring-1 ring-[#f1d3cf]"
                >
                  <span>{item.archetype}</span>
                  <span className="text-[#b42318] tabular-nums">
                    {item.losses}L–{item.wins}W ({Math.round(item.lossRate)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </TooltipProvider>
  );
}
