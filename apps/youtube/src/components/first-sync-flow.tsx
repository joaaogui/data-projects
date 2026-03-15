"use client";

import type { SyncJobState } from "@/hooks/use-sync";
import { Button, Skeleton } from "@data-projects/ui";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Loader2,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ChannelInfo {
  channelTitle: string;
  thumbnails: { default: { url: string } };
}

interface FirstSyncFlowProps {
  channelInfo: ChannelInfo | undefined;
  isLoadingChannel: boolean;
  videoSync: SyncJobState | null;
  isVideoSyncing: boolean;
  onSyncVideos: () => void;
  onCancelSync: (type: "videos") => void;
  onReady: () => void;
}

type StepStatus = "pending" | "active" | "done";

const ANALYSIS_STEPS = [
  { label: "Discovering videos...", icon: Search },
  { label: "Fetching details...", icon: Database },
  { label: "Calculating scores...", icon: BarChart3 },
] as const;

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "active") return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
  return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
}

function useCountdown(from: number, onComplete: () => void, enabled: boolean) {
  const [remaining, setRemaining] = useState(from);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || cancelledRef.current) return;
    setRemaining(from);

    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [from, onComplete, enabled]);

  const cancel = () => {
    cancelledRef.current = true;
  };

  return { remaining, cancel };
}

export function FirstSyncFlow({
  channelInfo,
  isLoadingChannel,
  videoSync,
  isVideoSyncing,
  onSyncVideos,
  onCancelSync,
  onReady,
}: FirstSyncFlowProps) {
  const isCompleted = videoSync?.status === "completed";
  const isFailed = videoSync?.status === "failed";

  if (isLoadingChannel) return <LoadingState />;
  if (isCompleted) return <ReadyPhase onReady={onReady} />;
  if (isFailed) return <ErrorState videoSync={videoSync} onSyncVideos={onSyncVideos} />;
  if (isVideoSyncing) return <AnalyzingPhase videoSync={videoSync} onCancel={() => onCancelSync("videos")} />;
  if (channelInfo) return <ChannelFoundPhase channelInfo={channelInfo} onSyncVideos={onSyncVideos} />;

  return <LoadingState />;
}

function ChannelFoundPhase({
  channelInfo,
  onSyncVideos,
}: {
  channelInfo: ChannelInfo;
  onSyncVideos: () => void;
}) {
  const { remaining, cancel } = useCountdown(3, onSyncVideos, true);

  const handleClick = () => {
    cancel();
    onSyncVideos();
  };

  return (
    <Wrapper>
      <Image
        src={channelInfo.thumbnails.default.url}
        alt={channelInfo.channelTitle}
        width={80}
        height={80}
        className="rounded-full"
      />
      <h2 className="text-xl font-bold mt-4">{channelInfo.channelTitle}</h2>
      <p className="text-muted-foreground mt-1">
        Ready to analyze <span className="font-medium text-foreground">{channelInfo.channelTitle}</span>
      </p>
      <Button size="lg" className="mt-6 w-full max-w-xs" onClick={handleClick}>
        Analyze Channel
      </Button>
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Auto-starting in {remaining}s&hellip;
        </p>
      )}
    </Wrapper>
  );
}

function AnalyzingPhase({
  videoSync,
  onCancel,
}: {
  videoSync: SyncJobState | null;
  onCancel: () => void;
}) {
  const progress = videoSync?.progress;
  const phase = progress?.phase;
  const status = videoSync?.status;

  const stepStatuses: StepStatus[] = (() => {
    const pastPlaylist = phase !== "playlist" && phase !== "init" && phase !== "queued" && phase !== undefined;
    const pastDetails = phase === "saving" || phase === "done" || status === "completed";
    const allDone = status === "completed";

    const step1: StepStatus = pastPlaylist ? "done" : "active";
    const step2: StepStatus = pastDetails ? "done" : pastPlaylist ? "active" : "pending";
    const step3: StepStatus = allDone ? "done" : pastDetails ? "active" : "pending";

    return [step1, step2, step3];
  })();

  const percentage =
    progress?.total && progress.total > 0
      ? Math.round((progress.fetched / progress.total) * 100)
      : null;

  return (
    <Wrapper>
      <div className="w-full space-y-4">
        {ANALYSIS_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <StepIcon status={stepStatuses[i]} />
            <step.icon className="h-4 w-4 text-muted-foreground" />
            <span
              className={
                stepStatuses[i] === "pending"
                  ? "text-muted-foreground"
                  : "text-foreground"
              }
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {percentage !== null && (
        <div className="w-full mt-6 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress!.fetched} / {progress!.total} videos</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      <Button variant="outline" className="mt-6" onClick={onCancel}>
        Cancel
      </Button>
    </Wrapper>
  );
}

function ReadyPhase({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = setTimeout(onReady, 1500);
    return () => clearTimeout(id);
  }, [onReady]);

  return (
    <Wrapper>
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <h2 className="text-xl font-bold mt-4">Analysis complete!</h2>
    </Wrapper>
  );
}

function ErrorState({
  videoSync,
  onSyncVideos,
}: {
  videoSync: SyncJobState;
  onSyncVideos: () => void;
}) {
  const retryAfter = videoSync.retryAfterSeconds;
  const { remaining } = useCountdown(retryAfter ?? 0, onSyncVideos, !!retryAfter);

  return (
    <Wrapper>
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-sm text-destructive mt-4">{videoSync.error ?? "An unknown error occurred."}</p>

      {retryAfter && remaining > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Retrying in {remaining}s&hellip;
        </p>
      )}

      <div className="flex gap-3 mt-6">
        <Button onClick={onSyncVideos}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </Wrapper>
  );
}

function LoadingState() {
  return (
    <Wrapper>
      <Skeleton className="h-20 w-20 rounded-full" />
      <Skeleton className="h-6 w-48 mt-4" />
      <Skeleton className="h-4 w-64 mt-2" />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="animate-fade-up flex max-w-md flex-col items-center text-center mx-auto px-4">
        {children}
      </div>
    </div>
  );
}
