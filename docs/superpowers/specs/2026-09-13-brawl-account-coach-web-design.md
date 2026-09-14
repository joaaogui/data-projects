# Brawl Account Coach Web Design

## Goal

Create a personal, mobile-first Brawl Stars account coach at
`apps/brawl-account-coach` for player `Y0GLCU0GL`, deployed at
`brawl.joaog.space`.

## Architecture

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4.
- Server-only Brawl Stars API access through `bsproxy.royaleapi.dev`.
- Official `BRAWL_STARS_API_KEY` configured with proxy IP `45.79.218.79`.
- Existing Groq structured-output provider for account recommendations.
- Thirty-minute cached analysis and strict per-IP rate limiting.
- No database, authentication, or editable player tag in the first version.

## Data Flow

1. Fetch player profile and complete brawler roster.
2. Fetch recent battle logs and the Brawl Stars brawler catalog.
3. Derive roster completion, power distribution, trophy efficiency, recent
   win/loss trends, mode performance, and missing build components.
4. Ask the AI for structured account advice grounded only in that evidence.
5. Validate all recommended brawler names and owned loadout items locally.
6. Return a cached dashboard response.

## Account Recommendations

- Account health score with a concise verdict.
- Five upgrade priorities with current power, trophies, expected account
  impact, and a clear reason.
- Trophy-push targets: high-power brawlers whose trophies lag the roster.
- Owned gadget, Star Power, gear, and Hypercharge recommendations.
- Recent battle diagnosis grouped by brawler, mode, and map.
- Low-value upgrades to avoid for now.
- A short three-step action plan.

The coach must be allowed to return fewer recommendations when the account
evidence does not justify more. It must never invent unowned brawlers, gadgets,
Star Powers, gears, or Hypercharges.

## User Experience

Use a bright white arcade-dossier aesthetic that is visually related to Clash
Deck Advisor but clearly Brawl Stars-specific: cobalt blue, trophy yellow,
hot-pink accents, chunky display type, bold score cards, brawler portraits, and
compact mobile-first rankings.

Sections:

1. Player header with trophies, highest trophies, victory totals, and club.
2. Account health score and roster power distribution.
3. Upgrade priority ranking.
4. Trophy-push opportunities.
5. Recommended owned builds.
6. Recent battle diagnosis.
7. Avoid-for-now investments.
8. Three-step action plan.

## Reliability and Security

- API and AI credentials remain server-only.
- Brawl API failures show status-specific guidance, especially invalid token/IP.
- AI output is schema-validated and cross-checked against the player roster.
- Invalid AI output is rejected rather than displayed.
- Logs record timings and error types without recording credentials.
- No secret is written to tracked files.

## Deployment

- Vercel project: `brawl-account-coach`.
- Production domain: `brawl.joaog.space`.
- Production secrets: `BRAWL_STARS_API_KEY` and `GROQ_API_KEY`.
- Deploy independently from `apps/brawl-account-coach`.

## Verification

- Unit tests for roster metrics, recommendation validation, and battle trends.
- Typecheck, lint, and production build.
- Live player/battle API test using the official proxy.
- Mobile and desktop browser smoke tests.
- Public production health and analysis verification.
