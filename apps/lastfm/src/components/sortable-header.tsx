"use client";

import { SortButton, type HeaderContext, type RowData } from "@data-projects/ui";

/**
 * `SortButton` wants the sort state and a toggle rather than the column object,
 * which makes every header a three-line expression. This packages the wiring so
 * a column definition can just say `header: sortableHeader("Plays")`.
 */
export function sortableHeader<TData extends RowData>(label: React.ReactNode) {
  return function SortableHeader({ column }: HeaderContext<TData>) {
    return (
      <SortButton
        sorted={column.getIsSorted()}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
      </SortButton>
    );
  };
}
