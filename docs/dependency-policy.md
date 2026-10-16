# Dependency Policy

Reference for where dependency versions are declared in this workspace, and how
they are upgraded. This change alters _where_ versions are declared, never
_which_ version resolves.

## The two tiers

### Tier 1 — Per-app pinned (direct ranges in each `package.json`)

| Package          | Pin (identical everywhere today) |
| ---------------- | -------------------------------- |
| `next`           | `^16.4.0`                        |
| `react`          | `^19.3.0`                        |
| `react-dom`      | `^19.3.0`                        |
| `ai`             | `^7.0.107`                       |
| `@ai-sdk/google` | `^4.0.76`                        |
| `@ai-sdk/groq`   | `^4.0.46`                        |
| `@ai-sdk/react`  | `^4.0.110`                       |

Declared in: every `apps/*/package.json` that uses them, plus
`packages/ui/package.json` (`next`, `react`, `react-dom` as devDependencies) and
`packages/shared/package.json` (`ai`, `@ai-sdk/google`, `@ai-sdk/groq`).

Rationale: framework and AI-SDK dependencies carry the advisory and
breaking-change risk, they release on a fast cadence, and each app deploys
independently anyway. A catalog pin forced one bump to land in all six apps at
once; a direct pin lets one app move, prove itself, and the rest follow.

### Tier 2 — Catalog (`catalog:` in `pnpm-workspace.yaml`)

Everything else: `typescript`, `eslint` and its plugins, `tailwindcss`,
`@tailwindcss/postcss`, `postcss`, `@tanstack/react-query`,
`@tanstack/react-table`, `zod`, `drizzle-orm`, `drizzle-kit`, `@types/*`,
`vitest`, `prettier`, `turbo`, `lucide-react`, `pino`, and the small utilities
(`clsx`, `tailwind-merge`, `class-variance-authority`, `next-themes`,
`posthog-js`, `server-only`, `@neondatabase/serverless`, …).

Rationale: these are stable, low-churn, and shared tooling is genuinely easier
to keep on one version. Overrides stay in the root `package.json` (`pnpm.overrides`),
not in the workspace file.

## The single stack is intentional

These are personal-use tools, not a portfolio of experiments. One framework
(Next.js), one UI runtime (React), one AI SDK. `packages/shared` and
`packages/ui` are consumed by all apps, so a second React or framework would
have to be paid for in every shared component. A second framework needs a
question the current stack cannot answer — not variety for its own sake.

## Known couplings (not fully decoupled, by construction)

- `packages/shared/src/ai-provider.ts` imports `@ai-sdk/google`, `@ai-sdk/groq`,
  and `ai`. `brawl-account-coach` and `clash-deck-advisor` both consume it via
  `@data-projects/shared/ai-provider`, so those two apps' AI-SDK versions are
  inherently coupled through `shared`: bump `shared` and both apps together.
  Both apps also pin `ai` directly for their own use; keep it in step.
- `youtube-analyzer` owns its own `@ai-sdk/*` pins (including `@ai-sdk/react`,
  which only it uses) and can move its AI SDK independently of `shared`.
- `packages/ui` forces a common React across apps: diverging React majors per
  app would break the shared components before it broke any single app.
- Still in the catalog and version-locked to Tier 1 in practice:
  `@types/react` / `@types/react-dom` (`^19.3.0`) and
  `@next/eslint-plugin-next` (`^16.4.0`). A React or Next major bump must move
  these catalog entries in the same change.

## Upgrade playbook (Tier 1)

1. Canary first: bump one small app — `imdb-best-season` or
   `spotify-popularity` — by editing only its `package.json`.
2. `corepack pnpm install`
3. Verify the canary: `corepack pnpm --filter <app> run build`,
   `corepack pnpm --filter <app> run test`,
   `corepack pnpm --filter <app> run typecheck`.
4. Roll app-by-app in the same way, smallest to largest.
5. `youtube-analyzer` goes last — it is the largest app and the only
   `@ai-sdk/react` consumer.
6. For AI-SDK bumps: `packages/shared`, `brawl-account-coach`, and
   `clash-deck-advisor` move together (see Known couplings).
7. Never change a version number as part of a where-it-is-declared refactor;
   declaration moves and version bumps are separate changes.

## Security advisory procedure

1. Identify which apps actually depend on the affected package (Tier 1 pins
   make this a per-app `package.json` lookup).
2. Bump only the affected apps, canary-first as above; unaffected apps keep
   their known-good pin until their own scheduled roll.
3. Each app deploys independently, so a catalog-era atomic bump across all
   apps was never required for deployment — it only coupled the risk.

## Escape-hatch precedent

Per-app divergence already works in this repo: `tailwindcss` is on the catalog
v3 line (`^3.4.19`) for `imdb-best-season` and `spotify-popularity`, while
`brawl-account-coach`, `clash-deck-advisor`, `lastfm-habits`, and
`youtube-analyzer` carry direct `^4.3.3` pins. Tier 1 generalises that proven
pattern to the framework and AI dependencies.
