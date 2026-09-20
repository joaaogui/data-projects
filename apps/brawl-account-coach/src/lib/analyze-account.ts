import "server-only";

import { generateObject } from "ai";
import { unstable_cache } from "next/cache";

import {
  getAiProviderOptions,
  instantiateModel,
  runWithAiFallback,
} from "./ai-provider";
import { getAnalysisContext, PLAYER_TAG } from "./brawl-stars";
import { validateRecommendations } from "./recommendation-validation";
import { accountCoachSchema } from "./schemas";
import type { AnalysisResponse } from "./types";

const ANALYSIS_CACHE_SECONDS = 30 * 60;

async function generateAccountAnalysis(): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const context = await getAnalysisContext();
  const catalogById = new Map(
    context.catalog.map((brawler) => [brawler.id, brawler]),
  );

  const roster = context.player.brawlers.map((brawler) => {
    const catalogBrawler = catalogById.get(brawler.id);
    return {
      id: brawler.id,
      name: brawler.name,
      power: brawler.power,
      rank: brawler.rank,
      trophies: brawler.trophies,
      highestTrophies: brawler.highestTrophies,
      currentWinStreak: brawler.currentWinStreak ?? 0,
      ownedBuild: {
        gadgets: brawler.gadgets.map((item) => item.name),
        starPowers: brawler.starPowers.map((item) => item.name),
        gears: brawler.gears.map((item) => item.name),
        hyperCharges: brawler.hyperCharges.map((item) => item.name),
      },
      availableBuild: {
        gadgets: catalogBrawler?.gadgets.map((item) => item.name) ?? [],
        starPowers:
          catalogBrawler?.starPowers.map((item) => item.name) ?? [],
        gears: catalogBrawler?.gears.map((item) => item.name) ?? [],
        hyperCharges:
          catalogBrawler?.hyperCharges.map((item) => item.name) ?? [],
      },
    };
  });

  const generated = await runWithAiFallback(
    async (config) => {
      const { object } = await generateObject({
        model: instantiateModel(config),
        providerOptions: getAiProviderOptions(config),
        schema: accountCoachSchema,
        schemaName: "brawlAccountCoach",
        schemaDescription:
          "Evidence-based account coaching for one fixed Brawl Stars player.",
        temperature: 0.2,
        maxOutputTokens: 4_500,
        maxRetries: 1,
        system: [
          "You are a precise Brawl Stars account progression coach.",
          "Return one structured account analysis grounded only in the supplied live profile, catalog, deterministic metrics, owned build items, and recent battles.",
          "Use exact brawler and item names from the supplied data. Never invent a brawler, gadget, Star Power, gear, or Hypercharge.",
          "Recommend only brawlers in the owned roster. Build advice may contain only items listed under that brawler's ownedBuild; use null or an empty gears array when no justified owned option exists.",
          "Return zero to five upgrade priorities. Fewer is better when evidence does not justify five. Copy currentPower and currentTrophies exactly from the roster.",
          "Prioritize account-wide value: under-pushed high-power brawlers, complete owned builds, power breakpoints, and concentrated resource use.",
          "Push target current trophies must match the roster and target trophies must be higher but realistic.",
          "Ground battle diagnosis in recentBattles. Do not claim a matchup, mode, map, or result that is absent from that evidence.",
          "Avoid-for-now entries must explain why spending now has lower account value.",
          "Finish with exactly three concrete, ordered action steps.",
        ].join("\n"),
        prompt: JSON.stringify({
          player: {
            tag: context.player.tag,
            name: context.player.name,
            trophies: context.player.trophies,
            highestTrophies: context.player.highestTrophies,
            victories: {
              threeVsThree: context.player["3vs3Victories"],
              solo: context.player.soloVictories,
              duo: context.player.duoVictories,
            },
          },
          catalogBrawlerNames: context.catalog.map(
            (brawler) => brawler.name,
          ),
          metrics: context.metrics,
          roster,
          recentBattles: context.metrics.recentBattles,
        }),
      });

      return {
        analysis: validateRecommendations(
          object,
          context.player,
          context.catalog,
        ),
        provider: config.provider,
        model: config.label,
      };
    },
    undefined,
    (failure) => {
      console.warn("[brawl-account-coach] AI attempt failed", {
        ...failure,
        durationMs: Date.now() - startedAt,
      });
    },
  );

  const { analysis } = generated;

  const response: AnalysisResponse = {
    analysis,
    player: context.player,
    metrics: context.metrics,
    generatedAt: new Date().toISOString(),
  };

  console.info("[brawl-account-coach] generated account analysis", {
    durationMs: Date.now() - startedAt,
    provider: generated.provider,
    model: generated.model,
    priorities: analysis.upgradePriorities.length,
    pushTargets: analysis.pushTargets.length,
    builds: analysis.buildAdvice.length,
  });

  return response;
}

export const getCachedAccountAnalysis = unstable_cache(
  generateAccountAnalysis,
  ["brawl-account-coach", PLAYER_TAG, "analysis-v3"],
  {
    revalidate: ANALYSIS_CACHE_SECONDS,
    tags: ["brawl-account-coach-analysis"],
  },
);
