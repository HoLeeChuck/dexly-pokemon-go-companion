# CatchGrid release changelog — 2026-08-19

This release promotes the locally reviewed CatchGrid experience to `main`. It contains every product change made after commit `4fd0d25` (`feat: audit Pokemon data and detail collections`).

## Dex workspace

- Reduced the Dex heading and filter footprint so more Pokémon remain visible.
- Rebuilt the filter toolbar with Region, Collection form, and expandable Search controls on one responsive row.
- Shortened the unfiltered region label from “All regions” to “All”.
- Removed the redundant collection heading, shown-count heading, and state legend above the card grid.
- Preserved collection filters and Quick Check while improving desktop and mobile scaling.

## Pokémon details and forms

- Simplified collection controls into full-card toggles without redundant “Not yet”, “Collected”, or marked-count copy.
- Kept Shadow and Purified directly below XXL and XXS.
- Hid the Collection tab when a Pokémon has no additional form tab.
- Consolidated regional, costume, Mega, Primal, Gigantamax, and other variants into clearer compact form collections.
- Replaced separate transformation headings with the single “Alternative Forms” section.
- Moved Regular and Shiny form controls into each compact form row to reduce vertical scrolling.
- Added Left Arrow and Right Arrow keyboard navigation between Pokémon while the detail dialog is open.
- Added mobile pull-down dismissal from the Pokémon header, including sheet movement and a backdrop blur-to-focus transition.
- Removed the desktop-only mobile drag handle and corrected mobile header seams, alignment, and dialog spacing.

## Navigation and Settings

- Refined the full-screen mobile navigation with a smaller hierarchy, calmer route rows, and clearer Settings placement.
- Removed incorrect Home highlighting and focus borders from the hamburger control while preserving keyboard behavior.
- Redesigned Settings into a compact responsive workspace.
- Placed appearance and export controls side by side on larger screens.
- Moved bulk regional collection actions into an Advanced setup disclosure to reduce page length.
- Added persistent success and error feedback after applying a reviewed CSV import.

## Progress and Search Lab

- Split collection Progress and Search Lab into dedicated routes and navigation destinations.
- Rebuilt Progress around an at-a-glance category summary and focused regional missing-Pokémon explorer.
- Moved all generated Pokémon GO strings and Discord sharing tools to Search Lab.
- Added Personal and Tradeable missing-search modes:
  - Personal strings begin with `!#&` for user-maintained saved searches.
  - Tradeable strings retain `!traded&` for lists shared with friends.
- Kept personal XXL and XXS evolution helpers free of the traded filter and clarified that they include earlier family stages that can evolve into missing entries.
- Redesigned catch helpers with larger readable query previews and explicit Copy actions.
- Reworked Discord list toggles into a compact two-by-two mobile layout with clearer selected states.

## Import reliability

- Raised the reviewed import limit from 200 to 10,000 changed cells so a complete CatchGrid export can be restored in one operation.
- Increased safe preview and backup storage allowances for full-collection imports.
- Added Worker/D1 coverage for applying a complete export containing thousands of collection changes.

## Quality coverage

- Expanded desktop and mobile browser coverage for navigation, responsive Dex controls, Pokémon detail interactions, Progress/Search Lab routing, personal versus tradeable strings, Discord sharing, import feedback, and collection persistence.
- Preserved local-first collection storage, cloud-owner behavior, CSV portability, form tracking, themes, and existing catalog identifiers.
