# CatchGrid interaction and UX audit — September 24, 2026

## Scope and evidence

Reviewed the published public interface at dex.cjdev.app (Home, Dex, Progress, Search Lab, Settings), the linked advanced Settings surface, and the implementation behind those interactions. Exercised fixes on isolated localhost origin 5194, including the full catalog, keyboard navigation, filtering, search drafts, completion states, and a narrow 343-pixel embedded viewport. The private authenticated owner workflow was not exercised. No live collection records were changed.

This is an interaction/design audit, not a formal accessibility certification, a complete performance benchmark, or fresh verification of Pokémon release facts. Findings below distinguish observed behavior, source findings, implemented fixes, and remaining recommendations.

## Main diagnosis

Marking one Pokémon called `render()`, which assigned `main.innerHTML`. That destroyed the entire grid, inspector, and input elements. Opening desktop details and changing controls used the same destructive path. Search typing also replaced the grid HTML. This explains the visible artwork churn and lost focus. Cached files may avoid network downloads; node replacement alone does not prove every image was downloaded again.

The fix reconciles markup by stable form ID and updates changed attributes/text in place. Images and controls that remain in the result set keep their existing DOM elements. Changing the actual inspected species updates only its image source; filtering removes only nonmatching cards. This preserves the existing data/eligibility/storage contract and introduces no dependency.

## Findings and disposition

| Priority | Area                   | Finding                                                                                                                       | Disposition                                                                                                                                                                                                  |
| -------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| High     | Collection interaction | Every mark rebuilt all artwork and controls.                                                                                  | Fixed with stable keyed rendering.                                                                                                                                                                           |
| High     | Dex visual feedback    | Repeated Collected/Missing labels cluttered each card; the parent border did not convey category ownership.                   | Fixed: quiet empty outline, highlighted collected border plus check, rainbow completion border plus star. A shared legend explains the states once. Unavailable reasons and accessible button labels remain. |
| High     | Keyboard interaction   | Filter updates replaced focused controls; marking in Missing could drop focus when the card disappeared.                      | Fixed: controls retained; focus moves to the next remaining card, or the empty-state action.                                                                                                                 |
| High     | Progress map           | The full map exposed 1,025 sequential tab stops.                                                                              | Fixed: one entry point with arrow keys, Home/End, and Enter-to-inspect.                                                                                                                                      |
| Medium   | Detail navigation      | Previous/Next walked the entire catalog, including forms outside the current selection.                                       | Fixed: follows current Dex search/status/region/form results, or the current Progress scope.                                                                                                                 |
| Medium   | Search Lab             | Switching modes reset an authored query; unfinished keywords disappeared during rendering.                                    | Fixed: terms and draft retained while switching between Build my own and My Missing.                                                                                                                         |
| Medium   | Mobile controls        | Three adjacent dropdowns truncated labels; dense cards wrapped names awkwardly.                                               | Fixed: two scope columns plus a full-width category row; two card columns on narrow phones.                                                                                                                  |
| Medium   | Mobile search          | The long generated string preceded the controls needed to choose the desired category.                                        | Fixed: controls precede output on narrow phones, with a bounded query preview.                                                                                                                               |
| Medium   | Home                   | Category-entry totals could be mistaken for unique Pokémon collected.                                                         | Fixed: shows registered Normal species against the released-species denominator, plus fully complete species.                                                                                                |
| Low      | Search and feedback    | Padded displayed numbers were not searchable; empty-state guidance was too vague; old copy notices remained after navigation. | Fixed: padded numbers match, empty-state wording identifies the relevant controls, notices dismiss on route changes.                                                                                         |
| Low      | Completion layout      | Thicker completion borders could change card geometry.                                                                        | Fixed: consistent card/inspector border widths.                                                                                                                                                              |

## Remaining recommendations

1. **Unify advanced tools with the current interface (high).** Recommendations, Discord output, recovery, bulk setup, and full accent controls still lead into a different navigation/style system. Keep their validated behavior, but integrate them into the current Search/Settings shell. Avoid removing functionality merely to hide the inconsistency.
2. **Unify catalog provenance and freshness (high).** The main interface uses a dated correction overlay; the API/advanced tools still use the August baseline. The same Pokémon can therefore have different supported metadata depending on the surface. Consolidate the source and display a concise reviewed-as-of status. Complete the outstanding eligibility review; this audit does not certify those facts.
3. **Make the Progress overview easier to interpret (medium).** A 1,025-slot scroll area is useful as an index but weak at explaining progress. Add region summaries and a compact category breakdown above or alongside it. Preserve fixed Dex ordering and direct inspection; do not restore redundant marketing headers.
4. **Clarify legacy move coverage (medium).** The current dated selection is not a comprehensive live checker. Its explicit disclaimer is good; the next iteration needs a maintained source pipeline and separate event-window versus Elite TM eligibility labels.
5. **Reduce large-list work (medium).** The main artwork churn is fixed, but each render still constructs/diffs full-list markup and the bundled catalog remains about 1.2 MB minified. Measure slower-device interaction timing before choosing pagination/virtualization. Any optimization must preserve focus, browser find/search behavior, stable ordering, and offline data.
6. **Complete device and assistive-technology testing (medium).** Verify VoiceOver/TalkBack, reduced-motion behavior, landscape phones, and larger text on real devices. Current browser checks are narrower evidence.
7. **Keep import decisions understandable (medium).** Import review is retained; a future summary should distinguish additions, replacements, skipped/ineligible entries, and recovery destination without exposing storage jargon.

## Validation

- Full-grid observation: marking Ivysaur retained all **1,026 existing image elements**, with **0 image additions, 0 removals, and 0 image source changes**. Inspecting Bulbasaur retained the same elements and changed only one image source. These are DOM observations, not a claim of a network trace.
- Six browser rendering regression checks passed: image/focus preservation; filtered-card retention; keyed reorder; disclosure/draft preservation; select/checkbox synchronization; inspector source updates.
- Verified collected borders are category-specific and rainbow completion remains reserved for all eligible categories.
- Missing-filter marking removes the marked card and focuses the next item. Fire-filter detail navigation advances Charmander to Charmeleon; padded `0006` finds Charizard.
- Authored `buddy3-5` remains in the query and an unfinished `distance100-` draft survives switching search modes.
- Progress exposes one map tab stop; ArrowRight moves Charizard to Squirtle, and Enter inspects Squirtle without collecting it.
- Narrow viewport: readable dropdown layout, two-column cards, mobile dialog/menu operation, controls before query, and no horizontal overflow.
- 152 unit tests passed. Lint, TypeScript, and production build checked. Existing chunk-size warning remains. Worker/database behavior was unchanged; its tests were not rerun for this frontend-only patch.

## Delivery state

Implemented locally; this polishing pass has not been deployed. The published release remains `6febf11c-af7e-41d4-bfc1-aa54a75fb20f`. Preview: `http://127.0.0.1:5194/#dex`. Browser test fixtures live under `tests/browser/` and are not production build inputs.
