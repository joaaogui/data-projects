# Clash Deck Advisor Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a personal web dashboard that analyzes the current Clash Royale deck for `VGURQ0QQ2` and recommends only demonstrably beneficial changes.

**Architecture:** Add a standalone Next.js 16 app inside the existing Turborepo. Server-only modules fetch Clash Royale data and call Gemini with structured output; a cached API route exposes one validated analysis to a mobile-first dashboard. The browser never receives credentials.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vercel AI SDK 6, Google Gemini, Zod 4, Vitest, Vercel.

---

### Task 1: Scaffold the monorepo app

**Files:**
- Create: `apps/clash-deck-advisor/package.json`
- Create: `apps/clash-deck-advisor/tsconfig.json`
- Create: `apps/clash-deck-advisor/next.config.mjs`
- Create: `apps/clash-deck-advisor/postcss.config.mjs`
- Create: `apps/clash-deck-advisor/tailwind.config.ts`
- Create: `apps/clash-deck-advisor/eslint.config.mjs`
- Create: `apps/clash-deck-advisor/vitest.config.ts`
- Create: `apps/clash-deck-advisor/.env.example`
- Create: `apps/clash-deck-advisor/vercel.json`

- [ ] Create package scripts for `dev`, `build`, `lint`, `typecheck`, and `test`.
- [ ] Add dependencies: `@ai-sdk/google`, `@data-projects/shared`, `ai`, `lucide-react`, `next`, `react`, `react-dom`, and `zod`.
- [ ] Configure Next image loading for `api-assets.clashroyale.com`.
- [ ] Configure Vercel as a Next.js project with `npx turbo-ignore`.
- [ ] Add environment documentation:

```dotenv
CLASH_ROYALE_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

- [ ] Run `pnpm install`.
- [ ] Commit only the new scaffold and lockfile importer changes.

### Task 2: Define and validate the analysis domain

**Files:**
- Create: `apps/clash-deck-advisor/src/lib/types.ts`
- Create: `apps/clash-deck-advisor/src/lib/schemas.ts`
- Create: `apps/clash-deck-advisor/src/lib/deck-validation.ts`
- Test: `apps/clash-deck-advisor/src/lib/deck-validation.test.ts`

- [ ] Write failing tests proving that an analysis is rejected when it contains:
  - A card the player does not own.
  - A deck with anything other than eight unique cards.
  - A swap that does not match the original/improved deck diff.
  - Fewer or more than two evolved cards.
  - Fewer or more than one champion.
- [ ] Define the structured response schema:

```ts
export const deckAnalysisSchema = z.object({
  originalDeck: z.array(z.string()).length(8),
  improvedDeck: z.array(z.string()).length(8),
  verdict: z.enum(["keep", "improve"]),
  verdictReason: z.string(),
  problems: z.array(deckProblemSchema).max(4),
  changes: z.array(cardSwapSchema).max(3),
  metaTier: metaTierSchema,
  matchups: z.array(matchupSchema).length(5),
  replayAdvice: z.array(replayAdviceSchema).max(3),
  weaknessScores: weaknessScoresSchema,
  strategy: z.string(),
  averageElixir: z.number(),
});
```

- [ ] Implement `validateAnalysis(analysis, player)` with explicit error messages.
- [ ] Run `pnpm --filter clash-deck-advisor test`.
- [ ] Commit the domain model and tests.

### Task 3: Implement server-only Clash Royale data access

**Files:**
- Create: `apps/clash-deck-advisor/src/lib/clash-royale.ts`
- Create: `apps/clash-deck-advisor/src/lib/level-warnings.ts`
- Test: `apps/clash-deck-advisor/src/lib/level-warnings.test.ts`

- [ ] Implement server-only API helpers:

```ts
const API_BASE = "https://proxy.royaleapi.dev/v1";
const PLAYER_TAG = "VGURQ0QQ2";

export async function getPlayer(): Promise<Player> {
  return clashFetch(`/players/%23${PLAYER_TAG}`, { next: { revalidate: 300 } });
}

export async function getBattleLog(): Promise<Battle[]> {
  return clashFetch(`/players/%23${PLAYER_TAG}/battlelog`, { next: { revalidate: 300 } });
}
```

- [ ] Fetch up to ten global ranked players and sample recent winning decks for meta context.
- [ ] Convert recent player losses into compact opponent-deck evidence.
- [ ] Implement deterministic level warnings for under-leveled cards and known spell interactions.
- [ ] Verify API errors never include the API token.
- [ ] Run unit tests and commit.

### Task 4: Implement cached Gemini deck analysis

**Files:**
- Create: `apps/clash-deck-advisor/src/lib/analyze-deck.ts`
- Create: `apps/clash-deck-advisor/src/app/api/analysis/route.ts`
- Create: `apps/clash-deck-advisor/src/app/api/health/route.ts`

- [ ] Use `generateObject` with `@ai-sdk/google` and `deckAnalysisSchema`.
- [ ] Instruct Gemini to return `verdict: "keep"` with no changes when a change is not clearly superior.
- [ ] Provide current deck, owned-card levels, evolution/champion status, recent losses, and live meta references.
- [ ] Validate the output against owned cards, deck diff, and special slots before returning it.
- [ ] Cache the complete analysis for 30 minutes with `unstable_cache`.
- [ ] Return structured `503` and `500` errors for missing configuration and upstream failures.
- [ ] Expose a health route that reports configuration presence without revealing values.
- [ ] Run typecheck and commit.

### Task 5: Build the Royal Workshop interface

**Files:**
- Create: `apps/clash-deck-advisor/src/app/layout.tsx`
- Create: `apps/clash-deck-advisor/src/app/globals.css`
- Create: `apps/clash-deck-advisor/src/app/page.tsx`
- Create: `apps/clash-deck-advisor/src/components/deck-dashboard.tsx`
- Create: `apps/clash-deck-advisor/src/components/card-tile.tsx`
- Create: `apps/clash-deck-advisor/src/components/deck-comparison.tsx`
- Create: `apps/clash-deck-advisor/src/components/swap-list.tsx`
- Create: `apps/clash-deck-advisor/src/components/strength-bars.tsx`
- Create: `apps/clash-deck-advisor/src/components/matchups.tsx`
- Create: `apps/clash-deck-advisor/src/components/analysis-error.tsx`
- Create: `apps/clash-deck-advisor/public/crown-mark.svg`

- [ ] Implement a forced-light visual system using navy ink, royal blue, warm gold, off-white paper, and subtle arena-grid texture.
- [ ] Use `Fraunces` for display type and `Manrope` for body type via `next/font/google`.
- [ ] Build responsive current/improved deck grids with card images, levels, evolution stars, and champion crowns.
- [ ] Render a clear `Keep this deck` or `Improve this deck` verdict.
- [ ] Render only real problems and swaps; omit empty sections.
- [ ] Add meta tier, matchup advice, replay advice, level warnings, and strength bars.
- [ ] Add “Open in Clash Royale” and copy-deck controls.
- [ ] Add skeleton loading and actionable error/retry states.
- [ ] Commit the interface.

### Task 6: Verify behavior and quality

**Files:**
- Modify only files under `apps/clash-deck-advisor`

- [ ] Run `pnpm --filter clash-deck-advisor test`; expect all tests to pass.
- [ ] Run `pnpm --filter clash-deck-advisor typecheck`; expect no TypeScript errors.
- [ ] Run `pnpm --filter clash-deck-advisor lint`; expect no ESLint errors.
- [ ] Run `pnpm --filter clash-deck-advisor build`; expect a successful production build.
- [ ] Start the app locally and verify:
  - Mobile width around 390px.
  - Desktop width around 1440px.
  - Current deck has eight cards.
  - A no-op analysis shows “Keep this deck” without fake swaps.
  - No API keys appear in page source or client JavaScript.
- [ ] Commit verification fixes.

### Task 7: Create and deploy the Vercel project

**Files:**
- Modify: `apps/clash-deck-advisor/.vercel/project.json` (generated, gitignored)

- [ ] Verify Vercel CLI authentication with `vercel whoami`.
- [ ] Create/link a project named `clash-deck-advisor` with root directory `apps/clash-deck-advisor`.
- [ ] Copy the existing local Clash Royale and Gemini keys into Vercel environment variables without printing them.
- [ ] Deploy production with `vercel --prod`.
- [ ] Verify `/api/health` and the public dashboard URL.
- [ ] Report the final production URL.
