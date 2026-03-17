"use client";

import { usePulse } from "@/hooks/use-pulse";
import { Skeleton } from "@data-projects/ui";
import { Activity, BarChart3, Bookmark, Zap } from "lucide-react";
import { PulseFeed } from "./pulse-feed";
import { TrackedChannelsGrid } from "./tracked-channels-grid";

function SummaryStat({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      {icon}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-mono tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["sk-stat-1", "sk-stat-2", "sk-stat-3", "sk-stat-4"].map((id) => (
          <Skeleton key={id} className="h-16 rounded-xl" />
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {["sk-ch-1", "sk-ch-2", "sk-ch-3"].map((id) => (
            <Skeleton key={id} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {["sk-feed-1", "sk-feed-2", "sk-feed-3"].map((id) => (
            <Skeleton key={id} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChannelPulse() {
  const { data, isLoading } = usePulse();

  if (isLoading) return <PulseSkeleton />;

  const channels = data?.channels ?? [];
  const feed = data?.feed ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-8">
      {summary && channels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryStat
            icon={<Bookmark className="h-4 w-4 text-primary" />}
            label="Tracked"
            value={String(summary.totalTracked)}
          />
          <SummaryStat
            icon={<Activity className="h-4 w-4 text-sky-500" />}
            label="New Videos"
            value={String(summary.totalNewVideos)}
          />
          <SummaryStat
            icon={<BarChart3 className="h-4 w-4 text-emerald-500" />}
            label="Avg Score"
            value={summary.avgScoreAcrossChannels > 0 ? summary.avgScoreAcrossChannels.toFixed(1) : "—"}
          />
          <SummaryStat
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            label="Alerts"
            value={String(summary.alerts)}
          />
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold tracking-tight">Your Channels</h2>
          {channels.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
              {channels.length}
            </span>
          )}
        </div>
        <TrackedChannelsGrid channels={channels} />
      </div>

      {channels.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold tracking-tight mb-3">What&apos;s New</h2>
          <PulseFeed items={feed} />
        </div>
      )}
    </div>
  );
}
