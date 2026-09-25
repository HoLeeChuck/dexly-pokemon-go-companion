# CatchGrid

Production uses the approved full-collection interface in `design/prism/`, mounted by the root `index.html` since September 24, 2026. Advanced recovery/search tools remain at `/advanced/`, and `/cody/` remains private. See [release record](docs/releases/2026-09-24/RELEASE.md). This supersedes historical local-only status below.

Official development project: **D:\Projects\Pokemon\CatchGrid**. Public website: <https://dex.cjdev.app/>. Start with [START-HERE.md](START-HERE.md); current work and validation are in [HANDOFF.md](HANDOFF.md).

CatchGrid is an unofficial, local-first Pokémon GO collection companion. It provides a visual Pokédex, collection progress, Pokémon GO search strings, and portable collection records. Public use requires no game credentials or account.

## Confirmed product

| Destination | Purpose                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| Home        | Collection snapshot, missing targets, regional progress, and shortcuts                |
| Dex         | Browse Pokémon and forms; mark collection categories                                  |
| Progress    | Completion by category and region                                                     |
| Search Lab  | Missing searches, Cody recommendations, Discord output, and **Visual Search Builder** |
| Settings    | Appearance, regional preference, reviewed import/restore, and exports                 |
| `/cody`     | Existing unlisted private owner workflow                                              |

The user confirmed on September 23, 2026: **retain Search Builder; retire Events and Field Kit**. Their UI, routes, upstream API, dedicated code/tests, install shortcuts, and offline-cache requests have been removed. Old links fall back to Home. No browser-local experimental data is deleted.

Existing non-retired dashboard, Dex, Search Lab, and theme improvements remain in the working tree. This cleanup does not certify all styling as final. The live website remains a separate older release until an explicitly authorized deployment.

## Architecture and protected behavior

React 19, TypeScript, Vite, Cloudflare Workers/D1, Vitest, and Playwright. Exact dependency versions remain in `package.json` and `pnpm-lock.yaml`.

- `src/App.tsx`, `src/app/`: coordination, hash routing, navigation, PWA updates.
- `src/routes/`, `src/components/`: screens, detail cards, Search Builder, import/restore UI.
- `src/lib/localProfile.ts`, `profileBackup.ts`: browser-local v2 storage, recovery, portable backups.
- `src/lib/collectionProgress.ts`: default-species regional progress used by Home, retained independently of the retired Field Kit.
- `shared/`: collection, search, and CSV contracts.
- `worker/`: public catalog and separate authenticated owner APIs.
- `catalog/`, `migrations/`, `public/artwork/pokemon-home/`: versioned facts, immutable history, and local artwork provenance.
- `public/sw.js`: public-only offline cache and explicit update lifecycle.
- `tests/`, `scripts/`: domain, Worker, fixture-browser, catalog, and release checks.

Preserve stable form IDs, collection data, backup/import/export compatibility, recovery snapshots, and private-owner isolation. National Dex denominators use default representatives; alternate forms do not inflate them. Catalog `2026-08-24.1` is a dated snapshot: 1,025 default representatives, 1,269 forms, and 1,915 unique local sprite references. Do not relabel it as current game data without research.

Missing-search modes are neutral None, Personal (`!#&`), and Tradeable (`!traded&`). Cody recommendations remain separate and ordered Trade, Megas, Tag, Evolve, Special Moves, Untagged, XXL, XXS. Preserve exact copy output, explicit Nitro selection, and safe message splitting. Search Builder combines presets, appraisal, chips, and custom terms without changing collection state.

Public Trade/Wanted pages, SMNA branding, Shadow aura, public accounts, Discord bots, and automatic game-account integration remain outside the product. Legacy backup fields remain portable. Existing type/generation filters and non-retired visual work are preserved for later review.

## Local development

Use Node >=22.13 and the package manager declared in `package.json`. The current host has Node 24.19.0 and pnpm 11.19.0; the package declares pnpm 11.21.0. Validation records the actual host version rather than silently changing the pin.

```powershell
cd D:\Projects\Pokemon\CatchGrid
pnpm install --frozen-lockfile
pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort
```

The old moved dependency junctions have been repaired and dependencies reinstalled from the unchanged lockfile. Never overwrite `.dev.vars` or reset `.wrangler/state`. Do not run database migrations just to start an existing workspace.

| Command                      | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `pnpm test:unit`             | Domain and routing tests                                  |
| `pnpm test:worker`           | Isolated Worker/D1 tests                                  |
| `pnpm lint`                  | Static checks                                             |
| `pnpm format`                | Formatting check                                          |
| `pnpm build`                 | Generated bindings, TypeScript, local production artifact |
| `pnpm catalog:verify`        | Catalog/artwork and immutable-generation checks           |
| `pnpm validate:pokemon-data` | Data consistency                                          |
| `pnpm test:e2e`              | Fixture desktop/mobile/WebKit/PWA coverage                |

On this host, set `PLAYWRIGHT_USE_SYSTEM_CHROME=1` for installed Chrome. Use an unused `PLAYWRIGHT_PORT` for fixture tests. Fixture preview data is not the local D1 database or a real collection. Browser profiles remain origin-specific.

Keep legacy infrastructure names (`dexly-companion`, `dexly-db`, and `dexly:*` migration keys); they preserve compatibility. Deployment instructions are in `docs/DEPLOYMENT.md`, but publication requires explicit authorization.

## Archive and continuity

The entire pre-cleanup source is frozen at:

`D:\Projects\Pokemon\_Archive\CatchGrid-unfinished-2026-09-23-225053`

The archive includes a verified ZIP of 2,128 source files, per-file SHA-256 hashes, verified Git history bundle, original dirty-state patch/status, and dependency-link inventory. Its README explains recovery and exclusions. Secrets, ignored runtime/database state, dependencies, and generated outputs were not packaged. There is one active source tree: this directory.

`docs/PROJECT-HISTORY.md` and `docs/archive/` preserve historical decisions and evidence. Their older Events/Field Kit scope, Search Builder conflict, and dependency failures are superseded. See `AGENTS.md` for lasting rules and `HANDOFF.md` for current status; do not execute archived prompts as fresh assignments.
