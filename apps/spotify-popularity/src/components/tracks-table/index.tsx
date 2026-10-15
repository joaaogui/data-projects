"use client"

import { SpotifyTrack } from "@/lib/spotify"
import { DataTable } from "@data-projects/ui"
import { columns } from "./columns"

interface TracksTableProps {
  tracks: SpotifyTrack[]
}

export function TracksTable({ tracks }: Readonly<TracksTableProps>) {
  return (
    <div className="h-full">
      <DataTable
        columns={columns}
        data={tracks}
        pagination={{
          pageSize: 25,
          showInfo: true,
          itemName: "tracks",
        }}
        emptyMessage="No tracks found."
      />
    </div>
  )
}

