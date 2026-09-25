# CatchGrid UI and UX audit

Date: September 23–24, 2026. Scope: current local working tree after Events/Field Kit retirement, not a certification of the public deployment.

## Executive assessment

CatchGrid has a useful foundation: local collection ownership, explicit category tracking, strong Pokémon artwork, backup/import, and a practical Search Builder. Its main weakness is hierarchy. Too much interface competes with the collection, and context does not consistently travel between progress, inspection, and search.

The opportunity is a coherent collector workflow: understand what you have, choose a gap, inspect it, and produce a useful search. A distinctive visual system should make that workflow recognizable. Adding visual spectacle alone would leave the underlying friction intact.

No critical data-loss issue was observed. One high-priority completion-calculation defect was identified from source and arithmetic. Most remaining findings concern confidence, navigation, density, and action placement.

## Method and limits

- Inspected Home, Dex, Progress, Search Lab/Builder, Settings, and Pokémon inspection at desktop and mobile sizes; reviewed their React components, styles, and state boundaries.
- Measured the current mobile interface at 390 × 844 CSS pixels. Saved screenshots in `evidence/`.
- Reran existing Chromium accessibility tests: 14 passed, 2 intentional platform skips. These cover the five routes, selected keyboard behavior, and serious/critical axe checks. The six-accent × two-brightness matrix covers Settings, not every route/theme combination.
- Reviewed two public collector products as limited benchmarks. This is an expert review, not interviews, usability research, an exhaustive market survey, performance profiling, or physical-device acceptance.
- Existing collection data was not changed to reproduce findings. The proposed design uses synthetic, in-memory data.
- Catalog snapshot: `2026-08-24.1`; current local endpoint has 1,269 forms. Freshness and game-search semantics require separate release validation.

## What should survive the redesign

Explicit collection edits; inspection that does not accidentally mark a Pokémon; stable IDs and category eligibility; local-first persistence and compatible backups; large recognizable art; Search Builder; neutral None, Personal `!#&`, and Tradeable `!traded&` modes; Cody’s eight ordered recommendations; all six accent families and light/dark appearance; offline behavior and explicit update handling. Retired Events and Field Kit stay retired. Preserve the private owner route without adding public account or trade systems.

## Prioritized findings

P1 means correct before release; P2 means meaningful usability or maintainability work; P3 means polish. Evidence labels distinguish confirmed behavior from design judgment.

| Priority | Finding and evidence                                                                                                                                                                                                                                                                                                                      | Recommended resolution / acceptance                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **Rounded progress can falsely indicate completion.** `src/components/SearchLab.tsx` rounds percentages and uses `>= 100` for milestone completion; regional selection filters by rounded percentage. Arithmetic reproduction: 951/952 = 99.8949%, rounded to 100 although one is missing. Source-confirmed; no live collection mutation. | Determine completion from exact counts, never display rounding. A 951/952 fixture must retain one gap and incomplete status; nearly complete regions remain discoverable.                                       |
| P2       | **“Fastest win” is unsupported.** Home/Progress infer speed from missing counts or completion, without availability or acquisition difficulty. Home and Progress also rank regions differently. Confirmed copy and source in `HomeDashboard.tsx`, `collectionProgress.ts`, and `SearchLab.tsx`.                                           | Say “fewest missing species” or “closest by completion,” disclose the criterion, and let the collector choose. Do not imply currently catchable Pokémon.                                                        |
| P2       | **Category context splits in Progress.** Clicking Shiny changes the focus summary while the regional category select remains Normal. Browser reproduction confirmed; `focusCategory` and `regionalCategory` are separate state.                                                                                                           | Use one explicit category scope, or visibly label independent comparisons. Carry it into gap lists and search.                                                                                                  |
| P2       | **Mobile Dex spends half the first screen on controls.** At 390 × 844 the first tile starts at about 425px. Desktop exposes both a category rail and dropdown. Confirmed geometry; visual hierarchy judgment.                                                                                                                             | Compress introductory content, use one primary category control, and progressively reveal advanced filters. Keep names and states readable. Prototype first tile starts at about 350px under the same viewport. |
| P2       | **Search Builder pushes its result and existing workflows too far down.** Current mobile Copy begins at 1,139px; My Missing begins around 1,306px and recommendations around 2,242px.                                                                                                                                                     | Place generated output near intent selection, with explicit navigation among Builder, My Missing, and recommendations. Prototype default Copy starts around 440px; long queries naturally require more room.    |
| P2       | **Builder clipboard failure is silent.** `AdvancedSearchBuilder.tsx` catches failure by clearing copied state, without feedback or fallback. Source-confirmed; OS denial was not forced.                                                                                                                                                  | Announce failure, keep selectable output, and provide manual-copy guidance. Only announce success after clipboard resolution.                                                                                   |
| P2       | **Builder draft does not survive route unmount.** Component-local state owns the draft. Source-confirmed.                                                                                                                                                                                                                                 | Keep a session draft when moving between routes; explicitly define reload behavior. Do not change collection backup schemas merely to store UI drafts.                                                          |
| P2       | **Composite “score” is hard to interpret.** Progress averages percentages from categories with different denominators. This can make an ordinary species collector appear unsuccessful. Source-confirmed calculation; comprehension risk is a heuristic finding.                                                                          | Prefer an exact category fraction. If retaining the composite, explain equal weighting and denominators and make it secondary.                                                                                  |
| P2       | **Settings visual and DOM order differ.** Bulk tools precede appearance in DOM while CSS puts appearance earlier visually. Confirmed source and rendered heading positions.                                                                                                                                                               | Put DOM in intended reading order and reduce CSS order overrides. Manually verify keyboard traversal after refactoring. Do not infer a complete keyboard failure from geometry alone.                           |
| P2       | **Wanted is an orphaned public filter in inspected flows.** Dex offers Wanted using legacy state, but inspected detail controls do not expose a matching wanted action.                                                                                                                                                                   | Preserve stored legacy data. Decide whether to explain imported intent or hide the filter from the normal workflow. This does not authorize a public trade system.                                              |
| P2       | **Empty-state hierarchy is discouraging.** Zero scores, hundreds of missing entries, and optimization advice dominate before a new collector has established data. Heuristic assessment; Home does already offer start/import actions.                                                                                                    | Let first-run Home prioritize start or import, explain local storage once, and defer comparative advice until useful.                                                                                           |
| P2       | **Styles have accumulated overlapping layers.** Base `styles.css` exceeds 4,100 lines, alongside substantial Home, Dex, Progress, and enhancement styles. Source-confirmed; this is not a measured performance defect. Progress is also exported from the Search Lab module.                                                              | Migrate by route using shared tokens and explicit component ownership. Remove superseded selectors only after parity checks; avoid a global rewrite.                                                            |
| P3       | **Repeated framing reduces information density.** Eyebrows, large headings, cards, gradients, rings, and repeated statistics compete across pages. Design judgment, not a contrast-failure claim.                                                                                                                                         | Reserve display typography for orientation and major moments; make actual collection work compact. Use spacing and typography before adding more boxes.                                                         |
| P3       | **Denominators need plain-language scope.** Released/obtainable species and all catalog forms legitimately produce different totals.                                                                                                                                                                                                      | Label species versus forms, eligibility, and unreleased entries close to counts. Do not describe different valid totals as corruption.                                                                          |
| P3       | **Backup confidence could be clearer.** Settings already explains local storage and exposes export.                                                                                                                                                                                                                                       | Preserve that prominence. Distinguish an export request/download from proof that a backup was safely saved or restored.                                                                                         |

## Route assessment

**Home:** useful start/import entry points; should help people resume their chosen activity. Avoid an elaborate dashboard before meaningful collection data exists. A returning collector should see a specific last-used collection scope, not an unsupported acquisition recommendation.

**Dex:** the core utility. Preserve searchable names/numbers, eligibility, explicit quick-edit mode, and accessible inspection. Prioritize visible Pokémon and stable context. Advanced filters can expand on demand; never silently change category when moving into details.

**Progress:** make the collection itself the primary visualization. Exact counts must govern completion. Regional/category comparisons should state their units. Missing species should be one step away, with the same category retained.

**Search Lab:** preserve the powerful existing modes and recommendations while separating them into legible sections. Show the exact query, explain the current scope, and handle empty output and clipboard failure. A collection-to-query link should carry exact intent, not merely navigate to an empty builder.

**Settings:** strong existing data-care foundation. Put appearance, data export/import, and destructive/bulk tools in a logical DOM sequence. Keep destructive operations visually and behaviorally distinct.

**Details:** preserve non-mutating navigation, explicit category controls, and large artwork. A desktop inspector/mobile dialog can give context without making the whole page a gesture target. Collection changes need visible feedback and undo.

## Competitive reference

[PokéPC’s own site](https://classic.pokepc.net/) presents living-Dex tracking, box organization, forms, and shiny mode. The inspected public [PokédexTracker](https://pokedextracker.com/) collection exposes name/number search, Hide Caught, completion, and numbered species groups. Those capabilities establish familiar conventions, not evidence of a novel invention.

CatchGrid’s proposed distinction is how a stable collection map, category lens, specimen inspection, and exact search handoff work together. This review cannot establish that no one has implemented similar ideas, nor predict endorsement by Pokémon.

## Validation and evidence

Current-interface screenshots: `evidence/current-mobile-{home,dex,progress,search,settings}.png`.

Prototype screenshots: `evidence/prism-desktop-progress.png`, `evidence/prism-mobile-dex.png`, `evidence/prism-mobile-search.png`.

Prototype checks: Normal→Shiny updates map and art; selected missing species opens inspection; explicit mark and undo restore state; contextual missing IDs enter Search; custom `age0` is appended and exact clipboard output verified. No console errors observed in the inspected session. Progress has no horizontal overflow at 320, 768, or 1440px; mobile Dex/Search checked at 390px. This is not a full cross-browser or screen-reader certification. Prototype lint and formatting passed.

## Recommended sequence

1. Repair completion logic and misleading recommendation labels independently of visual migration.
2. Review the Prism concept through real tasks, including a first-time collector and a large existing collection.
3. Implement shared tokens/navigation and Dex/inspection first, keeping storage contracts stable.
4. Connect Progress and Search with a shared scope model, then refine Home and Settings.
5. Verify all themes, keyboard/screen-reader behavior, import/export, offline/update handling, full-catalog rendering, and physical mobile devices before a separately authorized release.
