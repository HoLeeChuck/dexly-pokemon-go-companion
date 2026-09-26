# CatchGrid repository instructions

## Source of truth and scope

- This directory is the official CatchGrid project for `https://dex.cjdev.app/`. Do not merge it with PokeNext, PokeBotSuite, or other sibling projects.
- Read `README.md` and `HANDOFF.md`. Current user instructions and source take precedence over Git history.
- Public product: the plain-module app in `app/` (Home, Dex, Progress, Search Lab, Settings, `#compare`). The React app in `src/` serves only the private `/cody` route; keep it working.
- Retired: Events, Field Kit, and the `/advanced/` page. Do not restore their routes, feeds, caches or entries. Search Builder is retained.
- Do not reintroduce SMNA branding, public trading boards, public account login, or game-account automation. Compare links stay peer-to-peer in the URL fragment: nothing uploaded or stored server-side.

## Preserve behavior and data

- Inspect Git status before editing; preserve unrelated work. Do not reset, clean, or broadly stage the repository.
- Preserve `.dev.vars`, `.wrangler/state`, local profiles, stable form IDs, immutable migrations, and CSV/JSON backup compatibility. A different browser origin can show different data.
- Public profiles are browser-local; private owner D1 storage stays separate. Keep reviewed import/restore, recovery snapshots, durable-first writes, and fail-closed storage errors. Bulk changes (paint mode, region setup) save once and create a snapshot first.
- National Dex totals and medals count default representatives, not alternate forms. Preserve unreleased/unknown distinctions and catalog provenance. Artwork is not proof of game availability.
- Missing modes are None, Personal (`!#&`), and Tradeable (`!traded&`). Keep Cody’s eight recommendations in order (Trade, Megas, Tag, Evolve, Special Moves, Untagged, XXL, XXS) with exact clipboard strings, and Discord message splitting within 2,000/4,000 characters.
- Legacy move windows are a dated, hand-reviewed list in `catalog/legacy-moves.v1.json`, not a live feed.
- Preserve light/dark appearance and accent colors, keyboard access, responsive layouts, local artwork, and explicit PWA update acceptance. Viewing details must never toggle ownership.
- The app re-renders by reconciling markup; an element can change into a different control during a click. Decide click behavior from the clicked element’s original attributes (see `probe` in `app/main.js`).

## Validation and delivery

- Use the lockfile; do not upgrade dependencies as part of routine fixes.
- Run relevant unit/Worker tests, lint, type/build checks, and desktop/mobile browser coverage for affected workflows. Use catalog validators when data changes.
- Fixture browser checks, local previews, live deployment, and physical-device testing are distinct evidence states.
- Update `HANDOFF.md` with actual results and remaining issues. Keep temporary task details out of this file.
- Commit, push, production migration, and deployment require explicit user authorization.
