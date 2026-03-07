"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button, Input } from "@data-projects/ui";
import { Sparkles, Send, Loader2, X, ChevronDown } from "lucide-react";
import type { VideoData } from "@/types/youtube";
import {
  executeQuery,
  fetchAIQuery,
  type VideoQuery,
  type QueryResult,
  type AIProvider,
} from "@/lib/video-filter";

interface AIQueryChatProps {
  videos: VideoData[];
  onHighlight?: (videoIds: Set<string>) => void;
}

const EXAMPLE_QUESTIONS = [
  "Hidden gems with high engagement but low views",
  "Which recent video is growing the fastest?",
  "Videos that sparked the most discussion",
  "Most efficient content by engagement per minute",
];

function ProviderSwitch({
  provider,
  onChange,
}: Readonly<{
  provider: AIProvider;
  onChange: (p: AIProvider) => void;
}>) {
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

export function AIQueryPanel({ videos, onHighlight }: Readonly<AIQueryChatProps>) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>("groq");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      globalThis.setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      onHighlight?.(new Set());
    }
  }, [open, onHighlight]);

  useEffect(() => {
    if (result) {
      onHighlight?.(new Set(result.videos.map((v) => v.videoId)));
    }
  }, [result, onHighlight]);

  const handleSubmit = useCallback(
    async (q: string) => {
      if (!q.trim() || loading) return;

      setLoading(true);
      setError(null);
      setResult(null);
      onHighlight?.(new Set());

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
    [videos, loading, provider, onHighlight]
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
    onHighlight?.(new Set());
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setOpen(false);
    setResult(null);
    setError(null);
    setQuestion("");
  };

  return (
    <>
      <Button
        variant={open ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Ask AI</span>
        {open && <ChevronDown className="h-3 w-3 ml-0.5" />}
      </Button>

      {open && (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3 sm:p-4 space-y-3 col-span-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Ask about videos
            </div>
            <div className="flex items-center gap-2">
              <ProviderSwitch provider={provider} onChange={setProvider} />
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 w-7 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., What video has the most views?"
              disabled={loading}
              className="flex-1 h-8 text-sm bg-muted/50 border-transparent focus:border-border"
            />
            <Button
              size="sm"
              onClick={() => handleSubmit(question)}
              disabled={!question.trim() || loading}
              className="h-8"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {!result && !error && !loading && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              {error}
            </div>
          )}

          {result && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {result.explanation || `Found ${result.videos.length} video(s)`}
                {result.videos.length > 0 && (
                  <span className="ml-1 font-medium text-primary">
                    — {result.videos.length} highlighted in table
                  </span>
                )}
              </p>
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
