"use client"

import { DataTable as SharedDataTable, type ColumnDef, type RowData } from "@data-projects/ui"

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData>[]
  data: TData[]
}

export function DataTable<TData extends RowData>({
  columns,
  data,
}: Readonly<DataTableProps<TData>>) {
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
