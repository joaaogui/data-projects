"use client";

import { SortButton } from "@data-projects/ui";
import type { HeaderContext } from "@tanstack/react-table";

/**
 * `SortButton` wants the sort state and a toggle rather than the column object,
 * which makes every header a three-line expression. This packages the wiring so
 * a column definition can just say `header: sortableHeader("Plays")`.
 */
export function sortableHeader<TData, TValue>(label: React.ReactNode) {
  return function SortableHeader({ column }: HeaderContext<TData, TValue>) {
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
