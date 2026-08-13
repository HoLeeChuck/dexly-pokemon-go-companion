# CatchGrid release evidence — August 13, 2026

This record captures observable evidence for the Phase B/public-launch release. It does not
resolve the separately documented Pokémon asset-rights question or substitute for manual
assistive-technology and production field-performance evidence. Cloudflare Web Analytics
enablement and delivery were not verified and are not claimed here.

## Reviewed source and required checks

- Pull request: [#2](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/pull/2)
- Protected `main` merge commit: `9eb839e3c971bfee8dd3d972a6803e3a90a8dae1`
- Merge timestamp: `2026-08-13T09:13:08Z`
- Required-check run:
  [31685587736](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/31685587736)
- Catalog: `2026-08-13.1`

All six required checks were green for the exact merge commit:

- `quality`
- `browser-mobile-chromium`
- `browser-desktop-chromium`
- `browser-mobile-webkit`
- `browser-desktop-webkit`
- `browser-pwa-chromium`

Branch protection requires pull requests and strict/current required checks with all six
contexts. Force pushes and branch deletion are disabled. Required approving reviews are set to
zero, and administrators retain bypass authority.

The reviewed local gates included ESLint, Prettier, TypeScript, the production Vite/Worker
build, 119 unit tests, 39 Worker/D1 tests, 42 Chromium/PWA tests, and 40 WebKit tests. Catalog
regeneration reproduced `catalog.v1.json`, the change report, and migration `0009` byte-for-byte
in a temporary directory. Network validation succeeded for all 2,166 unique commit-pinned
sprite URLs.

## Isolated staging

- Worker: `dexly-companion-staging`
- URL: <https://dexly-companion-staging.codyleejohnson26.workers.dev/>
- D1: `dexly-db-staging` (`1f8ee380-b50d-4620-88ce-66fee539c10c`)
- Pre-release Time Travel bookmark:
  `00000002-00000002-000050c6-d814427e8c3be5a46783194784a6b593`
- Final staging deployment version: `0977a8ee-57d6-4cb4-9dda-291f88b622e6`
- Final staging source: `29dbbb0078c0379ec16ba2637caaf07f311b46fa`

All migrations through `0009_phase_b_catalog_data.sql` were applied. Remote D1 verification
returned 1,025 species, 1,202 forms, 9,616 form/category rules, 23 provenance records, zero
foreign-key violations, and a 4,128,768-byte database.

Smoke verification passed for GET and HEAD liveness, readiness, catalog version, catalog,
manifest, and robots. Health reported the reviewed staging source and `environment: staging`;
readiness reported catalog `2026-08-13.1`. A repeated catalog request changed from edge `MISS`
to `HIT`, and the public response contained none of `profileId`, `collectionEntries`,
`wantedEntries`, or `tradeSpecimens`. Unauthenticated owner bootstrap returned 401. HTML served
strict CSP, HSTS, canonical/Open Graph metadata, and the service worker embedded the reviewed
source.

A live browser pass found no console warnings/errors or page-level horizontal overflow. The
desktop Home loaded all regional progress groups and truthful 1,025 total / 949 released / 76
unavailable counts. The mobile Dex showed the hamburger shell, three first-row cards, and the
48-card initial virtualized batch without overflow.

The rollback procedure was rehearsed against a known-compatible Phase B staging version and
preserved the exact reviewed source plus healthy D1 readiness. An older pre-Phase-B version was
also tested and produced Cloudflare 1101; it is explicitly **not** an approved rollback target.
Operators must select a version already verified against migrations 0008/0009 rather than
blindly choosing the immediately preceding historical version.

## Production

### Resources and recovery anchors

- Worker: `dexly-companion`
- Canonical URL: <https://dex.cjdev.app/>
- Legacy URL: <https://dexly-companion.codyleejohnson26.workers.dev/>
- D1: `dexly-db` (`154ac34c-cdfc-4a98-a0c4-f159153a6e2e`)
- Pre-release D1 Time Travel bookmark:
  `0000004d-00000000-000050c6-f350d0f7c5a996f42d9c0acc5fdeb656`
- Pre-release Worker version: `29527517-4516-4120-ac5b-50bff638126c`
- Post-release/current D1 Time Travel bookmark:
  `00000051-00000000-000050c6-e3cea36aec1c842c0d76b87830373458`
- First Phase B deployment ID: `c9951767-1a26-44ed-a5a4-e860034092a4`
- First fully smoked Phase B production version:
  `5d008ae6-711e-4098-b6bf-80e15f1ccfd2`
- First Phase B deployment timestamp: `2026-08-13T09:18:03Z`
- Final anchor deployment ID: `3e7d987c-57dd-4912-8c6a-22df0a0ded37`
- Final duplicate anchor and current production version:
  `0f533154-80ca-44c0-9edb-cd7be4ad4ab5`
- Final anchor deployment timestamp: `2026-08-13T09:26:37Z`
- Deployed Git SHA: `9eb839e3c971bfee8dd3d972a6803e3a90a8dae1`

The first Phase B version passed the complete production smoke sequence and is retained as the
known migrations-0008/0009-compatible Worker rollback target. The final duplicate deployment
created a current production anchor with the same reviewed source; its exact Git SHA, build
metadata, Worker runtime version, and `environment: production` value were verified.

### Database migration and verification

Migrations `0008_phase_b_catalog_schema.sql` and `0009_phase_b_catalog_data.sql` were applied to
production after the bookmark was retained. Remote verification returned:

| Check                      |  Verified value |
| -------------------------- | --------------: |
| Species                    |           1,025 |
| Forms                      |           1,202 |
| Default forms              |           1,025 |
| Released default forms     |             949 |
| Form/category rules        |           9,616 |
| Catalog provenance records |              23 |
| Foreign-key violations     |               0 |
| Database size              | 6,193,152 bytes |
| Catalog version            |  `2026-08-13.1` |

### API, cache, and security smoke

GET and HEAD returned HTTP 200 for health, readiness, catalog version, catalog, manifest, and
robots. Health and readiness returned the exact production environment, Git SHA, Worker version,
and catalog version. The public catalog response was 984,391 bytes and returned HTTP 200 in
approximately 95 ms; after warming, Cloudflare reported a cache `HIT`. The payload contained no
private profile, collection, wanted, or trade fields. Unauthenticated owner bootstrap returned
401 rather than exposing data.

The canonical HTML response served the reviewed CSP and HSTS policies, canonical and Open Graph
metadata, and the service worker contained the release's short Git SHA. No claim is made that
Cloudflare Web Analytics itself is enabled or delivering events.

### Live browser and hostname-transition smoke

The production desktop view had no page-level horizontal overflow, displayed all 11 regional
groups, and displayed all four collection overview groups. The 390-by-844 mobile view had no
page-level horizontal overflow and rendered a 48-card, three-column initial Dex batch. Neither
pass produced browser-console warnings or errors.

The legacy hostname remained on its `workers.dev` origin without an automatic redirect, showed
the correct canonical `dex.cjdev.app` migration link, and successfully downloaded a portable
JSON collection export. This verifies that users can preserve origin-scoped browser data before
moving to the canonical hostname.

## Evidence still outstanding

This release does not close the need for Cloudflare account alerts/dashboards and incident
ownership, accepted sprite-rights permission or replacement assets, manual real-device
accessibility review, or trustworthy production field Core Web Vitals. Those items remain in
the public-launch closure matrix.
