"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DataTable,
  SortButton,
  Button,
  type ColumnDef,
  type Row,
} from "@data-projects/ui";
import { EpisodeDialog } from "@/components/episode-dialog";
import { Info, Trophy, Star } from "lucide-react";
import type { RankedSeason } from "@/types/omdb";

interface SeasonsTableProps {
  seasons: RankedSeason[];
}

interface TableMeta {
  seasons: RankedSeason[];
  onViewEpisodes: (season: RankedSeason) => void;
}

function createColumns(meta: TableMeta): ColumnDef<RankedSeason>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      cell: ({ row }) => {
        const seasonNumber = row.original.seasonNumber;
        const originalIndex = meta.seasons.findIndex((s) => s.seasonNumber === seasonNumber);
        const isFirst = originalIndex === 0;
        return (
          <div className="flex items-center gap-2">
            {isFirst ? (
              <Trophy className="h-5 w-5 text-gold fill-gold" />
            ) : (
              <span className="w-5 text-center text-muted-foreground font-mono">
                {originalIndex + 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "seasonNumber",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Season
        </SortButton>
      ),
      cell: ({ row }) => (
        <span data-testid={`season-number-${row.original.seasonNumber}`} className="font-semibold">
          Season {row.original.seasonNumber}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Rating
        </SortButton>
      ),
      cell: ({ row }) => {
        const { rating, seasonNumber } = row.original;
        const originalIndex = meta.seasons.findIndex((s) => s.seasonNumber === seasonNumber);
        const isFirst = originalIndex === 0;
        return (
          <div className="flex items-center gap-2">
            <Star
              className={`h-4 w-4 ${
                isFirst ? "text-gold fill-gold" : "text-muted-foreground"
              }`}
            />
            <span data-testid={`season-rating-${seasonNumber}`} className={`font-mono ${isFirst ? "text-gold font-bold" : ""}`}>
              {rating.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      id: "episodes",
      accessorFn: (row) => row.episodes.length,
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Episodes
        </SortButton>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.episodes.length} episodes</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => meta.onViewEpisodes(row.original)}
          className="hover:bg-muted"
        >
          <Info className="h-4 w-4" />
          <span className="sr-only">View episodes</span>
        </Button>
      ),
    },
  ];
}

export function SeasonsTable({ seasons }: Readonly<SeasonsTableProps>) {
  const [selectedSeason, setSelectedSeason] = useState<RankedSeason | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewEpisodes = useCallback((season: RankedSeason) => {
    setSelectedSeason(season);
    setDialogOpen(true);
  }, []);

  const tableMeta: TableMeta = useMemo(
    () => ({
      seasons,
      onViewEpisodes: handleViewEpisodes,
    }),
    [seasons, handleViewEpisodes]
  );

  const columns = useMemo(() => createColumns(tableMeta), [tableMeta]);

  const getRowClassName = useCallback((row: Row<RankedSeason>) => {
    const originalIndex = seasons.findIndex(
      (s) => s.seasonNumber === row.original.seasonNumber
    );
    const isFirst = originalIndex === 0;
    return isFirst
      ? "bg-gold/5 hover:bg-gold/10 border-l-2 border-l-gold"
      : "";
  }, [seasons]);

  if (seasons.length === 0) {
    return <div data-testid="seasons-table-empty">No seasons found</div>;
  }

  return (
    <>
      <div data-testid="seasons-table" className="h-full">
        <DataTable
          columns={columns}
          data={seasons}
          emptyMessage="No seasons found"
          rowClassName={getRowClassName}
        />
      </div>

      {selectedSeason && (
        <EpisodeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          seasonNumber={selectedSeason.seasonNumber}
          episodes={selectedSeason.episodes}
        />
      )}
    </>
  );
}
