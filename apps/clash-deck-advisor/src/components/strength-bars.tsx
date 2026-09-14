import { BarChart3 } from "lucide-react";

import type { WeaknessScores } from "@/lib/schemas";

interface StrengthBarsProps {
  scores: WeaknessScores;
}

const dimensions: Array<{
  key: keyof WeaknessScores;
  label: string;
}> = [
  { key: "airDefense", label: "Air defense" },
  { key: "tankStopping", label: "Tank stopping" },
  { key: "swarmControl", label: "Swarm control" },
  { key: "spellCoverage", label: "Spell coverage" },
  { key: "cycle", label: "Cycle" },
  { key: "synergy", label: "Synergy" },
];

export function StrengthBars({ scores }: StrengthBarsProps) {
  return (
    <section
      aria-labelledby="strength-title"
      className="paper-panel rounded-[1.35rem] p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#164fc9]">
          <BarChart3 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            id="strength-title"
            className="font-display text-2xl font-semibold"
          >
            Deck strength
          </h2>
          <p className="text-sm text-[#5c6b7f]">
            How the final eight balance out
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {dimensions.map(({ key, label }) => {
          const score = Math.round(scores[key]);
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold">
                <span className="text-[#33445c]">{label}</span>
                <span className="tabular-nums text-[#0b1f3a]">{score}</span>
              </div>
              <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
                className="h-2.5 overflow-hidden rounded-full bg-[#e7ebf1]"
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#164fc9,#3d79f2_72%,#d6a11f)]"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
