"use client";

import { useIsChannelTracked, useTrackChannel } from "@/hooks/use-saved-channels";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { AlertCircle, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function TrackChannelButton({ channelId }: Readonly<{ channelId: string }>) {
  const isTracked = useIsChannelTracked(channelId);
  const { track, untrack } = useTrackChannel();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPending = track.isPending || untrack.isPending;
  const hasError = !!errorMsg;

  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  const handleClick = useCallback(() => {
    if (isPending) return;
    setErrorMsg(null);
    if (isTracked) {
      untrack.mutate(channelId, {
        onError: (err) => setErrorMsg(err.message),
      });
    } else {
      track.mutate(channelId, {
        onError: (err) => setErrorMsg(err.message),
      });
    }
  }, [isPending, isTracked, channelId, track, untrack]);

  function renderIcon() {
    if (isPending) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (hasError) return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    if (isTracked) return <BookmarkCheck className="h-3.5 w-3.5 text-primary" />;
    return <Bookmark className="h-3.5 w-3.5" />;
  }

  function getTooltipText() {
    if (hasError) return errorMsg;
    if (isTracked) return "Remove from tracked channels";
    return "Track this channel";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 rounded-lg"
          onClick={handleClick}
          disabled={isPending}
          aria-label={isTracked ? "Untrack channel" : "Track channel"}
        >
          {renderIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {getTooltipText()}
      </TooltipContent>
    </Tooltip>
  );
}
