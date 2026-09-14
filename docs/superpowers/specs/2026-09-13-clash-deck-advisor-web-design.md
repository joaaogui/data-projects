# Clash Deck Advisor Web Design

## Goal

Create a personal, mobile-first web version of Clash Deck Advisor at
`apps/clash-deck-advisor`. It analyzes the current Clash Royale deck for player
`VGURQ0QQ2` and recommends changes only when those changes are clearly better.

## Architecture

- Next.js 16 App Router with TypeScript and Tailwind CSS.
- Server-only Clash Royale and Gemini integrations.
- Vercel AI SDK with structured Zod output.
- A cached server analysis refreshed at most every 30 minutes.
- Strict rate limiting on refresh endpoints.
- No database or authentication in the first version.
- Secrets remain in server environment variables and never reach the browser.

## Data Flow

1. Fetch player profile and current deck from the Clash Royale API.
2. Fetch recent battle logs and a small sample of top-ladder decks.
3. Derive recent losses, card levels, evolutions, champions, and level-impact warnings.
4. Ask Gemini for one structured analysis of the current deck.
5. Validate the response locally:
   - Original and improved decks each contain exactly eight owned cards.
   - Every listed swap matches the before/after deck difference.
   - The improved deck fills two evolution slots and one champion slot.
   - No-op analyses return the original deck unchanged.
6. Render the cached result and allow a rate-limited refresh.

## User Experience

The single-page dashboard uses a refined white “Royal Workshop” aesthetic with
navy typography, royal-blue actions, warm gold details, card art, restrained
shadows, and responsive mobile-first layouts.

Sections:

1. Player profile: name, trophies, arena, win rate, and last refresh.
2. Current deck: eight cards with level, evolution, and champion indicators.
3. Verdict: either “Keep this deck” or a concise explanation of why changes help.
4. Proposed swaps: side-by-side card changes with explicit reasons.
5. Improved deck: highlighted final eight-card deck.
6. Meta position: archetype and S–D tier.
7. Matchups and replay advice from recent losses.
8. Level-impact warnings.
9. “Open in Clash Royale” and copy-link actions.

## Reliability and Error Handling

- Clash Royale and Gemini failures render actionable error states.
- If live meta sampling fails, analysis continues without it.
- Invalid Gemini output is rejected instead of displayed.
- Loading uses a deck-analysis progress state rather than an empty screen.
- The server logs timings and validation failures without logging secrets.

## Deployment

- Create a new Vercel project named `clash-deck-advisor`.
- Configure `CLASH_ROYALE_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY`.
- Deploy from `apps/clash-deck-advisor`.
- Preserve all existing uncommitted monorepo work; only the new app, this spec,
  required workspace metadata, and lockfile are in scope.

## Verification

- Typecheck, lint, and production build.
- Unit tests for deck-diff validation and level warnings.
- Browser smoke test at mobile and desktop widths.
- Verify the deployed Vercel URL returns a valid analysis without exposing keys.
