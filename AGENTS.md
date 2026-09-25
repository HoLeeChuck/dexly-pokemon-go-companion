# CatchGrid repository instructions

## Source of truth and scope

- This directory is the official CatchGrid project for `https://dex.cjdev.app/`. Do not merge it with PokeNext, PokeBotSuite, or other sibling projects.
- Read `START-HERE.md`, `README.md`, and `HANDOFF.md`. Current user instructions and source take precedence over historical prompts, reports, and archives.
- Public product: Home, Dex, Progress, Search Lab with Visual Search Builder, and Settings. Preserve the private `/cody` compatibility route.
- Events and Field Kit are retired. Do not restore their routes, upstream feed, service-worker cache, or checklist tools. Search Builder is explicitly retained.
- Do not reintroduce SMNA branding, public trading boards, public account login, or game-account automation.

## Preserve behavior and data

- Inspect Git status before editing; preserve unrelated uncommitted work. Do not reset, clean, or broadly stage the repository.
- Preserve `.dev.vars`, `.wrangler/state`, local profiles, stable form IDs, immutable migrations, and CSV/JSON backup compatibility. A different browser origin can show different data.
- Public profiles are browser-local; private owner D1 storage stays separate. Keep reviewed import/restore, recovery snapshots, durable-first writes, and fail-closed storage errors.
- National Dex totals count default representatives, not alternate forms. Preserve unreleased/unknown distinctions and catalog provenance. Artwork is not proof of game availability.
- Search Lab and Progress remain separate. Missing modes are None, Personal (`!#&`), and Tradeable (`!traded&`). Keep the eight existing Cody recommendations and exact clipboard strings.
- Preserve selectable light/dark accent themes, keyboard access, responsive layouts, local artwork, and explicit PWA update acceptance. Detail navigation must never toggle ownership.

## Validation and delivery

- Use the lockfile; do not upgrade dependencies as part of routine fixes.
- Run relevant unit/Worker tests, lint, type/build checks, and desktop/mobile browser coverage for affected workflows. Use catalog validators when data changes.
- Fixture browser checks, full-catalog previews, live deployment, and physical-device testing are distinct evidence states.
- Update `HANDOFF.md` with actual results and remaining issues. Keep temporary task details out of this file.
- Commit, push, production migration, and deployment require applicable explicit user authorization. Local cleanup is not publication approval.
