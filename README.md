# Dexly

Dexly is a visual Pokémon GO collection companion built with React, TypeScript, Vite,
Cloudflare Workers, and D1. It tracks collection categories, wanted entries, trade
specimens, CSV imports, undoable changes, and Pokémon GO search-string candidates.

> **Status:** the local MVP is implemented, but it is not deployed. The checked-in D1
> identifier is a placeholder. Deployment still requires the owner's Cloudflare account,
> repository, Worker/database naming, access-secret, and optional domain decisions.

Dexly is an unofficial fan project. It is not affiliated with or endorsed by Niantic,
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
`.wrangler/state` and is separate from every remote D1 database.

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
| `node scripts/verify-sprites.mjs`           | Validate the versioned catalog and sprite manifest offline.               |
| `node scripts/verify-sprites.mjs --network` | Also send opt-in checks to pinned sprite URLs.                            |
| `pnpm db:migrate:production`                | Apply migrations to the configured remote D1 database.                    |
| `pnpm deploy:production`                    | Build, migrate remote D1, then deploy. This changes production.           |

The last two commands are intentionally explicit. Do not run them until
`wrangler.jsonc` contains the real production D1 UUID and the target Cloudflare account
has been confirmed.

## Current scope and limitations

- The catalog is a representative seed: 23 standard forms, not a complete Pokémon GO
  Pokédex. Its gameplay metadata is a dated snapshot and can become stale.
- Sprite paths are explicit and pinned to a PokeMiners commit. A sprite's existence is
  not proof that a form, Shiny, Shadow, or other category is released or eligible.
- Pokémon GO search syntax cannot represent every form, costume, or trait exactly.
  Dexly labels generated output as exact or as a candidate list.
- Production access currently uses one shared bearer secret and one seeded profile. This
  is suitable for a private MVP, not multi-user authentication or public sharing.
- Imports create a bounded D1 backup before applying, but the MVP does not yet expose a
  backup-restore screen or endpoint.
- The browser never receives a D1 binding; collection data is read and changed only
  through the same-origin Worker API.

See [Architecture](docs/ARCHITECTURE.md) for the data/security design,
[Deployment](docs/DEPLOYMENT.md) for the Cloudflare runbook, and
[Catalog notes](catalog/README.md) for provenance and synchronization rules.

## Official platform references

- [React on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
