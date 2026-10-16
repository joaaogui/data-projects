import { formatNumber, formatSigned } from "@data-projects/shared";

import type { LossAutopsy, Player } from "@/lib/types";

interface StatusStripProps {
  player: Player;
  lossAutopsy: LossAutopsy;
  generatedAt: string;
}

const TONE = {
  good: "text-[#087454]",
  bad: "text-[#b42318]",
  neutral: "text-[#0b1f3a]",
} as const;

function streakText(streak: LossAutopsy["currentStreak"]): string {
  if (streak.type === "none" || streak.count === 0) return "None";
  const noun =
    streak.type === "win"
      ? streak.count === 1
        ? "win"
        : "wins"
      : streak.count === 1
        ? "loss"
        : "losses";
  return `${streak.count} ${noun}`;
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-[#5c6b7f]">{label}</dt>
      <dd
        className={`mt-0.5 text-xl font-extrabold tabular-nums ${TONE[tone]}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function StatusStrip({
  player,
  lossAutopsy,
  generatedAt,
}: StatusStripProps) {
  const careerGames = player.wins + player.losses;
  const careerWinRate =
    careerGames > 0 ? (player.wins / careerGames) * 100 : 0;
  const battles = lossAutopsy.totalBattlesAnalyzed;
  const winRate = lossAutopsy.recentWinRate;
  const net = lossAutopsy.netTrophies;
  const updatedAt = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-labelledby="status-title"
      className="paper-panel rounded-2xl px-5 py-4 sm:px-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h1
            id="status-title"
            className="font-display text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl"
          >
            {player.name}
          </h1>
          <p className="mt-1 text-xs font-bold text-[#6d7a8b]">
            {formatNumber(player.trophies)} trophies · career{" "}
            {careerWinRate.toFixed(0)}% win rate · updated {updatedAt}
          </p>
        </div>

        {battles > 0 ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-10">
            <Stat
              label={`Win rate · last ${battles}`}
              value={`${winRate.toFixed(0)}%`}
              tone={winRate >= 55 ? "good" : winRate < 45 ? "bad" : "neutral"}
            />
            <Stat
              label="Record"
              value={`${lossAutopsy.recentWins}W–${lossAutopsy.recentLosses}L${
                lossAutopsy.recentDraws > 0
                  ? `–${lossAutopsy.recentDraws}D`
                  : ""
              }`}
            />
            <Stat
              label="Streak"
              value={streakText(lossAutopsy.currentStreak)}
              tone={
                lossAutopsy.currentStreak.type === "win"
                  ? "good"
                  : lossAutopsy.currentStreak.type === "loss"
                    ? "bad"
                    : "neutral"
              }
            />
            <Stat
              label="Trophies"
              value={formatSigned(net)}
              tone={net > 0 ? "good" : net < 0 ? "bad" : "neutral"}
            />
          </dl>
        ) : (
          <p className="text-sm text-[#5c6b7f]">
            No recent battles in the log yet.
          </p>
        )}
      </div>
    </section>
  );
}
