"use client";

import {
  compressVideoContext,
  generateSuggestions,
} from "@/lib/ai-insight";
import { parseHighlightedVideoIds, stripHighlightMarker } from "@/lib/ai-query";
import type { VideoData } from "@/types/youtube";
import { useChat } from "@ai-sdk/react";
import { Button, Input } from "@data-projects/ui";
import { DefaultChatTransport } from "ai";
import { Eye, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleTab(e: globalThis.KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (focusable.length === 0) { e.preventDefault(); return; }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [containerRef, active]);
}

function getMessageText(message: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  if (message.parts) {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text" && !!p.text)
      .map((p) => p.text)
      .join("");
  }
  return message.content ?? "";
}

interface AIDrawerProps {
  videos: VideoData[];
  onHighlight?: (videoIds: Set<string>) => void;
}

export function AIDrawer({ videos, onHighlight }: Readonly<AIDrawerProps>) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const handler = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
    document.addEventListener("open-ai-drawer", handler);
    return () => document.removeEventListener("open-ai-drawer", handler);
  }, []);

  useFocusTrap(drawerRef, open);

  const suggestions = useMemo(() => generateSuggestions(videos), [videos]);
  const context = useMemo(() => compressVideoContext(videos), [videos]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/query",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, context },
        }),
      }),
    [context],
  );

  const [input, setInput] = useState("");

  const { messages, sendMessage, setMessages, status } =
    useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    const lastMsg = messages.at(-1);
    if (lastMsg?.role !== "assistant") return;

    const text = getMessageText(lastMsg);
    const videoIds = parseHighlightedVideoIds(text);
    if (videoIds.length > 0) {
      onHighlight?.(new Set(videoIds));
    }
  }, [status, messages, onHighlight]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
    if (!open) onHighlight?.(new Set());
  }, [open, onHighlight]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSubmit = useCallback(
    (q: string) => {
      if (!q.trim() || isLoading) return;
      onHighlight?.(new Set());
      sendMessage({ text: q.trim() });
      setInput("");
    },
    [isLoading, onHighlight, sendMessage, setInput],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    onHighlight?.(new Set());
  }, [onHighlight, setMessages]);

  const lastAssistantIdx = messages.findLastIndex(
    (m) => m.role === "assistant",
  );
  const showFollowUps = !isLoading && lastAssistantIdx === messages.length - 1 && messages.length > 0;

  return (
    <>
      <Button
        variant={open ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Ask AI"
      >
        <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Ask AI</span>
      </Button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-200 cursor-default"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Close AI drawer"
        />
      )}

      <dialog
        open={open || undefined}
        ref={drawerRef}
        aria-modal="true"
        aria-label="AI Assistant"
        className={`fixed inset-[unset] top-0 right-0 m-0 p-0 h-full w-full sm:w-[420px] sm:max-w-[90vw] z-50 bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out max-w-none max-h-none ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Assistant</span>
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ⌘J
            </kbd>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 w-7 p-0"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite" aria-label="AI conversation">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center pt-8">
                Ask anything about this channel&apos;s {videos.length} videos
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors animate-scale-in"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const rawText = getMessageText(msg);
            const displayText = msg.role === "assistant" ? stripHighlightMarker(rawText) : rawText;
            const videoIds = msg.role === "assistant" ? parseHighlightedVideoIds(rawText) : [];

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end animate-slide-right" : "justify-start animate-fade-up"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60"
                    }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="leading-relaxed space-y-1 prose-sm">
                      {renderMarkdown(displayText)}
                      {status === "streaming" && messages.at(-1)?.id === msg.id && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm align-middle" />
                      )}
                    </div>
                  ) : (
                    <p>{displayText}</p>
                  )}
                  {msg.role === "assistant" &&
                    videoIds.length > 0 && (
                      <button
                        onClick={() => onHighlight?.(new Set(videoIds))}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        {videoIds.length} video
                        {videoIds.length === 1 ? "" : "s"} referenced
                      </button>
                    )}
                </div>
              </div>
            );
          })}

          {isLoading && messages.length > 0 && messages.at(-1)?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3.5 py-2.5 bg-muted/60">
                <div className="flex gap-1 items-center py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {showFollowUps && (
            <div className="flex flex-wrap gap-1.5 animate-fade-up" style={{ animationDelay: '400ms' }}>
              {suggestions.slice(0, 2).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/30">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(input);
                }
              }}
              placeholder="Ask about this channel..."
              disabled={isLoading}
              className="flex-1 h-9 text-sm"
            />
            <Button
              size="sm"
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || isLoading}
              className="h-9 px-3"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function inlineBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  const keyed = parts.map((part, idx) => ({ part, key: `b-${idx}`, bold: idx % 2 === 1 }));
  return keyed.map(({ part, key, bold }) =>
    bold ? <strong key={key}>{part}</strong> : part,
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const keyedLines = text.split("\n").map((line, idx) => ({ line, key: `md-${idx}` }));
  return keyedLines.map(({ line, key }) => {
    if (line.trim() === "") return <br key={key} />;
    if (line.startsWith("### "))
      return (
        <h4 key={key} className="font-semibold text-sm mt-2 mb-1">
          {inlineBold(line.slice(4))}
        </h4>
      );
    if (line.startsWith("## "))
      return (
        <h3 key={key} className="font-semibold mt-2 mb-1">
          {inlineBold(line.slice(3))}
        </h3>
      );
    if (line.startsWith("# "))
      return (
        <h3 key={key} className="font-bold mt-2 mb-1">
          {inlineBold(line.slice(2))}
        </h3>
      );
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li key={key} className="ml-4 list-disc">
          {inlineBold(line.slice(2))}
        </li>
      );
    }
    if (/^\d+\.\s/.test(line)) {
      return (
        <li key={key} className="ml-4 list-decimal">
          {inlineBold(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
    }
    return <p key={key}>{inlineBold(line)}</p>;
  });
}
