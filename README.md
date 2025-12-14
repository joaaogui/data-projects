# Data Projects

A monorepo containing web applications that visualize and analyze data from various APIs.

## Apps

| App | Description | README |
|-----|-------------|--------|
| [IMDb Best Season](apps/imdb-best-season) | Ranks TV show seasons based on IMDb episode ratings | [README](apps/imdb-best-season/README.md) |
| [Spotify Popularity](apps/spotify-popularity) | Shows the most popular tracks of any artist on Spotify | [README](apps/spotify-popularity/README.md) |
| [YouTube Analyzer](apps/youtube) | Analyzes YouTube channel statistics and video performance | [README](apps/youtube/README.md) |

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui + Radix UI
- **Data Fetching:** TanStack Query
- **Tables:** TanStack Table

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15+

### Installation

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all apps
pnpm build

# Lint all apps
pnpm lint
```

### Environment Variables

Each app requires its own environment variables. See the individual READMEs for details:

- [IMDb Best Season](apps/imdb-best-season/README.md#environment-variables)
- [Spotify Popularity](apps/spotify-popularity/README.md#setup)
- [YouTube Analyzer](apps/youtube/README.md#environment-variables)

## Project Structure

```
├── apps/
│   ├── imdb-best-season/    # IMDb season ranking app
│   ├── spotify-popularity/  # Spotify track popularity app
│   └── youtube/             # YouTube channel analyzer
├── packages/
│   ├── shared/              # Shared utilities and hooks
│   ├── tailwind-config/     # Shared Tailwind configuration
│   └── ui/                  # Shared UI components
├── turbo.json               # Turborepo configuration
└── pnpm-workspace.yaml      # pnpm workspace configuration
```

## License

[AGPL-3.0](LICENSE)

