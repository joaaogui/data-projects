/**
 * Shared by the SQL that assigns these labels and the UI that explains them.
 * Kept apart from the analytics modules because those reach for the database
 * on import, and this has to be safe to pull into a client component.
 */
export type Lifecycle = "recent" | "phase" | "abandoned" | "companion" | "casual";

/**
 * Every artist gets exactly one label, from the first rule that matches in this
 * order. The thresholds are judgement calls, not measurements -- they are
 * written down so the numbers on screen can be read against them.
 */
export const LIFECYCLE_RULES: Record<Lifecycle, string> = {
  recent: "First played within the last 12 months",
  phase: "At least half of all plays fell in a single month (min. 20 plays)",
  abandoned: "Not played in over 2 years (min. 20 plays)",
  companion: "Played across 12+ separate months over a span of 3+ years",
  casual: "Everything else",
};

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  recent: "Recent",
  phase: "Phase",
  abandoned: "Abandoned",
  companion: "Companion",
  casual: "Casual",
};

/** Display order: the patterns worth reading first. */
export const LIFECYCLE_ORDER: Lifecycle[] = [
  "companion",
  "phase",
  "recent",
  "abandoned",
  "casual",
];
