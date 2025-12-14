"use client"

import { SortButton, type ColumnDef } from "@data-projects/ui"
import type { CellContext, HeaderContext } from "@tanstack/react-table"
import { SpotifyTrack } from "@/lib/spotify"
import { ExternalLink } from "lucide-react"
import { TrackCover } from "@/components/track-cover"

export const columns: ColumnDef<SpotifyTrack>[] = [
  {
    id: "position",
    accessorKey: "position",
    header: () => <span className="text-muted-foreground">#</span>,
    cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
      <div className="w-8 text-center font-mono text-lg text-muted-foreground">
        {row.index + 1}
      </div>
    ),
  },
  {
    id: "cover",
    header: "",
    cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
      <div className="hidden sm:block">
        <TrackCover
          trackId={row.original.id}
          trackName={row.original.name}
          artistName={row.original.artists[0]?.name || ""}
          imageUrl={row.original.album.images[0]?.url}
          albumName={row.original.album.name}
          spotifyUrl={row.original.external_urls.spotify}
        />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }: HeaderContext<SpotifyTrack, unknown>) => (
      <SortButton
        sorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Track
      </SortButton>
    ),
    cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
      <div className="flex flex-col gap-0.5">
        <a
          href={row.original.external_urls.spotify}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:text-spotify transition-colors group inline-flex items-center gap-1.5"
        >
          {row.original.name}
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
        <span className="text-sm text-muted-foreground">
          {row.original.album.name}
        </span>
      </div>
    ),
  },
  {
    id: "year",
    accessorFn: (row: SpotifyTrack) => row.album.release_date.substring(0, 4),
    header: ({ column }: HeaderContext<SpotifyTrack, unknown>) => (
      <SortButton
        sorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hidden sm:flex"
      >
        <span className="hidden sm:inline">Year</span>
      </SortButton>
    ),
    cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
      <span className="hidden sm:inline text-muted-foreground">
        {row.original.album.release_date.substring(0, 4)}
      </span>
    ),
  },
  {
    accessorKey: "popularity",
    header: ({ column }: HeaderContext<SpotifyTrack, unknown>) => (
      <div className="flex justify-center sm:justify-end">
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Popularity
        </SortButton>
      </div>
    ),
    cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
      const popularity = row.original.popularity
      return (
        <div className="flex items-center justify-center sm:justify-end gap-3">
          <div className="hidden sm:block w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-spotify/70 to-spotify rounded-full transition-all duration-500"
              style={{ width: `${popularity}%` }}
            />
          </div>
          <span className="font-mono font-semibold text-spotify w-8 text-center sm:text-right">
            {popularity}
          </span>
        </div>
      )
    },
  },
]
