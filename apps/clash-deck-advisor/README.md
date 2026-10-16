# Clash Deck Advisor

Personal-use tool for its owner's own Clash Royale account. It answers: given my current deck, card collection and levels, recent battles, and the top-ladder meta, what should I change — a few targeted swaps that keep the deck recognisable (`improve` mode), or the strongest deck my whole collection can build (`best` mode)?

The app is a single page (`src/app/page.tsx` renders `DeckDashboard`). Advice is computed server-side by `POST /api/analysis` (also `GET`, for a request with no saved browser state); `GET /api/health` reports whether the required configuration is present. There is no account picker and no authentication.

## How it works

1. **Fetch.** `src/lib/clash-royale.ts` calls the Clash Royale API through `proxy.royaleapi.dev/v1` with `CLASH_ROYALE_API_KEY`, for one player tag hardcoded in that module. It loads the player (collection, levels, current deck), the battle log, and meta evidence: winning decks from top Path of Legend players, falling back to the legacy trophy ranking feed.
2. **Context.** `getAnalysisContext` in the same module turns cards into profiles (`card-knowledge.ts` over `card-roles.data.ts` and `card-mechanics.ts`, levels normalised to the 1–16 scale), filters the collection to viable candidates (`engine-context.ts`), and merges the live battle log with stored history. `learning-engine.ts` derives recent losses, a loss autopsy (recurring threats and blind spots), deck versions with per-version win rates, and the measured impact of earlier suggested changes; `battle-history.ts` handles merging and dedupe.
3. **Deterministic recommendation.** `archetype-engine.ts` matches the collection against archetype templates (`archetypes.data.ts`), applies hard gates (`deck-rules.ts` legality — 8 unique cards and the Evolution/Hero/Wild slot limits — plus win-condition, air-defense, spell and minimum-level gates), and scores survivors with `deck-score.ts`. `deck-refine.ts` then hill-climbs: it tries every legal single-card substitution and keeps only swaps that close a structural gap without lowering the score. `level-warnings.ts` flags recommended cards below the deck's level benchmark.
4. **AI polish.** `deck-engine.ts` (`runDeckEngine`) asks a model, via `generateText`, to rewrite only the coaching text of the deterministic recommendation. Model access goes through the shared AI provider (`@data-projects/shared/ai-provider`): the fallback chain is Gemini lite, then Groq, then the full Gemini model, and `getCandidateModels` picks at most one model per provider so proposals do not come from one backend sampled twice.
5. **Claim check.** Before AI-written text is accepted, `claim-check.ts` (`groundedClaims`) rejects it if it names a card outside the decided decks or invents a replay event; `deck-engine.ts` also rejects short output and keeps the deterministic copy on any failure or timeout.
6. **Feedback loop.** Each analysis records its suggestion and the fresh battles into the learning ledger (`feedback-store.ts`). On the next request the browser sends its locked/excluded cards, suggestion history and battle history back; `learning-engine.ts` re-evaluates how each deck version and earlier swap performed, `deck-score.ts` adjusts points for known deck versions and for counters to recent loss threats, and `archetype-engine.ts` penalises decks and swaps that already failed — so outcomes re-rank future suggestions.

`src/lib/analyze-deck.ts` orchestrates the pipeline. A plain first visit is served from a 30-minute cache; any request carrying personal input (card locks/exclusions, suggestion or battle history) or an explicit refresh bypasses it. The analysis route runs on Node.js with `maxDuration = 60` and rate-limits requests (tighter for refreshes, which spend model calls).

## Deterministic vs AI split

| Concern | Owner |
| --- | --- |
| Deck contents, swaps, scores, verdict | Local engines (`archetype-engine`, `deck-score`, `deck-rules`, `deck-refine`) |
| Legality and level gates | Local (`deck-rules.ts`; `MIN_RECOMMENDED_LEVEL` in `archetype-engine.ts`) |
| Battle, loss and change-impact analysis | Local (`learning-engine.ts`) |
| Coaching prose | LLM rewrites the supplied facts only; it cannot change the deck |
| Grounding of AI text | Local (`claim-check.ts`); ungrounded text is discarded |

The model never grades or selects the final deck. If the model call fails, times out, or produces ungrounded text, the deterministic recommendation and its locally written strategy text are returned unchanged.

## Storage

Storage is hybrid. The app fully works with no database configured.

- **Neon Postgres (optional).** When `DATABASE_URL` (or `POSTGRES_URL`) is set, `src/db/index.ts` (`getDb()`) creates a Drizzle client over the Neon HTTP driver; otherwise `getDb()` returns `null`. The schema (`src/db/schema.ts`, Postgres schema `clash`) has three tables: `battles`, `suggestions`, and `player_preferences` (locked/excluded cards). `src/lib/db-store.ts` syncs battles (up to 500), loads past suggestions and preferences, and saves each new suggestion.
- **Browser localStorage (always).** `feedback-store.ts` keeps the learning ledger — locked/excluded cards, suggestion history, and up to 300 stored battles — and the dashboard sends it with every analysis request.
- **Graceful degradation.** With no DB, `syncAndLoadBattles` returns the incoming battles unchanged, `loadStoredSuggestions` returns `[]`, and preference loads return `null`; DB errors fall back the same way. The only loss is cross-device/cross-browser history.

## Quality evals

Unit tests (`pnpm --filter clash-deck-advisor run test`) cover the local engines and stores (`src/**/*.test.ts`). Separately, a live end-to-end eval (`src/lib/deck-quality.eval.ts`) is kept out of the unit run by `vitest.eval.config.ts`:

```bash
pnpm --filter clash-deck-advisor run eval
```

It loads `.env.local`, runs the full engine against the live Clash Royale API and real models in both modes, and asserts, among other things: 8 unique owned cards, no special-slot legality violations, a score no worse than the current deck, structural soundness (win condition, air defense, spell coverage, average elixir in range), changes consistent with the two decks, a recognisable deck in `improve` mode (at most 3 swaps), no card below the level gate, and non-trivial coaching text. A human-readable report is written to `/tmp/clash-eval-report.txt`. Because it is live, it needs real API/AI keys and can take up to the 180-second test budget.

## Running locally

From the monorepo root:

```bash
cp apps/clash-deck-advisor/.env.example apps/clash-deck-advisor/.env.local
# fill in CLASH_ROYALE_API_KEY and at least one AI key
pnpm --filter clash-deck-advisor dev
```

The app serves on port 3012 (`http://localhost:3012`); check `http://localhost:3012/api/health` for configuration status. Node >= 22 is required (`engines` in `package.json`).

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLASH_ROYALE_API_KEY` | Yes | Bearer token for the Clash Royale API proxy (`src/lib/clash-royale.ts`) |
| `GROQ_API_KEY` | One AI key required | Groq model access for the shared AI provider |
| `GOOGLE_GENERATIVE_AI_API_KEY` | One AI key required | Google Gemini model access for the shared AI provider |
| `DATABASE_URL` | No | Neon Postgres connection string; enables the DB store (`src/db/index.ts`) |
| `POSTGRES_URL` | No | Alternative to `DATABASE_URL`, checked second; same fallback |

`drizzle.config.ts` uses the same `DATABASE_URL` / `POSTGRES_URL` fallback for the `db:*` scripts. Without either, the app falls back to browser localStorage only (see Storage).

### Scripts

| Script | Command |
| --- | --- |
| `dev` | `next dev --turbopack -p 3012` |
| `build` / `start` | `next build` / `next start -p 3012` |
| `lint` / `typecheck` | `eslint .` / `tsc --noEmit` |
| `test` / `test:watch` | `vitest run` (unit only) / `vitest` |
| `eval` | `vitest run --config vitest.eval.config.ts` (live eval) |
| `db:push` / `db:generate` / `db:migrate` / `db:studio` | `drizzle-kit push` / `generate` / `migrate` / `studio` |

## Project layout

```text
src/app/page.tsx               Single page; renders DeckDashboard
src/app/api/analysis/route.ts  GET + POST analysis (Node.js, maxDuration 60)
src/app/api/health/route.ts    Configuration status
src/components/                Dashboard, change plan, swap list, loss autopsy, learning tracker, status strip
src/lib/clash-royale.ts        API client and analysis-context assembly
src/lib/analyze-deck.ts        Orchestration, caching, DB/browser merge
src/lib/deck-engine.ts         Deterministic recommendation + AI polish
src/lib/archetype-engine.ts    Archetype matching, gates, ranking (+ archetypes.data.ts templates)
src/lib/card-knowledge.ts      Card profiles and aggregates (+ card-roles.data.ts, card-mechanics.ts)
src/lib/deck-score.ts          Local deck scoring
src/lib/deck-rules.ts          Deck legality (size, special slots)
src/lib/deck-refine.ts         Hill-climbing swap search
src/lib/learning-engine.ts     Loss autopsy, deck versions, change impacts
src/lib/feedback-store.ts      Browser learning ledger (localStorage)
src/lib/db-store.ts            Neon-backed battles/suggestions/preferences
src/lib/battle-history.ts      Battle merge, dedupe, stored-battle mapping
src/lib/claim-check.ts         Grounding check for AI-written text
src/lib/level-warnings.ts      Under-levelled card warnings
src/lib/deck-link.ts           In-game deck link construction
src/lib/analysis-request.ts    Request size/shape validation for POST
src/lib/schemas.ts, types.ts   Zod schemas and shared types
src/db/                        Drizzle client (index.ts) and schema.ts
src/test/                      Vitest env loader
```

## Limitations

- **Single configured account.** The player tag is hardcoded in `src/lib/clash-royale.ts`; analysing another account requires a code change, and there is no authentication or multi-user support.
- **Live dependencies.** Analysis needs the Clash Royale API; if the top-ladder meta fetch fails, analysis continues without meta evidence, but player or battle-log failures surface as API errors.
- **History depth.** The live battle log is short, so long-term learning depends on stored history: up to 300 battles in the browser ledger and 500 in the DB, with form/loss analysis over the newest 25.
- **Conservative slot assertions.** The API does not expose Hero unlock state, so `deck-rules.ts` only asserts Champions as Hero-slot occupants (see the comment there).
