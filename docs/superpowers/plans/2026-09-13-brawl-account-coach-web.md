# Brawl Account Coach Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a personal Brawl Stars account-coaching dashboard for player `Y0GLCU0GL`.

**Architecture:** Add an independently deployable Next.js app inside the existing pnpm monorepo. Server-only modules fetch official Brawl Stars data through the RoyaleAPI proxy, derive deterministic account metrics, and use Groq structured output for grounded recommendations. A cached API route powers a responsive client dashboard.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vercel AI SDK 6, Groq, Zod 4, Vitest, Vercel.

---

### Task 1: Scaffold the standalone monorepo app

**Files:**
- Create: `apps/brawl-account-coach/package.json`
- Create: `apps/brawl-account-coach/tsconfig.json`
- Create: `apps/brawl-account-coach/next.config.mjs`
- Create: `apps/brawl-account-coach/postcss.config.mjs`
- Create: `apps/brawl-account-coach/tailwind.config.ts`
- Create: `apps/brawl-account-coach/eslint.config.mjs`
- Create: `apps/brawl-account-coach/vitest.config.ts`
- Create: `apps/brawl-account-coach/.env.example`

- [ ] Use explicit npm-compatible dependency versions so Vercel can deploy the app directory independently.
- [ ] Add scripts for development, tests, typecheck, lint, build, and start.
- [ ] Configure remote Brawl Stars image hosts.
- [ ] Document only empty `BRAWL_STARS_API_KEY` and `GROQ_API_KEY` values.
- [ ] Add the app importer to `pnpm-lock.yaml` without rewriting unrelated lock entries.

### Task 2: Define domain schemas and deterministic metrics

**Files:**
- Create: `apps/brawl-account-coach/src/lib/types.ts`
- Create: `apps/brawl-account-coach/src/lib/schemas.ts`
- Create: `apps/brawl-account-coach/src/lib/account-metrics.ts`
- Create: `apps/brawl-account-coach/src/lib/account-metrics.test.ts`
- Create: `apps/brawl-account-coach/src/lib/recommendation-validation.ts`
- Create: `apps/brawl-account-coach/src/lib/recommendation-validation.test.ts`

- [ ] Write failing tests for power distribution, trophy efficiency, under-pushed high-power brawlers, and recent mode trends.
- [ ] Implement deterministic metrics from the player profile and battle log.
- [ ] Define structured schemas for health score, upgrades, push targets, builds, battle diagnosis, avoid list, and action plan.
- [ ] Write failing tests that reject unknown brawler and loadout names.
- [ ] Implement validation against the player’s owned roster and build items.
- [ ] Run tests and commit.

### Task 3: Implement server-only Brawl Stars access

**Files:**
- Create: `apps/brawl-account-coach/src/lib/brawl-stars.ts`
- Create: `apps/brawl-account-coach/src/lib/rate-limit.ts`
- Create: `apps/brawl-account-coach/src/lib/rate-limit.test.ts`

- [ ] Fetch `GET /v1/players/%23Y0GLCU0GL`.
- [ ] Fetch `GET /v1/players/%23Y0GLCU0GL/battlelog`.
- [ ] Fetch `GET /v1/brawlers`.
- [ ] Use `https://bsproxy.royaleapi.dev` and a server-only bearer token.
- [ ] Distinguish invalid token/IP, not found, throttling, and maintenance errors.
- [ ] Add tested per-IP request limiting.
- [ ] Ensure error logs never include tokens.

### Task 4: Implement cached structured account coaching

**Files:**
- Create: `apps/brawl-account-coach/src/lib/ai-provider.ts`
- Create: `apps/brawl-account-coach/src/lib/analyze-account.ts`
- Create: `apps/brawl-account-coach/src/app/api/analysis/route.ts`
- Create: `apps/brawl-account-coach/src/app/api/health/route.ts`

- [ ] Use the existing valid Groq key with `openai/gpt-oss-120b`.
- [ ] Ground recommendations in roster metrics, owned loadouts, and recent battles.
- [ ] Allow fewer than five recommendations when evidence is insufficient.
- [ ] Validate AI output before returning it.
- [ ] Cache complete analysis for 30 minutes.
- [ ] Return safe structured errors and configuration health.

### Task 5: Build the white arcade-dossier dashboard

**Files:**
- Create: `apps/brawl-account-coach/src/app/layout.tsx`
- Create: `apps/brawl-account-coach/src/app/globals.css`
- Create: `apps/brawl-account-coach/src/app/page.tsx`
- Create: `apps/brawl-account-coach/src/components/account-dashboard.tsx`
- Create: `apps/brawl-account-coach/src/components/brawler-card.tsx`
- Create: `apps/brawl-account-coach/src/components/upgrade-priorities.tsx`
- Create: `apps/brawl-account-coach/src/components/push-targets.tsx`
- Create: `apps/brawl-account-coach/src/components/build-advice.tsx`
- Create: `apps/brawl-account-coach/src/components/battle-diagnosis.tsx`
- Create: `apps/brawl-account-coach/src/components/analysis-error.tsx`
- Create: `apps/brawl-account-coach/public/brawl-mark.svg`

- [ ] Use a forced-light white interface with cobalt, trophy yellow, and hot-pink accents.
- [ ] Render player summary, account score, roster power distribution, priorities, push targets, owned builds, recent battle diagnosis, avoid list, and three-step plan.
- [ ] Add mobile and desktop responsive layouts, loading skeletons, and actionable errors.
- [ ] Include a clear “refreshes every 30 minutes” indicator.

### Task 6: Verify, deploy, and attach the custom domain

- [ ] Run complete tests, typecheck, lint, and production build.
- [ ] Run a live profile and battle-log request with the official token.
- [ ] Browser-smoke-test mobile and desktop widths.
- [ ] Create Vercel project `brawl-account-coach`.
- [ ] Configure encrypted production `BRAWL_STARS_API_KEY` and `GROQ_API_KEY`.
- [ ] Deploy production and verify health plus live analysis.
- [ ] Add `brawl.joaog.space` as the project’s production domain.
- [ ] Merge the isolated branch to `main` and verify again.
