"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Input,
} from "@data-projects/ui";
import { Sparkles, Send, Loader2, ExternalLink, X } from "lucide-react";
import type { VideoData } from "@/types/youtube";
import {
  executeQuery,
  fetchAIQuery,
  type VideoQuery,
  type QueryResult,
  type AIProvider,
} from "@/lib/video-filter";
import { formatDuration } from "@/lib/scoring";
import Image from "next/image";

interface AIQueryChatProps {
  videos: VideoData[];
}

const EXAMPLE_QUESTIONS = [
  "Hidden gems with high engagement but low views",
  "Are Shorts or long-form performing better?",
  "Which recent video is growing the fastest?",
  "Videos that sparked the most community discussion",
  "Most efficient content by engagement per minute",
];

const formatNumber = (num: number) => num.toLocaleString("en-US");

function ProviderSwitch({
  provider,
  onChange,
}: {
  provider: AIProvider;
  onChange: (p: AIProvider) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted text-xs">
      <button
        onClick={() => onChange("groq")}
        className={`px-2 py-1 rounded-md transition-colors ${
          provider === "groq"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Groq
      </button>
      <button
        onClick={() => onChange("gemini")}
        className={`px-2 py-1 rounded-md transition-colors ${
          provider === "gemini"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Gemini
      </button>
    </div>
  );
}

function VideoResultCard({ video }: { video: VideoData }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
    >
      <Image
        src={video.thumbnail}
        alt={video.title}
        width={80}
        height={45}
        className="rounded object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <span>{formatNumber(video.views)} views</span>
          <span>•</span>
          <span>{formatDuration(video.duration)}</span>
          <span>•</span>
          <span>{video.days === 0 ? "Today" : `${video.days}d ago`}</span>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  );
}

export function AIQueryChat({ videos }: AIQueryChatProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>("groq");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (q: string) => {
      if (!q.trim() || loading) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const query: VideoQuery = await fetchAIQuery(q, provider);
        const queryResult = executeQuery(videos, query);
        setResult(queryResult);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to process question"
        );
      } finally {
        setLoading(false);
      }
    },
    [videos, loading, provider]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(question);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuestion(example);
    handleSubmit(example);
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
    setQuestion("");
    inputRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-primary hover:bg-primary/90"
        >
          <Sparkles className="h-6 w-6" />
          <span className="sr-only">Ask AI</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Ask about videos
            </DialogTitle>
            <ProviderSwitch provider={provider} onChange={setProvider} />
          </div>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., What video has the most views?"
            disabled={loading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => handleSubmit(question)}
            disabled={!question.trim() || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!result && !error && !loading && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {result.explanation || `Found ${result.videos.length} video(s)`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>

            {result.videos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No videos match your query
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {result.videos.map((video) => (
                  <VideoResultCard key={video.videoId} video={video} />
                ))}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
