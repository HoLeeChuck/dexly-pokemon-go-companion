# CatchGrid Cleanup and Optimization Report — August 2026

## Scope and baseline

Work began from `main` commit `e9903f8d3bdbed072b61f332ac5687a604c51334` on
`codex/catchgrid-cleanup-optimization`. The baseline client emitted one JavaScript chunk
(307,210 bytes; 94,345 gzip) and one CSS chunk (99,394 bytes; 19,548 gzip). The service
worker precached both generated assets.

## Removed and refactored

- Deleted retired `CommunityHome.tsx`, `TradePage.tsx`, `typeTheme.ts`, visual
  `shared/searchBuilder.ts`, and the builder-only test.
- Removed exclusive `.smna-*`, retired Trade, and visual-builder selectors and discarded
  React trade setters. Historical trade/wanted profile data remains losslessly portable.
- Centralized accent IDs and contract-tested the pre-React bootstrap allowlist.
- Reduced `App.tsx` from 1,665 to about 1,200 lines. Routing/scroll restoration and PWA
  updates moved to `src/app`; Dex moved to `src/routes/DexRoute.tsx`.
- Added one memoized catalog index and one category-aware regional-medal utility shared by
  Home and Dex.
- Split public catalog, collection, private owner/import, and retained legacy-trade clients.
- Lazy-loaded Dex, Search, Profile/Data, detail, sprite, owner API, and Cody Cloud sign-in
  chunks. Search, Profile, and detail styles load with their features.
- Replaced redundant manual `public/` copying with Vite's native behavior while preserving
  custom service-worker release/asset injection.

## Bundle measurements

| Metric                     |    Before |     After |       Change |
| -------------------------- | --------: | --------: | -----------: |
| Initial JavaScript raw     | 307,210 B | 262,037 B |       -14.7% |
| Initial JavaScript gzip    |  94,345 B |  80,061 B |       -15.1% |
| Total JavaScript raw       | 307,210 B | 311,496 B |        +1.4% |
| Initial CSS raw            |  99,394 B |  60,276 B |       -39.4% |
| Initial CSS gzip           |  19,548 B |  12,464 B |       -36.2% |
| Total CSS raw              |  99,394 B |  82,309 B |       -17.2% |
| Generated JS/CSS chunks    |         2 |        12 |  route split |
| Precached generated assets |         2 |         2 | initial only |

Lazy raw/gzip JavaScript: Dex 9,615/3,218 B; Search 18,991/7,590 B; Profile
10,904/3,511 B; detail 7,360/2,490 B; Cody Cloud sign-in 1,755/854 B; owner API
357/242 B. `pnpm bundle:report` recomputes the inventory and writes it to the GitHub
Actions summary.

No render-time benchmark was claimed: the catalog optimization removes repeated full scans
by construction and is unit-tested, but no stable browser microbenchmark existed.

## PWA, release, and CI

The service worker precaches only Home-critical hashed assets and runtime-caches lazy route
chunks after visits. Catalog fallback, offline navigation, explicit `SKIP_WAITING`, private
API exclusion, and `/cody` exclusion remain. The PWA test establishes control, revisits lazy
Dex online, then verifies it offline.

Production preflight now validates source, builds once with final metadata, reports and
dry-runs that artifact, bookmarks D1, migrates, deploys the same artifact, and smoke-tests.
The deploy step no longer rebuilds.

CI changes from six jobs (quality plus five browser jobs) to three: `quality`,
`browser-chromium` (mobile, desktop, PWA), and `browser-webkit` (mobile, desktop). Branch
protection must replace the five old browser contexts only after the new PR checks exist.

## Compatibility deliberately retained

All immutable migrations/catalog provenance, `dexly-db`, `dexly-db-staging`, Worker
`dexly-companion`, repository slug, Workers.dev migration notice, `dexly:*` keys, one-way
profile migration, corrupt preservation, snapshots, full JSON backups, existing collection,
wanted and trade arrays, `/cody`, owner D1 profile, private wanted/trade endpoints,
authentication/rate limits, security headers, bookmarks, migration ordering, and rollback
commands remain.

## Validation and limitations

Unit/Worker coverage includes migration/recovery, backup/restore, wanted/trade retention,
catalog indexes/medals, routing, themes, collection/undo, forms, CSV, and private APIs.
Playwright covers public routes, owner flow, responsive overflow, accessibility, detail/type
hooks, install/update/offline, and private-cache exclusion.

On this Windows host, Playwright's preview-server teardown can remain alive after every test
has reported completion; CI is the authoritative clean-exit result for Chromium and WebKit.
Shared responsive/theme overrides intentionally remain global rather than risking a styling
system rewrite. No production Cloudflare deployment is made from this review branch.
