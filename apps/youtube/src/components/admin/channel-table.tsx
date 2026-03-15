"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Button,
  Input,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Skeleton,
} from "@data-projects/ui";
import {
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Play,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ChannelRow, CleanupAction } from "@/types/admin";
import { healthColor, pct } from "./shared";

type SortField = "title" | "videos" | "transcripts" | "health" | "sagas";

function compareChannels(a: ChannelRow, b: ChannelRow, field: SortField, dir: "asc" | "desc") {
  const m = dir === "asc" ? 1 : -1;
  switch (field) {
    case "title":
      return m * a.title.localeCompare(b.title);
    case "videos":
      return m * (Number(a.video_count) - Number(b.video_count));
    case "transcripts":
      return m * (Number(a.transcript_count) - Number(b.transcript_count));
    case "health":
      return m * (pct(Number(a.transcript_count), Number(a.video_count)) - pct(Number(b.transcript_count), Number(b.video_count)));
    case "sagas":
      return m * (Number(a.playlist_sagas) + Number(a.ai_sagas) - (Number(b.playlist_sagas) + Number(b.ai_sagas)));
    default:
      return 0;
  }
}

function SortableHead({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: Readonly<{
  label: string;
  field: SortField;
  current: SortField;
  dir: "asc" | "desc";
  onSort: (field: SortField) => void;
  className?: string;
}>) {
  const active = current === field;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground transition-colors ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );
}

function ChannelActionMenu({
  channel,
  onAction,
  actionLoading,
}: Readonly<{
  channel: ChannelRow;
  onAction: (action: CleanupAction, channelId: string, label: string) => void;
  actionLoading: string | null;
}>) {
  const [open, setOpen] = useState(false);

  const actions: Array<{ action: CleanupAction; label: string; destructive: boolean }> = [
    { action: "delete-transcripts", label: "Delete transcripts", destructive: false },
    { action: "delete-ai-sagas", label: "Delete AI sagas", destructive: false },
    { action: "delete-sagas", label: "Delete all sagas", destructive: false },
    { action: "delete-videos", label: "Delete videos", destructive: true },
    { action: "delete-channel", label: "Delete channel", destructive: true },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        {actions.map((a, i) => (
          <div key={a.action}>
            {i === 3 && <div className="my-1 border-t border-border" />}
            <button
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                a.destructive
                  ? "text-destructive hover:bg-destructive/10"
                  : "hover:bg-accent"
              }`}
              disabled={actionLoading === `${a.action}-${channel.id}`}
              onClick={() => {
                setOpen(false);
                onAction(a.action, channel.id, a.label);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {a.label}
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export interface ChannelTableProps {
  channels: ChannelRow[];
  loading: boolean;
  actionLoading: string | null;
  onChannelCleanup: (action: CleanupAction, channelId: string, label: string) => void;
  onTriggerSync: (channelId: string, type: "videos" | "transcripts") => void;
  onBulkSync: (type: "videos" | "transcripts", channelIds: string[]) => void;
  onBulkCleanup: (action: CleanupAction, channelIds: string[]) => void;
  onRequestConfirm: (title: string, description: string, destructive: boolean, onConfirm: () => void) => void;
}

export function ChannelTable({
  channels,
  loading,
  actionLoading,
  onChannelCleanup,
  onTriggerSync,
  onBulkSync,
  onBulkCleanup,
  onRequestConfirm,
}: Readonly<ChannelTableProps>) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredChannels = useMemo(() => {
    let result = channels;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => compareChannels(a, b, sortField, sortDir));
  }, [channels, search, sortField, sortDir]);

  const isAllSelected =
    filteredChannels.length > 0 && selectedIds.size === filteredChannels.length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              isAllSelected
                ? setSelectedIds(new Set())
                : setSelectedIds(new Set(filteredChannels.map((c) => c.id)))
            }
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              {["a", "b", "c", "d", "e"].map((key) => (
                <Skeleton key={key} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <SortableHead label="Channel" field="title" current={sortField} dir={sortDir} onSort={handleSort} />
                      <SortableHead label="Videos" field="videos" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHead label="Transcripts" field="transcripts" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHead label="Health" field="health" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                      <SortableHead label="Sagas" field="sagas" current={sortField} dir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead>Sync</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChannels.map((ch) => {
                      const videoCount = Number(ch.video_count);
                      const transcriptCount = Number(ch.transcript_count);
                      const health = pct(transcriptCount, videoCount);
                      const totalSagas = Number(ch.playlist_sagas) + Number(ch.ai_sagas);
                      const isSelected = selectedIds.has(ch.id);

                      return (
                        <TableRow key={ch.id} className={isSelected ? "bg-primary/5" : ""}>
                          <TableCell className="pr-0">
                            <button
                              className="flex items-center justify-center h-8 w-8 rounded hover:bg-accent transition-colors"
                              onClick={() => toggleSelect(ch.id)}
                            >
                              <div
                                className={`h-4 w-4 rounded border-2 transition-colors flex items-center justify-center ${
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                }`}
                              >
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Link href={`/channel/${ch.id}`} className="font-medium hover:text-primary transition-colors">
                              {ch.title}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{ch.id}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{videoCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{transcriptCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${healthColor(health)}`}
                                  style={{ width: `${health}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{health}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{totalSagas}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onTriggerSync(ch.id, "videos")}>
                                <Play className="h-3 w-3 mr-1" />Videos
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onTriggerSync(ch.id, "transcripts")}>
                                <Play className="h-3 w-3 mr-1" />Transcripts
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChannelActionMenu channel={ch} onAction={onChannelCleanup} actionLoading={actionLoading} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredChannels.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                          {search ? "No channels match your search" : "No channels in database"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border bg-card/95 backdrop-blur-sm px-5 py-3 shadow-xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="outline" onClick={() => onBulkSync("videos", Array.from(selectedIds))}>
            <Play className="h-3 w-3 mr-1" />Sync Videos
          </Button>
          <Button size="sm" variant="outline" onClick={() => onBulkSync("transcripts", Array.from(selectedIds))}>
            <Play className="h-3 w-3 mr-1" />Sync Transcripts
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onRequestConfirm(
                "Delete transcripts",
                `Delete all transcripts for ${selectedIds.size} selected channel(s)?`,
                true,
                () => { onBulkCleanup("delete-transcripts", Array.from(selectedIds)); setSelectedIds(new Set()); },
              )
            }
          >
            <Trash2 className="h-3 w-3 mr-1" />Del Transcripts
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              onRequestConfirm(
                "Delete channels",
                `Permanently delete ${selectedIds.size} selected channel(s) and all their data?`,
                true,
                () => { onBulkCleanup("delete-channel", Array.from(selectedIds)); setSelectedIds(new Set()); },
              )
            }
          >
            <Trash2 className="h-3 w-3 mr-1" />Delete
          </Button>
          <button
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
