# Prism: CatchGrid design direction

Prism is the name of this design study, not a product rename. The ambition is a distinctive collector’s instrument: expressive enough to remember, precise enough to use every day.

## Signature interaction

The collection keeps its spatial arrangement as the collector changes categories. Filled marks indicate collected species, circles reveal gaps, and hatching identifies ineligible entries. This lets the same collection reveal different patterns without rebuilding the interface around every category.

The map is an overview, not 151 tiny touch targets. A text summary and properly sized species controls provide the actionable equivalent. Selecting a species opens a specimen inspector; marking is a separate, explicit action with undo. “Build a search for these gaps” carries the actual IDs and category into a visible, editable query.

## Visual system

- Pearl canvas, ink typography, violet signal color; dark variant uses the same hierarchy.
- Display typography combines a direct sans-serif heading with restrained italic emphasis. Working views use smaller type and denser spacing.
- Pokémon artwork is the emotional center. Fine rules, quiet panels, numbered references, and generous negative space support it.
- Collection state uses shape, text, and color together. Never encode missing/collected only through color or dim every missing Pokémon.
- Motion is limited to brief state transitions and optional hover lift; reduced-motion preference is respected. No intro sequence, camera flight, or forced lateral navigation.
- Preserve top navigation and a compact mobile menu. Do not reintroduce the previously rejected bottom navigation or whole-card dragging.

Tokens live in `design/prism/tokens.css`. The prototype demonstrates violet light/dark only; the production migration must support all existing theme families.

## Page responsibilities

| Page       | Primary job                        | Proposed treatment                                                                                                         |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Home       | Start or resume                    | Expressive opening, then a direct collection/search action; distinct empty and returning states in production.             |
| Dex        | Find and inspect                   | Compact controls, clear category lens, recognizable art, explicit status; desktop inspector and mobile dialog.             |
| Progress   | Understand gaps                    | Stable collection map, exact fractions, category context, meaningful regional navigation in production.                    |
| Search Lab | Translate intent into a query      | Visible exact output, carried collection scope, removable terms, neutral storage guard by default, explicit copy feedback. |
| Settings   | Protect data and choose appearance | Clear DOM order, theme families, existing backup/import and bulk-operation safeguards retained in production.              |

## Prototype scope

Open `http://127.0.0.1:5173/design/prism/#progress` while the repository Vite server is running. All five navigation destinations are clickable.

It uses the existing local artwork and 151 default Kanto catalog records. Collection ownership is deliberately synthetic and held in memory. Reload resets it. It does not read or write the real collection database, call a game service, migrate storage, or deploy anything. The concept folder is outside the production entry graph and public directory.

Implemented for review: category changes, stable map, missing species list, Dex filtering, inspection, explicit mark/undo, contextual query composition, custom terms, None/Personal/Tradeable modes, clipboard copy with manual-copy fallback, responsive layout, and light/dark appearance.

Not implemented in the concept: full-catalog regional navigation, real persistence, actual backup/import, installed/offline behavior, all accent families, full recommendation sections, Discord output, bulk editing, or the private owner tools. Those remain production requirements, not rejected features. Settings explicitly describes the demo boundary rather than simulating a successful backup.

## Implementation architecture

Keep existing domain/storage libraries and immutable migration history. Introduce a shared UI scope containing category, region/species selection, and filter intent; pass scope deliberately between Progress, Dex, and Search. Keep query composition separate from presentation. Split Progress out of the Search Lab component module.

Migrate one route at a time with scoped styles and shared tokens. Retire old CSS only once affected behavior has parity. Preserve existing stable IDs, eligibility rules, forms, shiny artwork fallback, data import/export formats, and offline updates. A visual redesign must not reinterpret a collector’s saved records.

The map must scale beyond this Kanto demo: use explicit regional panels and summarized national overview, with a list equivalent. Do not compress all forms into microscopic interactive marks. Performance decisions require profiling on real full-catalog views.

## Acceptance criteria for production migration

- Exact counts govern completion; 951/952 remains incomplete.
- A category selected in Progress survives navigation to its missing list and Search.
- Opening, closing, or traversing details never mutates collection state; marking is explicit and undoable.
- Dex exposes Pokémon early on a 390px-wide screen without hiding essential controls or relying on hover.
- Query text, active scope, and copy action remain easy to locate; clipboard denial has useful recovery.
- None is neutral; Personal/Tradeable prefixes and all eight ordered recommendations retain existing semantics.
- Keyboard focus follows visible order; dialogs support Escape and return focus; reduced motion, non-color state cues, and all themes are checked.
- Existing collection, backup round trips, offline/update flows, private owner tools, and large catalogs pass regressions.
- Test with actual collectors before claiming improved task success. Record time to find a gap, accidental edits, scope comprehension, and successful query copying; do not substitute aesthetic preference for these outcomes.

## Suggested review path

Switch Normal to Shiny, inspect Charizard, mark and undo, then build a search for the missing species. Try the same sequence on mobile. Assess whether the interface keeps you oriented without explaining it first. This is the central proposal to approve or revise before migrating the app.

## Approved interaction refinement — September 24

The user's follow-up supersedes the original inspect-then-mark proposal: Dex artwork tiles now toggle the active category in one tap; separate Inspect buttons retain non-mutating browsing. Inspector category buttons toggle their own category directly, with eligibility guards and Undo. Map positions are labeled native buttons that open inspection, including a mobile dialog; the larger targets sit in a bounded scrollable map. Completion borders appear on tiles, inspector, and map when every released category for that species is collected. Unknown/unreleased categories are excluded, and an empty eligible set is not complete.

Backdrop colors use the base `background-color` values verified from the [official Pokémon Pokédex stylesheet](https://assets.pokemon.com/static2/_ui/css/main.css), linked by the [official Pokédex](https://www.pokemon.com/us/pokedex). Dual types blend their two base colors; single types use one hue with a light-to-color gradient. The source uses two-tone badges for Flying, Ground, and Dragon; this design intentionally uses their base color rather than copying badge stripes. This is a specific official website palette, not a claim of one universal palette across all Pokémon games.

Verified in browser: tile toggle; inspector category toggles; all-category rainbow border appears on Charizard and disappears after Undo; map selects Squirtle with matching single-type colors; mobile map opens Charizard dialog without horizontal overflow. Prototype ESLint/Prettier passed. The real collection and production site remain untouched.

## Approved implementation supersedes this proposal

The September 24 implementation defaults to dark, uses one-tap collection changes without Undo popups, has dropdown category selection and all regions, and persists the real browser profile. See [Full collection update](FULL-COLLECTION-UPDATE.md) for current behavior and release gates; it supersedes conflicting concept details above.
