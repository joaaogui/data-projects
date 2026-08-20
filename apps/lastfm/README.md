# Listening Habits

Deep analysis of a Last.fm scrobble history. Imports the full play-by-play
record into Postgres, then answers questions Last.fm's own aggregate endpoints
cannot: when listening happens, how artists enter and leave rotation, and how
taste concentration shifts year over year.

Runs on port **3004**.

## Why the data is copied locally

`user.getTopArtists` and the weekly charts only answer "what did I play most".
Hour-of-day heatmaps, listening sessions, discovery rate, and streaks all need
the raw scrobble stream, which only `user.getRecentTracks` provides — 200 rows
per page, no authentication required.

## Setup

```bash
cp .env.example .env.local   # fill in the values
pnpm db:push                 # creates the `lastfm` schema and its tables
pnpm dev
```

Then open [/import](http://localhost:3004/import) and run a full import.

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `LASTFM_API_KEY` | yes | Create one at [last.fm/api/account/create](https://www.last.fm/api/account/create) |
| `LASTFM_USERNAME` | yes | The account to analyse |
| `LASTFM_TIMEZONE` | no | IANA zone for bucketing local hours (default `America/Sao_Paulo`) |
| `POSTGRES_URL` | yes | Postgres connection string |
| `LOG_LEVEL` | no | `info` in production, `debug` in development |

Only the API key is needed. Every method this app calls documents "This service
does not require authentication" — the shared secret exists for write operations
(scrobbling, loving tracks) and is deliberately unused.

### Sharing a database

Tables live in a dedicated `lastfm` Postgres schema, and `drizzle.config.ts`
sets `schemaFilter: ["lastfm"]`. That combination means `db:push` cannot see, or
offer to drop, tables belonging to another app in the same database.

## Import

One resumable mechanism covers both the initial backfill and ongoing syncs
(`src/lib/import.ts`):

- The upper bound (`to`) is frozen when a job starts, so page numbers stay
  stable while new scrobbles arrive mid-import.
- Full mode walks every page; incremental mode sets `from` to the newest stored
  play and usually finishes in one request.
- Each `POST /api/import` spends a bounded slice of time, saves its cursor, and
  returns. The client re-posts until the job leaves `running`, which keeps a
  multi-minute backfill inside a series of short requests.
- Three requests in flight with a pause between batches, roughly 3/second. The
  API terms publish no numeric rate limit, so this is deliberately conservative;
  Last.fm error 29 triggers exponential backoff.
- A unique index on `(artist_name, track_name, played_at)` makes re-reading a
  page harmless, so a failed chunk can simply be retried.

A ~225,000-scrobble history is about 1,125 requests and completes in a few
minutes.

## Analyses

All computed as SQL against `scrobbles`. Scrobbles are stored as UTC instants
and rebased through `LASTFM_TIMEZONE` before being bucketed by hour, day, or
month.

| Page | Contents |
|---|---|
| `/` | Lifetime totals, streaks, milestones, heaviest single-day repeats, recent plays |
| `/time` | Hour-by-weekday heatmap, per-day calendar, monthly volume, listening sessions, streaks |
| `/artists` | Discovery rate, lifecycle classification, obsessions, comebacks, sortable top 250 |
| `/artists/[name]` | Per-artist play history, top tracks and albums, rank and share |
| `/evolution` | Year-over-year rank movement, concentration and evenness, loyalty, one-hit wonders |
| `/library` | Every artist and track, searchable server-side across the full table |

### Interpreting the derived measures

- **Lifecycle** labels (companion, phase, recent, abandoned, casual) come from
  threshold rules in `src/lib/lifecycle.ts`. They are judgement calls, not
  measurements; the rules are shown in the UI next to the counts.
- **Sessions** are runs of plays with no gap over 30 minutes. Reported duration
  spans the first to the last scrobble, so it understates each session by the
  length of its final track — the recent-tracks endpoint returns no durations.
- **Evenness** is Shannon entropy over the artist distribution divided by its
  theoretical maximum, so years with different artist counts compare fairly.
- **Artist counts** can differ slightly from the total shown on last.fm, which
  applies its own name corrections and merges; this app stores names as
  scrobbled.

## Stack

Next.js 16 (App Router) - React 19 - Drizzle ORM on Neon Postgres - TanStack
Query - Tailwind v4 - recharts for charts, hand-rolled CSS grids for heatmaps.
Shared primitives come from `@data-projects/ui` and `@data-projects/shared`.
