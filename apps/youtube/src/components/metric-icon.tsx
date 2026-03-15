"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { Clock, Eye, MessageSquare, ThumbsUp, Zap, type LucideIcon } from "lucide-react";

export type MetricType = "views" | "engagement" | "momentum" | "efficiency" | "community";

export type MetricWeights = Record<MetricType, number>;

interface MetricConfig {
  type: MetricType;
  icon: LucideIcon;
  color: string;
  label: string;
  description: string;
}

export const DEFAULT_WEIGHTS: MetricWeights = {
  views: 30,
  engagement: 25,
  momentum: 20,
  efficiency: 15,
  community: 10,
};

export const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  views: {
    type: "views",
    icon: Eye,
    color: "text-emerald-600 dark:text-emerald-400",
    label: "Reach",
    description: "View count percentile within the channel. Higher rank means broader reach relative to other videos.",
  },
  engagement: {
    type: "engagement",
    icon: ThumbsUp,
    color: "text-sky-600 dark:text-sky-400",
    label: "Engagement",
    description: "Bayesian-smoothed interaction rate (likes + 5x comments per 1K views), ranked within the channel.",
  },
  momentum: {
    type: "momentum",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    label: "Momentum",
    description: "View velocity adjusted for age. Rewards videos accumulating views quickly relative to their peers.",
  },
  efficiency: {
    type: "efficiency",
    icon: Zap,
    color: "text-orange-600 dark:text-orange-400",
    label: "Efficiency",
    description: "Engagement density per minute of content. Short, punchy videos that drive interaction score higher.",
  },
  community: {
    type: "community",
    icon: MessageSquare,
    color: "text-violet-600 dark:text-violet-400",
    label: "Community",
    description: "Comment-to-engagement ratio measuring discussion depth, smoothed to prevent small-sample noise.",
  },
};

export const METRIC_TYPES: MetricType[] = ["views", "engagement", "momentum", "efficiency", "community"];

export function getMetricsSortedByWeight(weights: MetricWeights): MetricConfig[] {
  return [...METRIC_TYPES]
    .sort((a, b) => weights[b] - weights[a])
    .map(type => METRIC_CONFIGS[type]);
}

interface MetricIconProps {
  type: MetricType;
  weight?: number;
  value?: number | null;
  showLabel?: boolean;
  showWeight?: boolean;
  className?: string;
}

export function MetricIcon({
  type,
  weight,
  value,
  showLabel = false,
  showWeight = false,
  className = "",
}: Readonly<MetricIconProps>) {
  const config = METRIC_CONFIGS[type];
  const displayWeight = weight ?? DEFAULT_WEIGHTS[type];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 cursor-help ${className}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          {value !== undefined && (
            <span className="tabular-nums">{value?.toFixed(0) ?? "-"}</span>
          )}
          {showLabel && (
            <span className={showWeight ? "font-medium" : ""}>
              {config.label}
              {showWeight && ` (${displayWeight}%)`}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p className="font-semibold mb-1">
          {config.label} ({displayWeight}% of score)
        </p>
        <p className="text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

type ScoreComponentsMap = {
  views?: number | null;
  engagement?: number | null;
  momentum?: number | null;
  efficiency?: number | null;
  community?: number | null;
};

interface MetricIconsRowProps {
  weights?: MetricWeights;
  values?: ScoreComponentsMap;
  showLabel?: boolean;
  showWeight?: boolean;
  className?: string;
}

export function getNormalizedWeight(weights: MetricWeights, type: MetricType): number {
  const total = METRIC_TYPES.reduce((sum, t) => sum + weights[t], 0);
  if (total === 0) return 0;
  return Math.round((weights[type] / total) * 100);
}

export function MetricIconsRow({
  weights = DEFAULT_WEIGHTS,
  values,
  showLabel = false,
  showWeight = false,
  className = "",
}: Readonly<MetricIconsRowProps>) {
  const getValue = (type: MetricType): number | undefined => {
    if (!values) return undefined;
    return values[type] ?? undefined;
  };

  return (
    <div className={`flex gap-3 ${className}`}>
      {METRIC_TYPES.map((type) => (
        <MetricIcon
          key={type}
          type={type}
          weight={getNormalizedWeight(weights, type)}
          value={getValue(type)}
          showLabel={showLabel}
          showWeight={showWeight}
        />
      ))}
    </div>
  );
}
