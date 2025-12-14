"use client"

import { SpotifyTrack } from "@/lib/spotify"
import { DataTable } from "./data-table"
import { columns } from "./columns"

interface TracksTableProps {
  tracks: SpotifyTrack[]
}

export function TracksTable({ tracks }: Readonly<TracksTableProps>) {
  return (
    <div className="h-full">
      <DataTable columns={columns} data={tracks} />
    </div>
  )
}

