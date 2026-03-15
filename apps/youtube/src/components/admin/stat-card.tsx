"use client";

import { Card, CardContent } from "@data-projects/ui";
import { healthColor } from "@/components/admin/shared";

const STAT_STYLES = {
  default: { bg: "bg-primary/10", icon: "text-primary", value: "" },
  warning: { bg: "bg-amber-500/10", icon: "text-amber-500", value: "text-amber-500" },
  success: { bg: "bg-emerald-500/10", icon: "text-emerald-500", value: "text-emerald-500" },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: Readonly<{
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "success";
}>) {
  const s = STAT_STYLES[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold tabular-nums mt-1 ${s.value}`}>
              {value.toLocaleString()}
            </p>
          </div>
          <div className={`rounded-lg p-2.5 ${s.bg}`}>
            <Icon className={`h-5 w-5 ${s.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthBar({
  label,
  value,
  max,
}: Readonly<{ label: string; value: number; max: number }>) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value.toLocaleString()} / {max.toLocaleString()}
          <span className="text-muted-foreground ml-1.5">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${healthColor(percentage)} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
