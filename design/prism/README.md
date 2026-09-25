# CatchGrid full collection interface

Run `pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort` from the repository root, then visit `http://127.0.0.1:5173/design/prism/#dex`.

This functional preview uses the existing CatchGrid browser profile, not synthetic Kanto data. Tapping collection controls saves real local changes. It includes 1,025 species and 1,260 non-costume catalog entries, region/form/category dropdowns, separate Mega and Gigantamax records, evolution-aware missing searches, and reviewed JSON/CSV import/export. Costumes remain pending. Dark is the default and explicit appearance choices persist.

Published September 24 at https://dex.cjdev.app/ as the main interface. `/design/prism/` remains compatible; advanced tools are at `/advanced/`. See `../../docs/releases/2026-09-24/RELEASE.md` for deployment and validation evidence.

Catalog baseline is `2026-08-24.1`. `catalog-review.js` supplies dated source-backed corrections without rewriting immutable migration 0011. This is not a complete September recertification. Mega Staraptor uses explicitly labeled representative artwork. Alternate forms retain the existing normal/shiny-only storage contract.

See [the current implementation and validation record](../../docs/design-2026-09-23/FULL-COLLECTION-UPDATE.md). Earlier audit and design documents describe historical iterations and are superseded where this update differs.
