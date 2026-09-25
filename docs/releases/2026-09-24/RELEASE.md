# CatchGrid production release — September 24, 2026

Published the approved full-collection design to https://dex.cjdev.app/ at the user's explicit request, replacing the previous root interface. Removed the concept bar and preview title/noindex metadata from the public entry.

- Worker: `dexly-companion`
- New version: `6febf11c-af7e-41d4-bfc1-aa54a75fb20f`
- Previous version: `aec0abb9-b609-42ff-8cfc-ef6f0676955f`
- Service-worker cache ID: `catchgrid-7b245370e5ac6df0`
- Source: base commit `f9905ee213ce110863e473e5e25186c2fb3ca945` plus the uncommitted working tree; see `source-manifest.json`. The base SHA alone does not identify the release source. Post-release documentation is not part of that manifest.
- No migrations were pending; no production database mutation was performed. Existing browser storage keys and profile contracts remain intact.

## Promotion changes

Root HTML now uses the approved design. Old `#/dex`, `#/progress`, `#/profile`, and search-section bookmarks use the shared routing parser. Existing advanced search/recovery/theme UI remains at `/advanced/`, linked from the new interface, and the separate private `/cody/` entry is retained. The old concept URL remains a compatible alias of the new interface.

Installed-app manifest text/encoding and dark launch colors were corrected. The new shell registers the service worker and displays explicit Update now/Later controls. Cache identity now follows built content rather than the unchanged Git HEAD, preventing separate dirty-tree releases from sharing a cache version. Bootstrap files and the advanced entry are precached; private owner navigation and private APIs remain outside caching.

## Validation

- 152 unit tests and 40 Worker tests passed.
- Build (binding generation, TypeScript, Vite), lint, baseline catalog validators, diff check, and strict Wrangler dry run passed.
- Built preview: old hash bookmarks, dark startup, no concept bar, all 1,025 species, one-tap persistence after reload, mobile detail dialog, no horizontal overflow, My Missing category selection, and advanced Search Lab checked.
- Stopped the isolated preview server and reloaded: full Dex, dark appearance, and saved Bulbasaur state loaded offline. Only previously requested artwork is expected offline; the entire artwork corpus is not precached.
- Strict production deployment succeeded. All 11 GET/HEAD health/readiness/catalog/manifest/robots/private-auth smoke checks passed. Unauthorized private bootstrap returned 401.
- Live browser: full Dex, dark appearance, no concept bar, no console errors; Update now activated the waiting service worker and reloaded successfully with the notice dismissed.
- Live root, advanced entry, owner entry, and service worker bytes match the local artifact; see `live-artifact-checks.json`.

The prior full Playwright suite targets the replaced interface and was not rerun as a claim of new-design acceptance. Current desktop/mobile interaction checks used the built browser preview and live site. Physical devices and exhaustive theme parity were not tested.

## Known follow-up

The public interface uses the dated September 24 correction overlay on the August catalog baseline. The API/private/advanced catalog remains `2026-08-24.1` (1,269 forms). Fresh verification of every eligibility record is still incomplete after the earlier bulk-feed 403 responses; do not describe the entire data set as recertified. Consolidating the overlay and catalog source remains follow-up work. Costumes remain pending; Mega Staraptor has labeled representative artwork. The full catalog bundle still produces a size warning.

## Rollback reference

If rollback is needed, the previous version is preserved above and in `deployments-before.json`. Use the established Wrangler rollback workflow with that exact version. No rollback was performed. Rollback does not restore or alter browser-local collection data.
