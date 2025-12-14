"use client";

import { Eye, Clock, MessageSquare, ThumbsUp, Zap, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@data-projects/ui";

export type MetricType = "views" | "engagement" | "consistency" | "community" | "efficiency";

export type MetricWeights = Record<MetricType, number>;

interface MetricConfig {
  type: MetricType;
  icon: LucideIcon;
  color: string;
  label: string;
  description: string;
}

export const DEFAULT_WEIGHTS: MetricWeights = {
  views: 35,
  engagement: 20,
  consistency: 15,
  community: 15,
  efficiency: 15,
};

export const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  views: {
    type: "views",
    icon: Eye,
    color: "text-green-500",
    label: "Views",
    description: "Total video views normalized against channel average. Higher views indicate broader reach and discoverability.",
  },
  engagement: {
    type: "engagement",
    icon: ThumbsUp,
    color: "text-blue-500",
    label: "Engagement",
    description: "Likes and comments per 1,000 views. Measures how actively viewers interact with the content.",
  },
  consistency: {
    type: "consistency",
    icon: Clock,
    color: "text-yellow-500",
    label: "Consistency",
    description: "Sustained engagement over time relative to video age. Older videos maintaining engagement score higher.",
  },
  community: {
    type: "community",
    icon: MessageSquare,
    color: "text-purple-500",
    label: "Community",
    description: "Comment-to-like ratio measuring discussion depth. Higher ratios indicate more engaged community conversations.",
  },
  efficiency: {
    type: "efficiency",
    icon: Zap,
    color: "text-orange-500",
    label: "Efficiency",
    description: "Views per minute of content. Measures how efficiently the video generates views relative to its length.",
  },
};

export const METRIC_TYPES: MetricType[] = ["views", "engagement", "consistency", "community", "efficiency"];

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
  consistency?: number | null;
  community?: number | null;
  efficiency?: number | null;
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
