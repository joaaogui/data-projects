import { getScoreColorClass } from "@/lib/format";

export function ScoreBadge({ score }: Readonly<{ score: number }>) {
  return (
    <span
      className={`w-9 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium tabular-nums ${getScoreColorClass(score)}`}
    >
      {score.toFixed(0)}
    </span>
  );
}
