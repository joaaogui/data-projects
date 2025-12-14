"use client"

import { DataTable as SharedDataTable, type ColumnDef } from "@data-projects/ui"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: Readonly<DataTableProps<TData, TValue>>) {
  return (
    <SharedDataTable
      columns={columns}
      data={data}
      pagination={{
        pageSize: 25,
        showInfo: true,
        itemName: "tracks",
      }}
      emptyMessage="No tracks found."
    />
  )
}
