export type SortDir = "asc" | "desc";

export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

/** A value to sort by; `null` (no value, "—", "neutro") always goes last. */
export type SortValue = number | string | null;

/** Upper bound of "A-B min" / "A min" (minutes); null when the text has no minutes. */
export function commuteUpperBound(text: string): number | null {
  const m = /(\d+)\s*(?:[-–]\s*(\d+))?\s*min/.exec(text);
  return m ? Number(m[2] ?? m[1]) : null;
}

/** Same column toggles the direction; a new column starts at its own default direction. */
export function nextSort<K extends string>(current: SortState<K>, key: K, defaultDir: SortDir): SortState<K> {
  if (current.key === key) return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  return { key, dir: defaultDir };
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
}

/** Sorted copy: missing values last in both directions, ties by `rank` ascending. */
export function sortItems<T, K extends string>(
  items: readonly T[],
  sort: SortState<K>,
  value: (item: T, key: K) => SortValue,
  rank: (item: T) => number,
): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return items
    .map((item) => ({ item, v: value(item, sort.key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) {
        if (a.v !== b.v) return a.v === null ? 1 : -1;
      } else {
        const c = compareValues(a.v, b.v);
        if (c !== 0) return sign * c;
      }
      return rank(a.item) - rank(b.item);
    })
    .map(({ item }) => item);
}
