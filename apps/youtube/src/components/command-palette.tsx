"use client";

import {
  BookOpen,
  Calendar,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  Search,
  Sparkles,
  TableProperties,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CommandPaletteProps {
  onNavigate: (tab: "overview" | "videos" | "timeline" | "sagas") => void;
  onSyncVideos: () => void;
  onSyncTranscripts: () => void;
}

interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ onNavigate, onSyncVideos, onSyncTranscripts }: Readonly<CommandPaletteProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const commands: Command[] = [
    { id: "nav-overview", label: "Overview", icon: LayoutDashboard, group: "Navigation", action: () => { onNavigate("overview"); close(); } },
    { id: "nav-videos", label: "Videos", icon: TableProperties, group: "Navigation", action: () => { onNavigate("videos"); close(); } },
    { id: "nav-timeline", label: "Timeline", icon: Calendar, group: "Navigation", action: () => { onNavigate("timeline"); close(); } },
    { id: "nav-sagas", label: "Sagas", icon: BookOpen, group: "Navigation", action: () => { onNavigate("sagas"); close(); } },
    { id: "tool-ai", label: "Ask AI", icon: Sparkles, group: "Tools", shortcut: "⌘J" },
    { id: "tool-export", label: "Export CSV", icon: Download, group: "Tools" },
    { id: "tool-search", label: "Search Videos", icon: Search, group: "Tools", shortcut: "/" },
    { id: "sync-videos", label: "Sync Videos", icon: Database, group: "Sync", action: () => { onSyncVideos(); close(); } },
    { id: "sync-transcripts", label: "Sync Transcripts", icon: FileText, group: "Sync", action: () => { onSyncTranscripts(); close(); } },
  ].map((cmd) => ({
    ...cmd,
    action: cmd.action ?? close,
  }));

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    if (localStorage.getItem("youtube-cmdk-seen")) return;

    setShowHint(true);
    const timer = setTimeout(() => {
      setShowHint(false);
      localStorage.setItem("youtube-cmdk-seen", "1");
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[activeIndex]?.action();
      } else if (e.key === "Escape") {
        close();
      }
    },
    [filtered, activeIndex, close],
  );

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open && !showHint) return null;

  let flatIndex = -1;

  return (
    <>
      {open && (
        <div role="presentation" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={close} onKeyDown={handleKeyDown}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="mx-auto mt-[20vh] max-w-lg rounded-2xl border border-border/40 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found.</p>
              )}

              {Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">{group}</p>
                  {items.map((cmd) => {
                    flatIndex++;
                    const isActive = flatIndex === activeIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        data-active={isActive}
                        onClick={cmd.action}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-muted" : "hover:bg-muted/60"
                          }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-left">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showHint && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 rounded-full border border-border/40 bg-card px-4 py-2 text-sm shadow-lg">
            <span className="text-muted-foreground">Press</span>
            <kbd className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
            <span className="text-muted-foreground">to explore all features</span>
          </div>
        </div>
      )}
    </>
  );
}
