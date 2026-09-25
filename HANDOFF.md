# CatchGrid current handoff

## Latest: published September 24, 2026

The approved full-collection design is now the production root at https://dex.cjdev.app/. Concept bar removed. Version `6febf11c-af7e-41d4-bfc1-aa54a75fb20f`. Root/advanced/private entries and service worker verified against the local build; all 11 production smoke checks passed. Existing-installed-app Update now flow passed live. No database changes. See `docs/releases/2026-09-24/RELEASE.md` for source provenance, validation, rollback reference, and catalog follow-up. This supersedes earlier local-only/not-deployed statements below.

## Official baseline

Active project: `D:\Projects\Pokemon\CatchGrid`. User-confirmed scope on September 23, 2026: Home, Dex, Progress, Search Lab including Visual Search Builder, and Settings. Events and Field Kit are retired. The private owner route and collection/data compatibility are preserved.

This is a local working-tree baseline, based on Git commit `f9905ee213ce110863e473e5e25186c2fb3ca945` plus pre-existing and current uncommitted work. It is not a new release, commit, or claim of parity with the live deployment.

## Cleanup

- Archived all 2,128 pre-cleanup tracked/untracked non-ignored source files, verified every ZIP entry against SHA-256, and verified a Git history bundle.
- Archive: `D:\Projects\Pokemon\_Archive\CatchGrid-unfinished-2026-09-23-225053`. Its README documents recovery and exclusions.
- Removed Events/Field Kit route wiring, dedicated source/tests, event API, feed fixtures, service-worker prefetch/cache, and installed-app shortcuts.
- Retained Search Builder with Home and installed-app shortcuts. Retained default-species regional progress in `src/lib/collectionProgress.ts` without the experimental planning helpers.
- Existing experimental browser-storage keys were left untouched; old route links safely fall back to Home.
- Preserved non-retired local UI changes; they have not been represented as the deployed site.
- Repaired 562 stale junctions, then completed `pnpm install --frozen-lockfile` from the unchanged lockfile. Secrets and existing local database were not reset or migrated.
- Replaced stale orientation instructions with a clear active-project guide and durable `AGENTS.md`.

## Validation

- `pnpm test:unit`: 143 passed.
- `pnpm test:worker`: 40 passed against isolated test storage.
- `pnpm lint`, `pnpm build`, `pnpm catalog:verify`, `pnpm validate:pokemon-data`, and `git diff --check`: passed.
- Chromium desktop/mobile/PWA: initial run 63 passed, 2 intentionally skipped, 1 stale mobile assertion still expecting Field Kit. Corrected that assertion; it passed on targeted rerun. Added desktop/mobile regressions for retired links, Home-to-Builder navigation, composed query, no event-feed requests, and no collection writes; both passed. Across runs, 66 distinct cases passed and 2 platform-specific cases were intentionally skipped.
- After removing unused feature CSS, all 5 affected Home/Builder desktop/mobile checks passed again; the production artifact was rebuilt successfully.
- Full-catalog local preview: `http://127.0.0.1:5173/#/search?section=search-builder`; catalog endpoint verified version `2026-08-24.1`, 1,269 forms. Search Builder visually reviewed. This browser has its own local collection; it is not proof of the user's existing collection count.
- Built client/Worker inspected: no EventsPage, FieldKitPage, event-feed endpoint, or retired install-shortcut references.
- `pnpm format`: four pre-existing historical-document warnings only: `docs/consolidation-2026-09-16/{attachment-inventory.json,conversation-inventory.json,file-inventory.json,REPORT.md}`. Their bytes were verified unchanged against the pre-cleanup archive. Edited files pass targeted formatting checks.
- WebKit and physical-device checks were not run in this cleanup. No current production acceptance claim.
- Host validation used Node 24.19.0 and pnpm 11.19.0; package manager pin remains unchanged at 11.21.0.

## Next work

### UI/UX audit and Prism design study (September 23–24)

Completed an expert audit of the five active public destinations and inspection flow. Findings and evidence are in `docs/design-2026-09-23/UI-UX-AUDIT.md`; the proposed design and migration criteria are in `DESIGN-DIRECTION.md` alongside it. Highest-priority finding: rounded percentages can incorrectly trigger completion; it is documented, not repaired in this design-only turn.

Built an isolated clickable concept in `design/prism/`, previewed at `http://127.0.0.1:5173/design/prism/#progress`. It demonstrates a stable collection map, category lenses, explicit inspection/mark/undo, and contextual Search Builder. Uses synthetic in-memory Kanto ownership and existing local art, with no real collection writes. Production interface was not replaced. Browser interaction checks and prototype lint/format passed; current app accessibility rerun: 14 passed, 2 intentional skips. Review the concept before a route-by-route production migration; preserve all existing themes, data contracts, and Search Lab recommendations.

Continue the user's final UX changes in this project. Review the retained local design in preview before deciding what to release. Catalog freshness, production smoke/operational checks, physical-device testing, and deployment are separate follow-up work; this cleanup does not claim public-launch acceptance. No commits, pushes, production migrations, or deployment were performed.

### Prism quick-selection refinement — September 24

User approved the design direction and requested one-tap selection, interactive map, rainbow completion borders, and official type colors. Implemented in `design/prism/`: tile/category one-tap toggles with undo and eligibility guards; separate non-mutating inspection; labeled map buttons; all-eligible-category completion borders; single/dual-type backdrops using verified Pokémon.com Pokédex base colors. This supersedes the initial prototype's separate Mark button. Browser checks covered toggling, completion/undo, single/dual-type gradients, and mobile map-to-dialog navigation; lint and formatting passed. Still isolated in-memory demo, no production migration or deployment.

Prism follow-up: removed colored glow and collected-state tint from Dex tiles; retained type gradients in the detail inspector and rainbow completion borders. Renamed tile Inspect action to View details to clarify the separate detail-opening target.

Prism refinement: removed inline Undo/helper text and collection-change popup per user request. Collection changes now give screen-reader-only announcements; copy feedback remains visible. Progress uses empty slots, collected checks, and filled rainbow-bordered stars for all-eligible-category completion, with matching category indicators. Browser verified no Undo/helper elements, visually hidden change announcement, and completed Charizard marker; prototype lint/format passed. Tap again reverses collection selection.

## September 24 full collection update — current state

The Prism preview now uses the real existing local profile, all regions, and the full supported-form catalog. This supersedes the historical in-memory/Kanto descriptions above. It includes dark-first persisted appearance, compact dropdowns, simplified evolution-aware My Missing searches, dated legacy move windows, and reviewed JSON/CSV import/export. Costumes remain pending. See `docs/design-2026-09-23/FULL-COLLECTION-UPDATE.md` for the authoritative implementation, source corrections, validation, and remaining gates.

Validation: 152 unit tests and 40 Worker tests passed; lint, TypeScript, Vite build, and baseline catalog validations passed. Browser checks include mobile layout, isolated-origin import/persistence, full Dex rendering, and production-CSP dark startup. No deployment or root-interface replacement occurred. Full release eligibility recertification remains incomplete because bulk feeds returned HTTP 403; targeted official-source corrections live in a dated preview overlay. Offline/theme parity and production-path end-to-end validation remain promotion gates.

## September 24 interaction polish — local, not deployed

Audited the five public surfaces and linked advanced settings. Replaced wholesale DOM rebuilding with keyed updates in `design/prism/dom.js`, preserving images, controls, focus, and disclosure state. Category ownership now uses a highlighted card border/check, with rainbow/star only for full completion. Fixed scoped detail arrows, search draft loss, filtered focus fallback, padded-number search, mobile density/control order, and map keyboard navigation. See `docs/ux-polish-2026-09-24/AUDIT.md` for evidence and prioritized remaining findings.

Full-grid browser observation: all 1,026 images retained on a collection mark, zero added/removed/source changes; inspecting another Pokémon changes only one source. Six browser renderer regressions and 152 unit tests passed. Built/lint/type checks performed. Local preview on 5194; no new deployment in this audit turn. Production remains version `6febf11c-af7e-41d4-bfc1-aa54a75fb20f`.

## 2026-09-24 - Related Mega / G-Max collection controls (local)

- Base Pokemon inspectors now list only their catalogued Mega, Primal and Gigantamax forms beneath the eight base category controls. Transformation rows retain existing Normal/Shiny records and stable IDs; no data migration or automatic ownership copying.
- Non-default form inspectors expose only Normal/Shiny. Dedicated forms filters likewise restrict categories and reset an incompatible base category to Normal.
- Base completion and National Dex totals remain unchanged; each form retains its own completion border. Unreleased/unknown rules remain enforced. Catalog availability was not recertified in this UI change.
- Validation: 153 unit tests pass, including independent base XXL/Mega/G-Max storage and rejection of Mega XXL; lint, TypeScript and Vite build pass (existing large bundle warning). Browser verified Charizard's three related forms and existing saved Mega X state, narrow-screen dialog layout, and XXL-to-Mega filter reset with only Normal/Shiny controls.
- Not deployed. Clarification was requested about single registration versus separate Normal/Shiny form checks; absent an answer, retained the existing separate checks without changing saved data semantics.

## 2026-09-24 - Collection interaction design refinement (local)

- Replaced inspector checkbox marks with original category glyphs. Ownership is conveyed by one filled violet surface, without a redundant selected border/check. Base and related transformation controls share this treatment; ARIA pressed states and spoken save feedback remain intact.
- Removed redundant card check badges while retaining category borders and completed rainbow borders. Rounded card and related-form surfaces and refined spacing.
- Added bounded pointer parallax to artwork and its type disc, using one animation frame per pointer update. Hit targets stay stationary. No device sensors, touch parallax, scroll interception or continuous animation. Reduced-motion changes cancel/reset motion; pointer exit/window blur reset artwork.
- Validation: lint, 153 unit tests, TypeScript and production build pass (existing chunk size warning). Narrow-screen browser screenshot reviewed; actual Normal toggle changed false/true and original state restored; no browser error logs. Physical-device motion and subjective desktop pointer feel are not independently verified.
- Local preview only; not published.

## 2026-09-24 - Deeper design study, not another app patch

- Compared Field Archive, Orbital Dex and Prism Atlas; recommended Prism Atlas with archive typography and restrained optical depth. Detailed reasoning and adoption criteria: docs/design-2026-09-23/DESIGN-STUDY-2026-09-24.md.
- Separate interactive study at /design/study/ with nine sample Pokemon, three visual treatments, independent in-memory collection states and completion spectrum. It reads/writes no real collection data and is not a production build entry.
- Verified all three direction selectors, selected Pokemon changes, category toggles, 8/8 completion with atlas count, loaded artwork, no browser errors; desktop screenshot reviewed. Narrow viewport DOM measured 375px with no page overflow and 54px category targets; browser resizing produced inconsistent screenshot painting, so final mobile visual acceptance remains pending. Temporary viewport override reset.
- Study ESLint and Prettier checks pass. No production app edits or deployment in this design-study turn.

## 2026-09-24 - Approved Prism Atlas integrated into public app (local)

- Applied the approved quiet gallery direction to Dex, details, Progress, Search Lab, Home and Settings. Neutral charcoal surfaces, lighter typography and restrained control borders replace the earlier purple control-card treatment. Explicit light appearance remains available; dark remains the persisted default.
- Detail category controls are labeled 56px tap targets with engraved/illuminated tracks. No checkbox glyph or redundant selected box. Completed eligible category groups form a sequential spectrum; base and Mega/G-Max groups remain separate. Unavailable tracks are dashed and disabled. Existing category-specific grid borders and completed rainbow borders remain.
- Progress uses illuminated filled slots and centered Dex numbers instead of duplicate check/star symbols. Search terms use underlined selected states; generated text has a quiet solid output panel. Home and Settings share the palette, spacing and typography. File input now wraps within narrow cards.
- Artwork depth is confined to the inspector. Inspection gets a 260ms arrival animation from the source artwork's location when visible; this is an arrival transition, not a full reversible shared-element navigation system. Quick marks do not invoke it. Reduced motion skips arrival and parallax; no sensors, continuous animation or moving hit targets.
- Preserved all data contracts, eligibility, search semantics, storage/import/export, stable image reconciliation, private owner and advanced routes. No catalog or Worker changes.
- Validation: 153 unit tests, lint, TypeScript, Vite build pass; existing large-bundle advisory remains. Browser QA used isolated localhost:5194 profile: completed Charizard's eight categories; verified completed grid and map states, independent form controls, search string age0&!#&shiny, Home counts and Settings actions. Real user's 127.0.0.1 profile was not modified by this QA.
- Desktop screenshots reviewed for Dex and Search. Mobile screenshots reviewed for Home, details, My Missing, Settings; widths 375/375 with no page overflow after fixing backup picker; category targets 56px, export buttons 44px, ineligible Eevee Shadow/Purified disabled. No browser error logs. Actual physical-device motion and reverse shared-element animation are not certified.
- Local only; not committed, pushed or deployed. Study remains separate at /design/study/ for historical comparison.

## 2026-09-24 - Atlas finishing pass (local CSS)

- Unified system typography, segmented navigation/status filters, control radii, spacing, hover/press/focus states, and panel geometry. Kept collection segments and rainbow completion.
- Progress has clearer header spacing and tabular numbers, a restrained scrollbar, and map targets at least 44px wide/high instead of narrow desktop cells. Mobile header wraps deliberately; map remains independently scrollable.
- Verification: Prettier and Vite build pass (existing chunk-size warning). Browser screenshots reviewed at 413px and 1425px content widths with no horizontal overflow; mobile map targets measured 47.7 x 44px. Menu opened and Progress navigation worked after refreshing the long-running development tab. No collection mutations in this pass; no JS/storage/catalog/Worker changes, so domain tests were not repeated.
- Local only, not deployed.

## 2026-09-24 - Prism Atlas published

User approved live release. Deployed version 9b19b937-8ff5-4a67-8c7f-ca13d5e4dfaa to dex.cjdev.app; previous version 6febf11c-af7e-41d4-bfc1-aa54a75fb20f retained for rollback. 153 unit / 40 Worker tests and 11 production smoke checks pass; live artifact bytes match and live browser verified the new design. No migrations. See docs/releases/2026-09-24-atlas/RELEASE.md for full evidence and disclosed legacy-format/e2e limits. Supersedes preceding local-only status for the approved design work.
