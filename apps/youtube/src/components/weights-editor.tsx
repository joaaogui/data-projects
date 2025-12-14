"use client";

import { RotateCcw } from "lucide-react";
import { Button, Tooltip, TooltipTrigger, TooltipContent } from "@data-projects/ui";
import { 
  METRIC_TYPES, 
  DEFAULT_WEIGHTS,
  METRIC_CONFIGS,
  type MetricType, 
  type MetricWeights,
} from "./metric-icon";

interface WeightsEditorProps {
  weights: MetricWeights;
  onChange: (weights: MetricWeights) => void;
}

export function WeightsEditor({ weights, onChange }: Readonly<WeightsEditorProps>) {
  const handleWeightChange = (type: MetricType, newValue: number) => {
    onChange({ ...weights, [type]: newValue });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_WEIGHTS });
  };

  const isDefault = METRIC_TYPES.every(t => weights[t] === DEFAULT_WEIGHTS[t]);
  const total = METRIC_TYPES.reduce((sum, t) => sum + weights[t], 0);

  return (
    <div className="flex flex-col gap-2 w-56">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">Adjust Weights</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={isDefault}
          className="h-6 px-1.5 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="grid gap-2">
        {METRIC_TYPES.map((type) => {
          const metric = METRIC_CONFIGS[type];
          const Icon = metric.icon;
          const value = weights[type];
          const normalizedPct = total > 0 ? Math.round((value / total) * 100) : 0;
          
          return (
            <div key={type} className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Icon className={`h-3.5 w-3.5 ${metric.color}`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-medium">{metric.label}</p>
                  <p className="text-muted-foreground text-xs">{metric.description}</p>
                </TooltipContent>
              </Tooltip>
              
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => handleWeightChange(type, Number(e.target.value))}
                className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              
              <span className={`w-10 text-right text-xs font-medium tabular-nums ${metric.color}`}>
                {normalizedPct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
