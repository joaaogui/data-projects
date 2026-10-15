"use client";

import { cn } from "@data-projects/shared";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type CellContext as TanstackCellContext,
  type ColumnDef as TanstackColumnDef,
  type ColumnVisibilityState,
  type FilterFn as TanstackFilterFn,
  type HeaderContext as TanstackHeaderContext,
  type Row as TanstackRow,
  type CellData,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

// The sortFns are the ones v8's "auto" sorting picked from; without them string columns fall back to basic sorting.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime, text: sortFn_text },
});

type Features = typeof features;

export type ColumnDef<TData extends RowData, TValue extends CellData = CellData> = TanstackColumnDef<Features, TData, TValue>;
export type CellContext<TData extends RowData, TValue extends CellData = CellData> = TanstackCellContext<Features, TData, TValue>;
export type HeaderContext<TData extends RowData, TValue extends CellData = CellData> = TanstackHeaderContext<Features, TData, TValue>;
export type FilterFn<TData extends RowData> = TanstackFilterFn<Features, TData>;
export type Row<TData extends RowData> = TanstackRow<Features, TData>;
export type VisibilityState = ColumnVisibilityState;
export type { RowData, SortingState };

export interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  defaultSorting?: SortingState;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  pagination?: {
    pageSize?: number;
    showInfo?: boolean;
    itemName?: string;
  };
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  globalFilterFn?: FilterFn<TData>;
  emptyMessage?: string;
  rowClassName?: (row: Row<TData>, index: number) => string;
  rowStyle?: (row: Row<TData>, index: number) => React.CSSProperties | undefined;
  stickyHeader?: boolean;
  renderExpandedRow?: (row: Row<TData>) => React.ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  getRowAriaLabel?: (row: Row<TData>) => string;
}

interface SortButtonProps {
  children: React.ReactNode;
  sorted: false | "asc" | "desc";
  onClick: () => void;
  className?: string;
}

function SortIcon({ sorted }: Readonly<{ sorted: false | "asc" | "desc" }>) {
  if (sorted === "asc") return <ArrowUp className="ml-2 h-4 w-4" />;
  if (sorted === "desc") return <ArrowDown className="ml-2 h-4 w-4" />;
  return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
}

export function SortButton({ children, sorted, onClick, className }: Readonly<SortButtonProps>) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn("-ml-4 h-8 px-2", className)}
    >
      {children}
      <SortIcon sorted={sorted} />
    </Button>
  );
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  defaultSorting = [],
  columnVisibility: controlledVisibility,
  onColumnVisibilityChange,
  pagination,
  globalFilter,
  onGlobalFilterChange,
  globalFilterFn,
  emptyMessage = "No results found.",
  rowClassName,
  rowStyle,
  stickyHeader = true,
  renderExpandedRow,
  onRowClick,
  getRowAriaLabel,
}: Readonly<DataTableProps<TData>>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSorting);
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const [internalVisibility, setInternalVisibility] = React.useState<VisibilityState>({});

  const columnVisibility = controlledVisibility ?? internalVisibility;
  const handleVisibilityChange: React.Dispatch<React.SetStateAction<VisibilityState>> = (updater) => {
    const next = typeof updater === "function" ? updater(columnVisibility) : updater;
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(next);
    } else {
      setInternalVisibility(next);
    }
  };

  const table = useTable({
    features,
    data,
    columns,
    manualPagination: !pagination,
    onSortingChange: setSorting,
    onColumnVisibilityChange: handleVisibilityChange,
    onGlobalFilterChange,
    globalFilterFn,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
    },
    ...(pagination && {
      initialState: {
        pagination: {
          pageIndex: 0,
          pageSize: pagination.pageSize ?? 25,
        },
      },
    }),
  });

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const hasPagination = pagination && filteredRowCount > (pagination.pageSize ?? 25);

  function getRowClickHandler(row: Row<TData>) {
    if (onRowClick) return () => onRowClick(row);
    if (renderExpandedRow) return () => setExpandedRowId(prev => prev === row.id ? null : row.id);
    return undefined;
  }

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
              table.getRowModel().rows.map((row, index) => {
                const isExpanded = renderExpandedRow && expandedRowId === row.id;
                const rowClickHandler = getRowClickHandler(row);
                const isInteractive = !!rowClickHandler;
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={cn(
                        "border-border/30 transition-colors hover:bg-muted/30",
                        (renderExpandedRow || onRowClick) && "cursor-pointer",
                        isExpanded && "bg-muted/40",
                        rowClassName?.(row, index)
                      )}
                      style={{
                        animationDelay: `${index * 20}ms`,
                        ...rowStyle?.(row, index),
                      }}
                      onClick={rowClickHandler}
                      tabIndex={isInteractive ? 0 : undefined}
                      aria-label={isInteractive ? getRowAriaLabel?.(row) : undefined}
                      aria-expanded={renderExpandedRow ? !!isExpanded : undefined}
                      onKeyDown={
                        isInteractive
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                rowClickHandler();
                              }
                            }
                          : undefined
                      }
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
                    {isExpanded && (
                      <TableRow className="border-border/30 bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                          {renderExpandedRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
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
            <p className="hidden sm:block text-sm text-muted-foreground">
              Showing {table.state.pagination.pageIndex * table.state.pagination.pageSize + 1} to{" "}
              {Math.min(
                (table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
                filteredRowCount
              )}{" "}
              of {filteredRowCount} {pagination?.itemName ?? "items"}
              {globalFilter && filteredRowCount !== data.length && (
                <span className="text-muted-foreground/70"> (filtered from {data.length})</span>
              )}
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
