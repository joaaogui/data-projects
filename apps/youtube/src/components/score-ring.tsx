"use client";

import { getScoreLabel } from "@/lib/scoring";
import type { ScoreComponents } from "@/types/youtube";
import { Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "./metric-icon";

interface ScoreRingProps {
  score: number;
  scoreComponents: ScoreComponents;
  weights: MetricWeights;
  size?: number;
}

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  momentum: "momentumScore",
  efficiency: "efficiencyScore",
  community: "communityScore",
};

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function ScoreRing({ score, scoreComponents, weights, size = 48 }: Readonly<ScoreRingProps>) {
  const { label, color } = getScoreLabel(score);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const gapDeg = 4;

  const totalWeight = METRIC_TYPES.reduce((s, t) => s + weights[t], 0);
  if (totalWeight === 0) return null;

  const arcs: { d: string; metricType: string; opacity: number; label: string; value: number; weight: number }[] = [];
  let currentAngle = 0;

  for (const type of METRIC_TYPES) {
    const weight = weights[type];
    const sweepDeg = (weight / totalWeight) * 360 - gapDeg;
    if (sweepDeg <= 0) {
      currentAngle += (weight / totalWeight) * 360;
      continue;
    }

    const componentKey = METRIC_TO_COMPONENT[type];
    const value = scoreComponents[componentKey] ?? 0;
    const config = METRIC_CONFIGS[type];
    const opacity = 0.25 + (value / 100) * 0.75;

    arcs.push({
      d: describeArc(cx, cy, r, currentAngle + gapDeg / 2, currentAngle + sweepDeg + gapDeg / 2),
      metricType: type,
      opacity,
      label: config.label,
      value,
      weight: getNormalizedWeight(weights, type),
    });

    currentAngle += (weight / totalWeight) * 360;
  }

  const strokeColorMap: Record<string, string> = {
    views: "stroke-emerald-600 dark:stroke-emerald-400",
    engagement: "stroke-sky-600 dark:stroke-sky-400",
    momentum: "stroke-amber-600 dark:stroke-amber-400",
    efficiency: "stroke-orange-600 dark:stroke-orange-400",
    community: "stroke-violet-600 dark:stroke-violet-400",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-0.5 cursor-help">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${score.toFixed(0)} - ${label}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted/30" strokeWidth="3" />
            {arcs.map((arc) => (
              <path
                key={arc.label}
                d={arc.d}
                fill="none"
                className={strokeColorMap[arc.metricType] ?? "stroke-muted-foreground"}
                strokeWidth="3"
                strokeLinecap="round"
                pathLength={1}
                style={{ opacity: arc.opacity, strokeDasharray: 1, strokeDashoffset: 0, transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            ))}
            <text
              x={cx}
              y={cy - 1}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground font-bold"
              style={{ fontSize: size * 0.28 }}
            >
              {score.toFixed(0)}
            </text>
          </svg>
          <span className={`text-[10px] font-medium leading-none ${color}`}>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="min-w-[160px]">
        <p className="font-semibold mb-2">Score Breakdown</p>
        <div className="space-y-1.5">
          {arcs.map((arc) => (
            <div key={arc.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{arc.label} ({arc.weight}%)</span>
              <span className="font-medium tabular-nums">{arc.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
