# Full collection preview — September 24, 2026

## Implemented

- Removed decorative page headings and duplicate specimen label. Category, region, and form selection use compact dropdowns. XXL/XXS labels are corrected.
- Dark startup precedes rendering, persists explicit choice, and works under the existing production Content Security Policy without inline scripts or styles.
- Preserved one-tap collection changes, separate View details buttons, interactive map, exact completion checks, filled rainbow completion markers, and type-color gradients in the inspector. Collection changes do not show Undo popups.
- Replaced synthetic Kanto ownership with the existing browser profile and safe persistence. Species and alternate-form entries remain separate; stable IDs are retained. A failed save does not claim success.
- Added all 1,025 species across all regions and 1,260 non-costume entries, including 57 Mega/Primal records and 17 Gigantamax records. Unreleased entries have disabled collection controls. Costumes remain pending.
- My Missing has its own category and region/form scope. Evolution mode includes ancestors of missing species even when those ancestors are already collected in that category. It adds the game's `evolve` condition; actual candy, branch, and evolution conditions still apply. Alternate-form evolution searches are disabled.
- Build my own retains general query filters. Removed Daily Review and the collection-carried popup. Existing recommendations and advanced tools remain reachable through the original Search Lab.
- Legacy moves has dated official event links and device-local window status. It is a limited reviewed list, not a live or exhaustive feed; featured-move windows and Elite TM availability are distinct.
- Settings exports complete profile JSON and Excel-readable canonical CSV. Imports require review; JSON uses the existing restore/recovery flow, CSV merges through the existing import validator. Stale reviews are rejected if the profile changes. Unrelated profile fields are preserved.
- Added the preview as a second production-build entry; the root interface remains intact.

## Dated catalog corrections

The August 24 baseline remains immutable. Preview overlay `design/prism/catalog-review.js` applies these September 24 findings:

- Maschiff and Mabosstiff released; Shiny Flamigo released: [Mega Squads announcement](https://pokemongo.com/en/news/mega-squads-2026).
- Mega Staraptor released September 19, with shiny supported: [Super Mega Raid Day](https://pokemongo.com/news/staraptor-super-mega-raid-day-2026). Fighting/Flying typing checked against [Pokemon.com](https://www.pokemon.com/uk/pokedex/staraptor). Artwork is explicitly marked representative.
- Shiny Gigantamax Cinderace is not released as of this review. Its announced first release is October 3: [Max Battle Day](https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026). This corrects the baseline's inherited shiny status and does not automatically activate future releases.
- Upcoming October shadows and shiny releases were not enabled early.

Legacy window sources: [Gible Classic / Earth Power](https://pokemongo.com/news/communitydayclassic-gible-september-2026) and [Zorua / Sucker Punch](https://pokemongo.com/news/communityday-october-2026-zorua).

## Validation

- Unit suite: 152 passed, including nine new storage/import/evolution checks.
- Worker suite: 40 passed.
- ESLint, TypeScript build check, Vite production build: passed.
- Baseline catalog verification and Pokemon data validation: passed; immutable generator output unchanged.
- Browser: full 1,025-species Dex renders; category/form selection and disabled future shiny controls checked. Mobile 390 x 844 has no horizontal overflow. Dark startup and rendering passed with actual production CSP headers and no console errors.
- On an isolated local origin, imported a two-entry CSV, applied review, reloaded, and confirmed both species and independent Mega ownership persisted. The user's preview-origin collection was not used for mutation tests.
- Existing full end-to-end suite was not rerun in this update; see HANDOFF.md for earlier baseline results.

## Remaining release gates

The bulk released/shiny/shadow cross-check feeds each returned HTTP 403; see `catalog-review/crosscheck.json`. Official announcements support the targeted corrections above, but the complete catalog has not been freshly recertified. Structural validation is not current release verification. Evolution-family data is still the existing August snapshot.

The preview is local and has not been deployed to dex.cjdev.app. Before promoting it to the root interface, finish broad eligibility review, consolidate reviewed catalog changes into the canonical source and a new migration, validate offline/service-worker and existing theme parity, rerun production-path end-to-end checks, and smoke-test the intended live URL. Do not edit historical migration 0011.

The preview bundle contains the full catalog (about 1.2 MB minified / 77 KB gzip) and triggers the build chunk-size warning. It renders all matching cards; pagination or virtualization and slower-device performance checks remain worthwhile before launch. This is not a physical-device or public-launch acceptance record.
