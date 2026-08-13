# CatchGrid

CatchGrid is a visual Pokémon GO collection companion built with React, TypeScript, Vite,
Cloudflare Workers, browser local storage, and D1. It tracks collection categories, realistic wanted entries,
actual trade specimens, CSV imports, undoable changes, and Pokémon GO search strings.

> **Production:** [Open CatchGrid](https://dex.cjdev.app/)
> or view the public source at
> [HoLeeChuck/dexly-pokemon-go-companion](https://github.com/HoLeeChuck/dexly-pokemon-go-companion).
> The catalog is public. Each browser keeps its own private collection, wanted entries,
> and trade notes locally; no account or access key is required.

CatchGrid is an unofficial fan project. It is not affiliated with or endorsed by Niantic,
The Pokémon Company, or Nintendo. It never asks for Pokémon GO account credentials.

## Local setup

Prerequisites:

- Node.js 22.13 or newer
- pnpm 11.21 (`package.json` pins the expected package-manager version)

From PowerShell:

```powershell
pnpm install
pnpm exec playwright install chromium
Copy-Item .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Open the loopback URL printed by Vite. Localhost intentionally uses the seeded `Local
Trainer` profile and does not require an access key. Local D1 state lives under
`.wrangler/state` and is separate from the remote production database.

`.dev.vars` is ignored by Git. Never commit a real `APP_ACCESS_TOKEN`, `.dev.vars`, or
Cloudflare API token.

## Useful commands

| Command                                     | Purpose                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                  | Run the React app, Worker, static assets, and local bindings together.    |
| `pnpm db:migrate:local`                     | Apply checked-in migrations to local D1 explicitly.                       |
| `pnpm test:unit`                            | Run normal Node-based unit tests.                                         |
| `pnpm test:worker`                          | Run Worker/API integration tests in workerd with an isolated migrated D1. |
| `pnpm test`                                 | Run both Vitest suites.                                                   |
| `pnpm test:e2e`                             | Run Playwright mobile and desktop user-flow tests.                        |
| `pnpm lint`                                 | Check TypeScript and React lint rules.                                    |
| `pnpm format`                               | Check formatting without rewriting files.                                 |
| `pnpm build`                                | Generate Wrangler binding types, type-check, and build the app/Worker.    |
| `pnpm check`                                | Run lint, formatting, both Vitest suites, and a production build.         |
| `pnpm catalog:sync:evolutions`              | Refresh the reviewed evolution-family search data.                        |
| `node scripts/verify-sprites.mjs`           | Validate the versioned catalog and sprite manifest offline.               |
| `node scripts/verify-sprites.mjs --network` | Also send opt-in checks to pinned sprite URLs.                            |
| `pnpm db:migrate:production`                | Apply migrations to the configured remote D1 database.                    |
| `pnpm deploy:production`                    | Build, migrate remote D1, then deploy. This changes production.           |

The last two commands mutate the configured production resources. `wrangler.jsonc`
binds `DB` to `dexly-db` with UUID `154ac34c-cdfc-4a98-a0c4-f159153a6e2e`. Always
confirm `wrangler whoami`, pending migrations, and the exact Git revision first.

## Current scope and limitations

- Catalog version `2026-08-11.2` represents 949 released National Pokédex species as
  one standard form each, based on the reviewed 2026-08-11 snapshot. It is not a catalog
  of every regional, costume, gender, Mega, Dynamax, Gigantamax, or alternate form.
- Sprite paths are explicit and pinned to a PokeMiners commit. A sprite's existence is
  not proof that a form, Shiny, Shadow, or other category is released or eligible.
- Trade requests are limited to Normal, Shiny, XXL, XXS, and generic Costume. Recorded
  offers may combine Shiny, XXL, XXS, and Costume; an empty trait set means Normal.
  Hundo, Lucky, Shadow, and Purified are excluded from trade matching.
- Generic Costume is a species-level candidate request, not a cataloged costume form.
  Pokémon GO cannot distinguish every costume exactly, so visual review is required.
- Generated missing, wanted, and recommended strings begin with `!traded&`. Personal
  XXL/XXS strings include eligible earlier evolution stages when evolving them could
  fill a later size-Dex gap.
- Trainer state is local to one browser and does not sync across phones, computers, or
  browser profiles. Clearing site data removes it, so users should export CSV backups.
- D1 remains the shared catalog source. A browser holding the former access key performs
  a one-time import of that legacy D1 collection when no local state exists.
- The browser never receives a D1 binding; only the shared catalog is read through the
  same-origin Worker API.

See [Architecture](docs/ARCHITECTURE.md) for the data/security design,
[Deployment](docs/DEPLOYMENT.md) for the Cloudflare runbook, and
[Catalog notes](catalog/README.md) for provenance and synchronization rules.

## Official platform references

- [React on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
