"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@data-projects/ui";
import { getScoreLabel } from "@/lib/scoring";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "./metric-icon";
import type { ScoreComponents } from "@/types/youtube";

interface ScoreRingProps {
  score: number;
  scoreComponents: ScoreComponents;
  weights: MetricWeights;
  size?: number;
}

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  consistency: "consistencyScore",
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

  const arcs: { d: string; color: string; opacity: number; label: string; value: number; weight: number }[] = [];
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
      color: config.color.replace("text-", ""),
      opacity,
      label: config.label,
      value,
      weight: getNormalizedWeight(weights, type),
    });

    currentAngle += (weight / totalWeight) * 360;
  }

  const strokeColorMap: Record<string, string> = {
    "green-500": "stroke-green-500",
    "blue-500": "stroke-blue-500",
    "yellow-500": "stroke-yellow-500",
    "purple-500": "stroke-purple-500",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-0.5 cursor-help">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted/30" strokeWidth="3" />
            {arcs.map((arc) => (
              <path
                key={arc.label}
                d={arc.d}
                fill="none"
                className={strokeColorMap[arc.color] ?? "stroke-muted-foreground"}
                strokeWidth="3"
                strokeLinecap="round"
                style={{ opacity: arc.opacity }}
              />
            ))}
            <text
              x={cx}
              y={cy - 1}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground font-bold"
              style={{ fontSize: size * 0.26 }}
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
