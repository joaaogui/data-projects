"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type TableMeta,
  type Row,
} from "@tanstack/react-table";
import { cn } from "@data-projects/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta?: TableMeta<TData>;
  defaultSorting?: SortingState;
  pagination?: {
    pageSize?: number;
    showInfo?: boolean;
    itemName?: string;
  };
  emptyMessage?: string;
  rowClassName?: (row: Row<TData>, index: number) => string;
  stickyHeader?: boolean;
}

interface SortButtonProps {
  children: React.ReactNode;
  sorted: false | "asc" | "desc";
  onClick: () => void;
  className?: string;
}

export function SortButton({ children, sorted, onClick, className }: Readonly<SortButtonProps>) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn("-ml-4 h-8 px-2", className)}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  meta,
  defaultSorting = [],
  pagination,
  emptyMessage = "No results found.",
  rowClassName,
  stickyHeader = true,
}: Readonly<DataTableProps<TData, TValue>>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);

  const table = useReactTable({
    data,
    columns,
    meta,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagination && { getPaginationRowModel: getPaginationRowModel() }),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    ...(pagination && {
      initialState: {
        pagination: {
          pageSize: pagination.pageSize ?? 25,
        },
      },
    }),
  });

  const hasPagination = pagination && data.length > (pagination.pageSize ?? 25);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-auto">
        <Table noWrapper>
          <TableHeader className={cn(stickyHeader && "sticky top-0 bg-card/95 backdrop-blur-sm z-10")}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border/50 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id} 
                    className={cn(
                      "text-xs uppercase tracking-wider",
                      stickyHeader && "bg-card/95 backdrop-blur-sm"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "border-border/30 transition-colors hover:bg-muted/30",
                    rowClassName?.(row, index)
                  )}
                  style={{
                    animationDelay: `${index * 20}ms`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {hasPagination && (
        <div className="flex-shrink-0 flex items-center justify-between px-2 py-4">
          {pagination?.showInfo !== false && (
            <p className="text-sm text-muted-foreground">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                data.length
              )}{" "}
              of {data.length} {pagination?.itemName ?? "items"}
            </p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border-border/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border-border/50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { type ColumnDef, type SortingState, type TableMeta, type Row } from "@tanstack/react-table";

