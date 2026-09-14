import { Scale, ShieldCheck, ShieldX, Swords } from "lucide-react";

import type { Matchup } from "@/lib/schemas";

interface MatchupsProps {
  matchups: Matchup[];
}

const ratingDetails = {
  favored: {
    label: "Favored",
    className: "bg-[#e8f6f0] text-[#087454]",
    Icon: ShieldCheck,
  },
  even: {
    label: "Even",
    className: "bg-[#fff5d6] text-[#76530a]",
    Icon: Scale,
  },
  unfavored: {
    label: "Unfavored",
    className: "bg-[#fff0ef] text-[#b42318]",
    Icon: ShieldX,
  },
} as const;

export function Matchups({ matchups }: MatchupsProps) {
  return (
    <section
      aria-labelledby="matchups-title"
      className="paper-panel rounded-[1.35rem] p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#164fc9]">
          <Swords aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            id="matchups-title"
            className="font-display text-2xl font-semibold"
          >
            Matchup map
          </h2>
          <p className="text-sm text-[#5c6b7f]">
            Five common tests for the final deck
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#e2e7ee]">
        {matchups.map((matchup) => {
          const rating = ratingDetails[matchup.rating];
          return (
            <article
              key={`${matchup.archetype}-${matchup.rating}`}
              className="py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-[#0b1f3a]">
                  {matchup.archetype}
                </h3>
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${rating.className}`}
                >
                  <rating.Icon aria-hidden="true" className="size-3.5" />
                  {rating.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5c6b7f]">
                {matchup.advice}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
