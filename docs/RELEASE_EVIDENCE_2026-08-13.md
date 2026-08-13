# CatchGrid release evidence — August 13, 2026

This record captures observable evidence for the Phase B/public-launch release. It does not
resolve the separately documented Pokémon asset-rights question or substitute for manual
assistive-technology and production field-performance evidence.

## Source and local gates

- Release-candidate commit: `a062fb4bb37a220b2960bd85a821e154b1ea7452`
- Catalog: `2026-08-13.1`
- Static gates: ESLint, Prettier, TypeScript, and production Vite/Worker build passed.
- Automated tests: 119 unit and 39 Worker/D1 tests passed.
- Browser gates: 42 Chromium/PWA and 40 WebKit tests passed; each matrix contains two
  intentional desktop/mobile-menu applicability skips.
- Catalog regeneration reproduced `catalog.v1.json`, the change report, and migration `0009`
  byte-for-byte in a temporary directory.
- Network validation succeeded for all 2,166 unique commit-pinned sprite URLs.

## Isolated staging

- Worker: `dexly-companion-staging`
- URL: <https://dexly-companion-staging.codyleejohnson26.workers.dev/>
- D1: `dexly-db-staging` (`1f8ee380-b50d-4620-88ce-66fee539c10c`)
- Pre-release Time Travel bookmark:
  `00000002-00000002-000050c6-d814427e8c3be5a46783194784a6b593`
- Reviewed deployment version: `386e98a7-2354-474f-97d7-46b0a5b5b5c9`

All migrations through `0009_phase_b_catalog_data.sql` were already applied. Remote D1
verification returned 1,025 species, 1,202 forms, 9,616 form/category rules, 23 provenance
records, zero foreign-key violations, and a 4,128,768-byte database.

Smoke verification passed for GET and HEAD liveness, readiness, catalog version, catalog,
manifest, and robots. Health reported the exact candidate SHA and `environment: staging`;
readiness reported catalog `2026-08-13.1`. A repeated catalog request changed from edge `MISS`
to `HIT`, and the public response contained none of `profileId`, `collectionEntries`,
`wantedEntries`, or `tradeSpecimens`. Unauthenticated owner bootstrap returned 401 rather than
opening or exposing data. HTML served strict CSP, HSTS, canonical/Open Graph metadata, and the
service worker embedded the candidate SHA.

A live browser pass found no console warnings/errors or page-level horizontal overflow. The
desktop Home loaded all regional progress groups and truthful 1,025 total / 949 released / 76
unavailable counts. The mobile Dex showed the hamburger shell, three first-row cards, and the
48-card initial virtualized batch without overflow.

The rollback procedure was rehearsed against the known-compatible reviewed version and retained
the exact candidate SHA plus healthy D1 readiness. An older pre-Phase-B staging version was also
tested and produced Cloudflare 1101; it is therefore explicitly **not** an approved rollback
target. Operators must select a version already verified against migrations 0008/0009 rather
than blindly choosing the immediately preceding historical version.

## Production

Production migration, bookmark, deployment, and canonical/legacy-origin smoke evidence are
pending until the reviewed branch is merged to public `main` and its required checks complete.
