# Prism Atlas live release — September 24, 2026

Published with explicit user approval: “Approved for live”.

- Domain: https://dex.cjdev.app/
- Worker: dexly-companion
- Version: 9b19b937-8ff5-4a67-8c7f-ca13d5e4dfaa
- Previous / rollback version: 6febf11c-af7e-41d4-bfc1-aa54a75fb20f
- Source: dirty working tree recorded in source-manifest.json (2,165 files), not HEAD alone.
- Added Atlas styling, stable DOM updates, related Mega/G-Max controls, and the approved polish accumulated since the earlier release.
- No database migrations pending; no database migration performed. Existing profile keys and import/export contracts preserved.

## Validation

153 unit tests, 40 Worker tests, binding type checks, lint, TypeScript/build, baseline catalog/artwork validators, and strict deployment dry run passed. Full repository formatting stopped on eight documentation/evidence files; current HANDOFF formatting was corrected, seven older historical artifacts were left unchanged. This is not a claim of a clean aggregate validate:source run. The old end-to-end suite still targets the replaced design; current browser acceptance covered the new production artifact instead.

Built preview: dark launch, one-tap Bulbasaur persistence after reload, Mega Charizard controls, and mobile dialog at 375px with no horizontal overflow. Live: 11 smoke checks passed, including private bootstrap returning 401. Ten live HTML, bootstrap, script, style and service-worker resources exactly match local build bytes (live-artifact-checks.json). Browser confirmed the new hashed script, dark appearance, 14 illuminated collection tracks in Charizard's inspector, Mega controls, and no console errors. Live collection data was not changed for verification.

Catalog remains a dated baseline with the existing reviewed overlay; no new eligibility recertification. Existing bundle-size warning remains. Physical devices and full offline/update-lifecycle regression were not rerun in this release. Existing clients retain explicit Update now/Later acceptance.
