# CatchGrid Catalog, Forms, Regional Availability, and Artwork Update

Work in the existing CatchGrid repository at `C:\Users\CodyJ\Projects\PoGo App`. Implement this release completely, but do not commit, push, or deploy until Cody reviews the result locally and explicitly approves publishing.

## Goal

Bring CatchGrid's Pokémon GO catalog and form model up to date, correct known release/eligibility errors, add the missing collector forms listed below, introduce a privacy-conscious foundation for location-aware regional forms, and replace PokéMiners imagery with Pokémon HOME artwork sourced through Bulbagarden Archives.

The items below are user-reported requirements, not automatically authoritative facts. Verify current Pokémon GO availability, shiny availability, trade/Shadow eligibility, form names, form counts, and regional distribution against current reliable sources before changing production data. Record sources and the verification date in the repository's catalog documentation.

## User-reported catalog corrections

### Released and/or shiny availability

- Toedscool: shiny released.
- Varoom: shiny released.
- Ursaluna: shiny released. Treat Bloodmoon Ursaluna separately if it exists in the data model.
- Scorbunny: shiny released; verify whether its evolutions inherit availability.
- Sobble: shiny released; verify whether its evolutions inherit availability.
- Gossifleur: shiny released; verify whether Eldegoss inherits availability.
- Arrokuda: released; verify Barraskewda and shiny status independently.
- Toxel: released and shiny released; verify Toxtricity availability independently.
- Sizzlipede: shiny released; verify Centiskorch independently.
- Sinistea: released and shiny released.
- Snom: shiny released; verify Frosmoth independently.
- Lunala: shiny released.
- Honedge: shiny released; verify Doublade and Aegislash independently.
- Hawlucha: shiny released.
- Klefki: shiny released.
- Diancie: shiny released.

### Incorrect availability

- Clodsire: Shadow is not released. Investigate whether Shadow eligibility was incorrectly inherited from standard Wooper instead of being scoped to Paldean Wooper.
- Hisuian Sliggoo: not released. Its alternative-form entry must be unavailable rather than collectable. Verify Hisuian Goodra independently.

### Missing species forms and collector entries

- Tatsugiri: add all three official forms.
- Poltchageist: add Artisan Form; verify and model Counterfeit Form and Sinistcha forms consistently.
- Enamorus: add the missing Therian Forme while retaining Incarnate Forme.
- Toxtricity: separate Amped Form and Low Key Form.
- Sinistea: add Antique Form and retain Phony Form; verify terminology used by Pokémon GO.
- Indeedee: separate male and female forms.
- Zacian: add Crowned Sword form alongside Hero of Many Battles.
- Zamazenta: add Crowned Shield form alongside Hero of Many Battles.
- Urshifu: add Single Strike Style and Rapid Strike Style.
- Oricorio: add Baile, Pom-Pom, Pa'u, and Sensu Styles.
- Lycanroc: add Midday, Midnight, and Dusk forms.
- Vivillon: add every Pokémon GO-supported pattern, including the Scatterbug and Spewpa lineage relationships needed for accurate tracking.
- Pyroar: show male and female separately.
- Flabébé, Floette, and Florges: add Red, Yellow, Orange, Blue, and White Flower forms, with correct evolution-family mappings.
- Furfrou: add all Pokémon GO-supported Trim forms and their regional/event availability metadata.
- Pumpkaboo: add Small, Average, Large, and Super Size forms. Add the corresponding four Gourgeist sizes.
- Zygarde: add 10% Forme, 50% Forme, and Complete Forme.
- Hoopa: add Confined and Unbound forms.
- Toxtricity, Tatsugiri, and every other multi-form entry must use stable, application-owned `form_id` values rather than display names as identity.

## Location-aware regional forms

Build a reusable regional-availability model, not one-off Oricorio logic.

- Store catalog-defined availability zones independently from a user's selected location.
- Ask before using browser geolocation. Do not request location automatically on initial load.
- Provide a manual country/region selector and a clear "No location preference" option.
- Persist only the coarse manual/derived region needed by the UI; do not store precise coordinates.
- If permission is denied, unavailable, or ambiguous, gracefully fall back to manual selection and show all forms.
- Use location to recommend or default the locally available form without hiding other forms.
- Oricorio: for the United States, verify and recommend Pom-Pom Style.
- Flabébé and Furfrou: represent regional availability through the same model.
- Vivillon: add an accessible map or region browser that explains where each pattern is associated. The map must have a complete text/list alternative and must not require geolocation.
- Add tests for permission denied, unsupported geolocation, manual override, persisted preference, and changing regions.

## Artwork migration

Replace PokéMiners-sourced Pokémon imagery with Pokémon HOME artwork referenced from:

`https://archives.bulbagarden.net/wiki/Category:HOME_artwork`

Requirements:

- First inventory every current sprite/artwork reference and determine whether it is repository-hosted, generated, or remote.
- Verify the usage terms, attribution requirements, file provenance, and hotlinking policy before downloading or referencing assets. Do not assume that a category page grants unrestricted reuse.
- Prefer a deterministic, repository-controlled asset manifest and build/sync process. Do not scrape at client runtime.
- Map assets by stable species/form IDs and include explicit fallbacks for forms lacking HOME artwork.
- Preserve aspect ratio, transparent backgrounds, lazy loading, responsive sizing, and meaningful accessible names where applicable.
- Remove PokéMiners attribution only after no shipped asset or metadata still depends on it.
- Update third-party notices, README/catalog documentation, source URLs, retrieval date, and any pinned provenance metadata.
- Avoid committing accidental duplicate or oversized assets. Include an asset-size report and verify production bundle impact.

## Data-model and migration safeguards

- Inspect `catalog/catalog.v1.json`, `catalog/catalog-overrides.v1.json`, `catalog/evolution-families.v1.json`, related generators, validators, application types, import/export, local storage, recovery snapshots, and tests before editing.
- Existing users' collection data must survive the catalog update. Add aliases or a migration when an old representative entry is split into multiple forms.
- Species totals and regional medals must not count alternate collector forms as new National Dex species unless that is already the documented product rule.
- Normal and shiny tracking for alternate forms must remain separate where CatchGrid supports form-level tracking.
- Unreleased forms must display as unavailable and must not enter missing-search strings.
- Search strings, CSV import/export, JSON backups, recovery snapshots, progress totals, detail dialogs, regional filters, and evolution-aware XXL/XXS helpers must continue to work.
- Audit inherited eligibility so release, shiny, Shadow, Purified, Lucky, and trade rules are scoped correctly per form.

## UX expectations

- Multi-form Pokémon should expose their forms in the existing detail experience without making single-form Pokémon noisier.
- Form labels must use official, readable names and fit mobile layouts.
- Location recommendations should be helpful context, not a forced filter.
- Vivillon's map/list and region settings must work in light/dark modes and every color theme.
- Do not redesign unrelated screens.

## Verification and test plan

1. Document the current catalog count and create a before/after mapping for every added, removed, or renamed `form_id`.
2. Add focused unit tests for catalog availability, alternate-form totals, migrations, inherited eligibility, location preference, and image-manifest fallbacks.
3. Add or update UI tests for representative entries: Tatsugiri, Oricorio, Vivillon, Flabébé, Furfrou, Pumpkaboo/Gourgeist, Zygarde, Hoopa, Toxtricity, Zacian/Zamazenta, Clodsire, and Hisuian Sliggoo.
4. Run `pnpm run validate:pokemon-data`, `pnpm run catalog:verify`, relevant unit/worker tests, lint, type/build checks, and targeted Chromium/WebKit coverage.
5. Start/maintain the Vite local server so Cody can review on desktop and iPhone over the LAN.
6. Provide a concise review handoff containing:
   - verified facts and sources;
   - catalog/form changes;
   - migration behavior;
   - artwork provenance and bundle impact;
   - tests run and results;
   - local preview URL;
   - any uncertain or intentionally deferred items.

## Publishing boundary

Stop after implementation, validation, and local review setup. Do not commit, push, create/merge a PR, migrate production D1, or deploy until Cody explicitly approves the reviewed result.
