"use client";

import { PageHeader, Section } from "@/components/section";
import { QueryError } from "@/components/query-state";
import { sortableHeader } from "@/components/sortable-header";
import { useLibrary } from "@/hooks/use-stats";
import type {
  LibraryArtistRow,
  LibraryKind,
  LibraryTrackRow,
} from "@/lib/analytics/library";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@data-projects/shared";
import {
  Button,
  DataTable,
  Input,
  Skeleton,
  type ColumnDef,
} from "@data-projects/ui";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TABS: { id: LibraryKind; label: string }[] = [
  { id: "artists", label: "Artists" },
  { id: "tracks", label: "Tracks" },
];

const SEARCH_DEBOUNCE_MS = 300;

export default function LibraryPage() {
  const [kind, setKind] = useState<LibraryKind>("artists");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Search runs server-side so it can reach past the 500-row result window;
  // debouncing keeps a full-table ILIKE off every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, isLoading, isFetching, error } = useLibrary(kind, query);

  const artistColumns = useMemo<ColumnDef<LibraryArtistRow>[]>(
    () => [
      {
        accessorKey: "artist",
        header: sortableHeader("Artist"),
        cell: ({ row }) => (
          <Link
            href={`/artists/${encodeURIComponent(row.original.artist)}`}
            className="font-medium hover:text-data"
          >
            {row.original.artist}
          </Link>
        ),
      },
      {
        accessorKey: "plays",
        header: sortableHeader("Plays"),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.plays)}</span>
        ),
      },
      {
        accessorKey: "tracks",
        header: sortableHeader("Tracks"),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.tracks)}</span>
        ),
      },
      {
        accessorKey: "firstPlayed",
        header: sortableHeader("First"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.firstPlayed)}
          </span>
        ),
      },
      {
        accessorKey: "lastPlayed",
        header: sortableHeader("Last"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.lastPlayed)}
          </span>
        ),
      },
    ],
    []
  );

  const trackColumns = useMemo<ColumnDef<LibraryTrackRow>[]>(
    () => [
      {
        accessorKey: "track",
        header: sortableHeader("Track"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.track}</span>
        ),
      },
      {
        accessorKey: "artist",
        header: sortableHeader("Artist"),
        cell: ({ row }) => (
          <Link
            href={`/artists/${encodeURIComponent(row.original.artist)}`}
            className="text-muted-foreground hover:text-data"
          >
            {row.original.artist}
          </Link>
        ),
      },
      {
        accessorKey: "album",
        header: "Album",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.album ?? "-"}</span>
        ),
      },
      {
        accessorKey: "plays",
        header: sortableHeader("Plays"),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.plays)}</span>
        ),
      },
      {
        accessorKey: "lastPlayed",
        header: sortableHeader("Last"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.lastPlayed)}
          </span>
        ),
      },
    ],
    []
  );

  const showingAll = data ? data.matched <= data.rows.length : true;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Library"
        description="Everything in the database, searchable. Search runs against the full table, not just the rows currently loaded."
      />

      <Section
        title={kind === "artists" ? "Artists" : "Tracks"}
        description={
          data
            ? `${formatNumber(data.matched)} ${data.kind} match${data.matched === 1 ? "es" : ""}${
                showingAll ? "" : ` - showing the top ${formatNumber(data.rows.length)}`
              }`
            : "Loading..."
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setKind(tab.id)}
                  className={cn(
                    "h-7 px-3 text-xs",
                    kind === tab.id && "bg-accent text-accent-foreground"
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Search ${kind}...`}
                aria-label={`Search ${kind}`}
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>
          </div>
        }
      >
        {error ? (
          <QueryError message={error.message} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : (
          <div className={cn(isFetching && "opacity-60 transition-opacity")}>
            {kind === "artists" ? (
              <DataTable
                columns={artistColumns}
                data={(data?.rows ?? []) as LibraryArtistRow[]}
                defaultSorting={[{ id: "plays", desc: true }]}
                pagination={{ pageSize: 50, showInfo: true, itemName: "artists" }}
                emptyMessage="No artists match that search."
              />
            ) : (
              <DataTable
                columns={trackColumns}
                data={(data?.rows ?? []) as LibraryTrackRow[]}
                defaultSorting={[{ id: "plays", desc: true }]}
                pagination={{ pageSize: 50, showInfo: true, itemName: "tracks" }}
                emptyMessage="No tracks match that search."
              />
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
