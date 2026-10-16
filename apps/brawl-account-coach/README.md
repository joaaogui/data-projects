# Brawl Account Coach

Personal tool for the owner’s own Brawl Stars account. It answers: given the
current roster, owned build items, and recent battles, what should be upgraded
or pushed next, which owned loadout pieces to use, what recent results say,
and where spending resources now has low account value.

## How it works

1. **Fetch live account data.** `src/lib/brawl-stars.ts` calls the Brawl Stars
   API through `https://bsproxy.royaleapi.dev/v1` for the single configured
   player, the recent battle log, and the full brawler catalog. Responses are
   revalidated every 30 minutes.
2. **Compute deterministic metrics.** `src/lib/account-metrics.ts`
   (`deriveAccountMetrics`) derives roster completion, power distribution,
   trophy efficiency (current vs. peak, average, median), under-pushed brawlers
   (Power ≥ 9 with ≥ 150 trophies below peak), per-brawler recent battle
   summaries, and overall and per-mode recent trends (win rate, net trophies).
3. **Generate and validate AI analysis.** `src/lib/analyze-account.ts` builds a
   roster payload pairing each owned brawler’s owned build items with the
   catalog’s available items, plus the deterministic metrics and recent battles,
   and asks a model for a structured analysis (`accountCoachSchema`).
   `src/lib/recommendation-validation.ts` then checks the result against the
   live roster and catalog (see “Deterministic vs AI split”). Analyses are
   cached for 30 minutes (`unstable_cache`, tag `brawl-account-coach-analysis`);
   `refresh=1` bypasses the cache subject to a stricter rate limit.
4. **Render the dashboard.** `src/app/page.tsx` renders `AccountDashboard`,
   which fetches `GET /api/analysis` (or `POST` when the owner has pinned or
   excluded brawlers, or is forcing a refresh) and displays the status strip,
   progression card, upgrade priorities, push targets, build advice, battle
   diagnosis, and a three-step action plan.

Progression is tracked in the browser only. Each loaded analysis is recorded as
a snapshot in a `localStorage` ledger (`brawl-account-coach:progression-ledger:v1`,
maximum 30 snapshots; snapshots inside a 15-minute dedupe window or with
identical state are merged). `src/lib/progression-store.ts` compares the
current snapshot with the most recent stored snapshot whose state differs, to report trophy deltas, unlocked and upgraded brawlers, per-brawler trophy gains, and how many followed earlier recommendations. Pinned (“focus”) and excluded (“hide”)
brawler rules are stored in the same ledger (up to 12 pinned, 30 excluded).

## Deterministic vs AI split

The model is asked to decide (bounded by `accountCoachSchema` in
`src/lib/schemas.ts`):

- A 0–100 account health score and verdict.
- Zero to five upgrade priorities, zero to five push targets, and up to five
  build-advice entries.
- Up to six battle-diagnosis entries and up to five “avoid for now” entries.
- Exactly three ordered action steps, with reasons for each recommendation.

Local code guarantees, independently of the model:

- All metric math (`deriveAccountMetrics`); the model receives these values
  rather than computing them.
- Every recommended brawler is in the owned roster and in the catalog.
- `currentPower` and `currentTrophies` copied exactly from the live roster;
  a push target must exceed the brawler’s current trophies.
- Build advice contains only items that brawler already owns (gadget, Star
  Power, up to two gears, Hypercharge), checked against both the catalog and
  the owned lists; otherwise the field must be `null` / empty.
- No duplicate brawlers within upgrade priorities, push targets, build advice,
  or the avoid list.
- Pinned brawlers are boosted (or synthesized from owned data) and excluded
  brawlers are removed by `applyBrawlerPreferences`, after validation.
- Invalid structured output or a validation violation fails the attempt and
  advances the provider fallback chain (see below).

The provider chain lives in the shared module `@data-projects/shared/ai-provider`:
Gemini `gemini-3.5-flash-lite` → Groq `openai/gpt-oss-120b` → Gemini
`gemini-3.6-flash`. Only providers with a configured key are included; if none
is configured the analysis route returns `503 CONFIGURATION_MISSING`.

## Running locally

From the repository root:

```bash
pnpm install
pnpm --filter brawl-account-coach dev
```

The app runs at `http://localhost:3013` (dev and start use port 3013).
Set the environment variables below in `apps/brawl-account-coach/.env.local`
(copied from `.env.example`) before starting. `GET /api/health` reports
`ready` or `needs_configuration` and which variables are present, without
exposing values.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `BRAWL_STARS_API_KEY` | Yes | Bearer token for the Brawl Stars API proxy; all player, battle-log, and catalog requests fail without it. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | One of the two AI keys | Enables the Gemini models in the provider fallback chain. |
| `GROQ_API_KEY` | One of the two AI keys | Enables the Groq model in the provider fallback chain. |

## Scripts

Run from the repository root with `pnpm --filter brawl-account-coach <script>`.

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `next dev --turbopack -p 3013` | Development server on port 3013. |
| `build` | `next build` | Production build. |
| `start` | `next start -p 3013` | Serve the production build on port 3013. |
| `lint` | `eslint .` | ESLint over the app. |
| `typecheck` | `tsc --noEmit` | TypeScript check without emitting output. |
| `test` | `vitest run` | Run the test suite once. |
| `test:watch` | `vitest` | Run the test suite in watch mode. |

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/page.tsx` | Single page; renders `AccountDashboard`. |
| `src/app/api/analysis/route.ts` | `GET`/`POST` analysis endpoint (`maxDuration` 300 s, in-memory rate limits: 15 analyses / 5 min, 4 refreshes / 10 min). Accepts `refresh`, `pinnedBrawlers`, and `excludedBrawlers`. |
| `src/app/api/health/route.ts` | `GET` readiness and configuration-presence check. |
| `src/components/account-dashboard.tsx` | Client dashboard: loads analysis, maintains the progression ledger, and applies pin/exclude rules. |
| `src/lib/brawl-stars.ts` | Brawl Stars API client (proxy base URL, the configured account, typed upstream errors). |
| `src/lib/account-metrics.ts` | `deriveAccountMetrics`: deterministic roster, trophy, and recent-battle metrics. |
| `src/lib/analyze-account.ts` | AI orchestration: prompt construction, generation, validation, and the 30-minute analysis cache. |
| `src/lib/schemas.ts` | Zod schemas for the AI output (`accountCoachSchema`) and player preferences. |
| `src/lib/types.ts` | TypeScript types for upstream payloads, derived metrics, and `AnalysisResponse`. |
| `src/lib/recommendation-validation.ts` | Grounds AI recommendations against the owned roster and catalog; applies pin/exclude preferences. |
| `src/lib/progression-store.ts` | Browser `localStorage` progression ledger, snapshot diffing, and progression summaries. |
| `src/lib/rate-limit.ts` | Re-exports `createRateLimiter` and `getClientIp` from `@data-projects/shared`. |
| `src/lib/ai-provider.ts` | Re-exports the provider fallback chain from `@data-projects/shared/ai-provider`. |

## Limitations

- One configured account: the player is fixed in `src/lib/brawl-stars.ts`; there
  is no account picker and no way to query another player.
- No database and no authentication. Progression history and brawler rules
  exist only in the current browser’s `localStorage` (maximum 30 snapshots)
  and are lost when site data is cleared.
- The AI analysis requires at least one provider key (`GOOGLE_GENERATIVE_AI_API_KEY`
  or `GROQ_API_KEY`) in addition to `BRAWL_STARS_API_KEY`; with no AI key the
  dashboard cannot produce recommendations.
- Analysis is cached for 30 minutes and refreshes are rate limited, so the
  dossier can lag behind very recent games.
