# CatchGrid: design direction study

Date: 2026-09-24. Local exploration, not a production redesign or release.

## Finding

The existing interface is competent but visually generic because its basic unit is a dashboard control: a boxed image next to a boxed set of buttons. Changing corner radii, icons or hover movement leaves that composition intact. It also makes the Pokemon compete with eight equally prominent controls.

The strongest direction is **Prism Atlas**: a collection is a set of incomplete records that gradually become whole. Make that progression the visual identity. Quiet dark surfaces keep the artwork vivid; fine collection segments become luminous when registered; the completed record earns a spectrum. The visual interest is produced by the user's activity, rather than perpetual decorative animation.

This is a design hypothesis, not a claim that no product has ever used this idea. Distinction should come from consistent execution across this specific collecting workflow.

## Research and interpretation

- Apple's [Motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion) frames motion as communication of status, feedback and instruction. Search-index text was available; the full page requires JavaScript. Applied here as a principle: movement should explain a state change or preserve spatial context. More parallax alone does not make a better collecting experience.
- Apple's [Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) discusses contrast and background blending. Search-index text was available; the full page requires JavaScript. Applied here: use atmosphere behind artwork, solid readable surfaces behind controls; avoid glass on every tile.
- The official [Pokemon HOME feature overview](https://home.pokemon.com/en-us/features/) documents rich details, collection views, forms, and viewing Pokemon from different angles. This establishes that rich artwork inspection is already familiar territory. Our opportunity is the speed and legibility of personal collection progress. HOME's automatic form-registration behavior is not evidence for changing this app's Pokemon GO collection rules.
- Reviewed the existing local Prism markup, category controls, type disc, form rows and collection map. This is an interaction-design study, not a new verification of catalog eligibility or a comprehensive competitor census.

## Three directions considered

| Direction     | Strongest quality                                                                                 | Weakness                                                                                                               | Decision                                                    |
| ------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Field Archive | Editorial hierarchy, careful spacing, a personal natural-history record                           | Can become subdued and text-heavy; adding more records does not naturally create a distinctive visual payoff           | Borrow typography and restraint                             |
| Orbital Dex   | Strong central composition, a sense of depth and discovery                                        | Radial controls complicate scanning, keyboard order and mobile touch spacing; expensive to repeat across 1,025 species | Keep the artwork's optical depth, reject orbital navigation |
| Prism Atlas   | A repeatable relationship between missing, collected and complete, visible from species to region | Tiny collection strips need accessible descriptions and a clear distinction from the active category                   | Recommended foundation                                      |

## The signature interaction

1. The grid is the collection surface, with Pokemon artwork given breathing room.
2. Normal/Shiny/etc remains an explicit category selector. In the operational Dex, tapping a Pokemon still toggles that category. Opening details remains a separate, clearly accessible action.
3. A missing category is an unlit engraved segment. A collected category is a luminous segment. The segment's entire labeled area is the button, at least 44px tall; never require aiming at a one-pixel line.
4. The detail controls ARE the collection strip. Do not add a second progress bar above them or put a checkmark inside each segment.
5. Only completing the relevant eligible categories joins the visual treatment into a spectrum. Preserve the approved completed rainbow border in the operational grid. No perpetual spinning gradient or repeated celebration on every render.
6. A compact strip can summarize all-category progress in an optional overview. In the active-category collection grid, prefer its one category border; do not stack summary strips, category badges and checks onto every card. The study uses an overview so users can compare partial records.
7. Size and IV categories remain base-only. Related Mega/G-Max records appear beneath the base record with their existing separate Normal/Shiny state, until the user resolves the earlier registration-model question.

## Movement should tell the story

- Selection: expand the inspected Pokemon from its position in the grid, keeping image identity and returning focus to the source. Proposed for a subsequent implementation; the study does not implement this transition.
- Registration: one brief 160-220ms illumination of the affected segment. No modal, toast, particles or page-wide animation.
- Completion: a one-time transition into the spectrum after a successful durable save; no replay on navigation or refresh.
- Pointer depth: a few pixels of opposing movement between artwork and backdrop, confined to the selected Pokemon. The previous pass applied depth to every card; the preferred direction reduces that activity.
- Reduced motion: instant state changes and no spatial transition. Touch: no gyro, cursor effects or scroll interception.
- Performance: never replace image nodes on toggles; no per-card animation loops or hundreds of composited layers.

## Across the product

- Dex: compact working view, strong Pokemon artwork, quiet control bar, immediate category marking.
- Details: a focused record, labeled collection segments, then relevant transformation records. No repetitive introductory heading.
- Progress: use the same visual marks in the collection map. Empty space should reveal gaps. Preserve selectable regions and keyboard navigation; do not replace the map with an arbitrary constellation.
- Search Lab: the visual language becomes linear composition: collection scope -> optional evolution awareness -> resulting string. Custom Builder remains available separately. Keep the output legible and copyable.
- Home: one useful continuation into the user's current collection scope. No large generic dashboard hero.
- Settings/import: intentionally conventional and explicit. Experimental visuals must not make backup, merge or restore harder to understand.

## Prototype and limits

Open `/design/study/` on the existing local server at port 5194. Three direction selectors change the sample composition; nine sample Pokemon have independent in-memory category states. A mark updates the focused record and its atlas summary. Completing eight demo categories shows the spectrum. Refresh resets sample state. No real profile, persistence, API or account access.

This is a visual and interaction comparison, not the finished app: category eligibility is deliberately not modeled in samples, Mega/G-Max controls and real search are not present, and shared-element navigation is described rather than implemented. The live app and production entry points are unchanged. No dependency additions or generated bitmap art.

## Acceptance criteria before adopting the direction

- Recognizable empty/collected/complete states at a glance, also usable without hue discrimination and with screen readers.
- Marking and inspecting remain distinct, one-handed and keyboard-accessible.
- No unexpected image requests or DOM replacement on a mark.
- Visible focus, readable contrast, 44px targets, and no horizontal page overflow on small phones.
- The system still works at 1,025 species, with unavailable categories and long form names.
- Validate real collection persistence, import/export, category-scoped progress, and form separation before replacing the existing interface.

## Decision

Proceed from Prism Atlas, borrowing Field Archive's typography and the Orbital concept's artwork depth. The distinctive feature is a consistent visual grammar for collection progress. A full 3D scene, radial controls and more glass would make the site louder without making the collecting experience more convincing.
