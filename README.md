# CatchGrid

CatchGrid is a local-first Pokémon GO collection companion built with React,
TypeScript, Vite, Cloudflare Workers, and D1. It provides a National Dex, separate
collector-form tracking, collection-aware Pokémon GO search strings, CSV and full-profile
portability, saved visual searches, and an installable offline-capable PWA.

> **Canonical site:** [dex.cjdev.app](https://dex.cjdev.app/)
>
> **Public source:**
> [HoLeeChuck/dexly-pokemon-go-companion](https://github.com/HoLeeChuck/dexly-pokemon-go-companion)

The public app needs no account or access key. Each browser stores its private collection,
alternate-form selections, saved searches, and appearance settings in local storage. The
public catalog comes from a profile-free edge endpoint backed by D1; trainer state is not
sent with that request.

CatchGrid is an unofficial fan project. It is not affiliated with or endorsed by Niantic,
The Pokémon Company, or Nintendo, and it never asks for Pokémon GO credentials. See
[Third-party notices](THIRD_PARTY_NOTICES.md) for the unresolved sprite-rights limitation.

## Catalog scope

The reviewed `2026-08-13.1` snapshot contains:

- one stable representative for every National Dex number from #1 through #1025, including
  unreleased placeholders used for complete-Dex denominators;
- 949 released standard species as of August 13, 2026;
- 177 reviewed collector forms, for 1,202 total form records;
- regional, gender, costume, alternate, Mega, Primal, Gigantamax, and fusion form groups;
- all 28 Unown forms, tracked separately for Regular and Shiny only; and
- release, tradeability, category-rule, sprite, and provenance metadata per form.

Sprite availability is not treated as release evidence. The dated catalog and its additive
D1 migration are verified offline by `pnpm catalog:verify`. Nickit's announced Shiny debut
is after this snapshot and is intentionally not enabled early.

## Local setup

Prerequisites:

- Node.js 22.13 or newer
- pnpm 11.21 (`package.json` pins the expected package-manager version)

From PowerShell:

```powershell
pnpm install
pnpm exec playwright install chromium webkit
Copy-Item .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Open the loopback URL printed by Vite. Local D1 state under `.wrangler/state` is isolated
from staging and production. `.dev.vars` is ignored by Git; never commit an
`APP_ACCESS_TOKEN`, `.dev.vars`, or Cloudflare API token.

## Verification and release commands

| Command                  | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `pnpm dev`               | Run the React app, Worker, assets, and local bindings.                  |
| `pnpm db:migrate:local`  | Apply checked-in migrations to isolated local D1.                       |
| `pnpm lint`              | Check TypeScript and React lint rules.                                  |
| `pnpm format`            | Check Prettier formatting without rewriting files.                      |
| `pnpm test:unit`         | Run domain, catalog, local-profile, PWA, and search unit tests.         |
| `pnpm test:worker`       | Run Worker/API integration tests against isolated migrated D1.          |
| `pnpm test:e2e`          | Run mobile/desktop Chromium and WebKit flows, including axe checks.     |
| `pnpm build`             | Generate binding types, type-check, and create a development artifact.  |
| `pnpm build:artifact`    | Build and measure the exact release artifact without regenerating it.   |
| `pnpm bundle:report`     | Report initial/total JavaScript and CSS raw/gzip sizes by chunk.        |
| `pnpm check`             | Validate source, build once, and report the resulting artifact.         |
| `pnpm catalog:verify`    | Verify catalog provenance, forms, sprites, and immutable generation.    |
| `pnpm release:preflight` | Run every local release gate plus Wrangler's strict deployment dry run. |
| `pnpm deploy:production` | Preflight, bookmark, migrate, deploy, and smoke production in order.    |

Production mutation is intentionally separated into named steps:
`release:bookmark:production`, `release:migrate:production`,
`release:deploy:production`, and `release:smoke:production`. Follow the
[deployment runbook](docs/DEPLOYMENT.md); do not treat a successful local build as proof
that staging, production, headers, or release metadata are live.

## Data ownership and portability

Public users are stored under the validated `catchgrid:local-profile:v2` schema. Writes are
durable-first, recovery snapshots rotate automatically, and corrupt payloads are preserved
instead of silently becoming an empty collection. CSV import previews apply the same
catalog eligibility rules as the Worker. Full JSON backups include standard and alternate
form state, saved searches, and appearance settings.

Browser storage is origin-scoped. The legacy
`dexly-companion.codyleejohnson26.workers.dev` origin therefore cannot silently transfer
data to `dex.cjdev.app`; its migration notice offers an export and the canonical link
without an automatic redirect. Clearing site storage removes the local profile unless a
backup has been exported.

An unlisted owner route retains a token-protected D1 profile for personal continuity. It is
not public multi-user authentication and is separate from normal browser-local profiles.

## Search and PWA behavior

The Search Lab provides copy/share actions and generated collection-gap strings.
Generated inventory queries preserve the `!traded&` guard. Exact and candidate output are
labeled rather than presented as equivalent.

The installable PWA precaches only the initial application shell and safe public catalog
response. Lazy route chunks are runtime-cached after a visit; private API responses and
`/cody` navigation are never cached. Updates require an explicit refresh action. Catalog downtime is
shown as a recoverable error and is never rendered as an empty collection.

## Legacy infrastructure names

CatchGrid is the public product name. These pre-rename identifiers remain intentionally to
preserve deployed resources, database history, bookmarks, and repository links:

- Worker `dexly-companion` and its `workers.dev` fallback origin;
- D1 databases `dexly-db` and `dexly-db-staging`;
- repository slug `dexly-pokemon-go-companion`; and
- read-only migration support for legacy `dexly:*` browser-storage keys.

See [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md),
[Catalog notes](catalog/README.md), and the
[public-launch closure matrix](docs/PUBLIC_LAUNCH_CLOSURE_MATRIX.md).

## Official platform references

- [React on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
