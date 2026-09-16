import "server-only";

import { unstable_cache } from "next/cache";

import { getAnalysisContext, PLAYER_TAG } from "./clash-royale";
import { runDeckEngine } from "./deck-engine";
import { buildEngineContext, type AnalysisMode } from "./engine-context";
import { getLevelWarnings } from "./level-warnings";
import type { AnalysisResponse } from "./types";

const ANALYSIS_CACHE_SECONDS = 30 * 60;

export async function generateDeckAnalysis(
  mode: AnalysisMode = "improve",
): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const context = await getAnalysisContext();
  const engine = buildEngineContext(context, mode);
  const { analysis, diagnostics } = await runDeckEngine(engine);

  console.info("[clash-deck-advisor] generated analysis", {
    mode,
    durationMs: Date.now() - startedAt,
    recentLossCount: context.recentLosses.length,
    metaDeckCount: context.metaDecks.length,
    ...diagnostics,
  });

  return {
    analysis,
    player: context.player,
    levelWarnings: getLevelWarnings(context.player.currentDeck),
    generatedAt: new Date().toISOString(),
    metaAvailable: context.metaAvailable,
    mode,
  };
}

const cachedByMode: Record<
  AnalysisMode,
  () => Promise<AnalysisResponse>
> = {
  improve: unstable_cache(
    () => generateDeckAnalysis("improve"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v4", "improve"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: ["clash-deck-advisor-analysis"] },
  ),
  best: unstable_cache(
    () => generateDeckAnalysis("best"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v4", "best"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: ["clash-deck-advisor-analysis"] },
  ),
};

export function getCachedDeckAnalysis(
  mode: AnalysisMode = "improve",
): Promise<AnalysisResponse> {
  return cachedByMode[mode]();
}
