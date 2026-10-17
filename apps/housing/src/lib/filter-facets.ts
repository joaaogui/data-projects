import { describeActiveFilters, type FilterPatch, type FilterState } from "@/lib/filter-state";
import type { FilterOption } from "@/lib/filter-options";
import {
  buildFilterConstraints,
  type FilterConstraint,
  type PropertyExplorerFilters,
} from "@/lib/property-filters";
import type { EvaluatedProperty } from "@/types/housing";

export interface Relaxation {
  group: string;
  label: string;
  /** Applying it removes this filter. */
  patch: FilterPatch;
  /** Result count once applied (the current count is 0). */
  count: number;
}

function toExplorer(state: FilterState, favorites: string[]): PropertyExplorerFilters {
  return {
    ...state,
    selectedCity: state.selectedCities.length === 1 ? state.selectedCities[0]! : "ALL",
    favoriteKeys: favorites,
  };
}

/**
 * One pass over the listings records, per listing, how many constraints it fails and which one first:
 * a listing with exactly one failure is what dropping that constraint (or replacing its value) can add.
 */
export class FacetIndex {
  readonly constraints: FilterConstraint[];
  readonly total: number;
  private readonly nearMatches: EvaluatedProperty[] = [];
  private readonly nearFail: number[] = [];

  constructor(
    properties: EvaluatedProperty[],
    private readonly state: FilterState,
    private readonly favorites: string[],
  ) {
    this.constraints = buildFilterConstraints(toExplorer(state, favorites), favorites);
    let total = 0;
    for (const p of properties) {
      let fails = 0;
      let first = -1;
      for (let i = 0; i < this.constraints.length; i++) {
        if (!this.constraints[i]!.test(p)) {
          fails += 1;
          if (fails > 1) break;
          first = i;
        }
      }
      if (fails === 0) total += 1;
      if (fails <= 1) {
        this.nearMatches.push(p);
        this.nearFail.push(first);
      }
    }
    this.total = total;
  }

  /** Count with `group` replaced by `test` (standard facet semantics: every other filter applied). */
  private countReplacing(group: string, test: ((p: EvaluatedProperty) => boolean) | null): number {
    const idx = this.constraints.findIndex((c) => c.id === group);
    if (idx === 0) return 0;
    let n = 0;
    for (let i = 0; i < this.nearMatches.length; i++) {
      const fail = this.nearFail[i]!;
      if (fail !== -1 && fail !== idx) continue;
      if (test === null || test(this.nearMatches[i]!)) n += 1;
    }
    return n;
  }

  optionCount(option: FilterOption): number {
    const selected = { ...this.state, ...option.select(this.state) };
    const replacement = buildFilterConstraints(toExplorer(selected, this.favorites), this.favorites).find(
      (c) => c.id === option.group,
    );
    return this.countReplacing(option.group, replacement?.test ?? null);
  }

  optionCounts(options: FilterOption[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const opt of options) out[opt.id] = this.optionCount(opt);
    return out;
  }

  /** Approximate gain of dropping each relaxable constraint (the pool constraint is never relaxed). */
  relaxationGains(): Array<{ group: string; gain: number }> {
    const gains = new Map<string, number>();
    for (let i = 0; i < this.nearMatches.length; i++) {
      const fail = this.nearFail[i]!;
      if (fail <= 0) continue;
      const id = this.constraints[fail]!.id;
      gains.set(id, (gains.get(id) ?? 0) + 1);
    }
    return [...gains.entries()].map(([group, gain]) => ({ group, gain }));
  }
}

/**
 * Top single-filter relaxations for an empty result: ranked by the one-pass estimate, then counted exactly
 * (eligibility overrides couple a few filters, so the estimate can differ from the real count).
 */
export function suggestRelaxations(
  properties: EvaluatedProperty[],
  state: FilterState,
  favorites: string[],
  limit = 3,
  index = new FacetIndex(properties, state, favorites),
): Relaxation[] {
  const pills = describeActiveFilters(state);
  const candidates = index
    .relaxationGains()
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit + 2);
  const out: Relaxation[] = [];
  for (const { group } of candidates) {
    const groupPills = pills.filter((p) => p.group === group);
    if (groupPills.length === 0) continue;
    const patch = Object.assign({}, ...groupPills.map((p) => p.clear)) as FilterPatch;
    if (group === "cities") patch.selectedCities = [];
    if (group === "floor") Object.assign(patch, { floorFilters: [], floorFilter: "ALL" });
    if (group === "furniture") Object.assign(patch, { selectedFurnitureTiers: [], furnishedFilter: "ALL" });
    if (group === "modernity") patch.modernityTiers = [];
    if (group === "neighborhoods") patch.selectedNeighborhoods = [];
    const relaxed = { ...state, ...patch };
    const count = new FacetIndex(properties, relaxed, favorites).total;
    if (count === 0) continue;
    const label =
      groupPills.length === 1 ? groupPills[0]!.label : groupPills.map((p) => p.label).join(" / ");
    out.push({ group, label, patch, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}
