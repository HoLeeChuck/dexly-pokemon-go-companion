# Phase 1 — first-run Home evidence

Local work for `CODEX-PLAN.md`, Phase 1 only. Screenshots use system Chrome, 1440×900 and 390×844 viewports, dark appearance, reduced motion, and disposable browser contexts. They are fixture evidence, not production or physical-device evidence.

## Reproduce

From the repository root, start the frontend-only local server (no Worker or D1 required):

```powershell
pnpm.cmd exec vite --config tests/e2e/vite.config.ts --host 127.0.0.1 --port 5184 --strictPort
```

In a second terminal:

```powershell
$env:SHOT_BASE = 'http://127.0.0.1:5184'
node scripts/shots.mjs current
```

The harness uses the existing `@playwright/test` installation and installed Chrome; no dependencies were added. It refuses non-loopback URLs. Each state/viewport uses a fresh context, so it does not touch an existing browser profile. It calls the dev-only restore hook when present, or imports and applies the backup through Settings on a production preview. It never writes storage keys directly.

`../fixtures/demo-collection.json` is a valid synthetic portable backup: 180 Normal, 40 Shiny and 12 Lucky entries, evenly distributed across Kanto, Johto, Hoenn and Sinnoh. Nine activity days use offsets 0, 1, 2, 4, 7, 10, 14, 21 and 28 days from its creation time. The harness freezes the browser clock at `2026-09-27T18:00:00.000Z`, in `America/Chicago`, so that activity remains reproducible. The file is test data; it must not be restored into a real collection.

## Results

- `phase1-before/`: 16 captures before the Home change, plus `results.json`.
- `phase1-after/`: the same 16 captures, two additional light-theme Home captures, `results.json`, and `review.json` with production-preview CSP, animation and screenshot-comparison results.
- Empty Home: no `0%`, readable primary action and artwork, five region shortcuts, no page overflow or missing images. Phone document height changed from 3,426px to 2,487px; desktop changed from 1,736px to 1,421px.
- All 14 other screenshots are byte-identical, including both seeded Home screenshots. The returning-user dashboard remains unchanged.
- Light screenshots were taken from the local production build with its real CSP, at `http://127.0.0.1:5185/`. No CSP violations or page errors occurred; the seed hook was absent. Seven animation positions were checked in each theme: exactly one full-colour portrait at each 1.2-second step. Reduced motion disables the animation and displays every portrait in colour.
- Browser tests cover keyboard focus order, region navigation, real reviewed JSON import before/after apply, first-catch and last-removal transitions, and existing collection/detail behavior. The full Chromium run had 66 passes and 2 existing mobile skips; the two poster-download checks then passed after making their fallback selection explicit for system Chrome. Total: 68 applicable checks passed.

No later-phase dashboard or navigation changes were made. Safari, standalone PWA and physical-device checks were not run for this phase.

# Phase 2 — returning-user Home evidence

Phase 1 is committed as `789b6bb` on `prism-forward`. These Phase 2 changes remain local and uncommitted. No push, merge or deployment was performed.

Run the same harness with `node scripts/shots.mjs phase2-after`. It retains the original demo fixture, clock, viewports and routes for comparison with `phase1-after/`.

- `phase2-after/` contains 16 standard captures and `results.json`, four additional dark/light desktop/phone Home captures with six nearly complete Pokémon, two expanded phone-table captures, and `review.json`.
- Original seeded phone Home: **2,361px**, down from **3,497px**, meeting the 2,400px acceptance limit. Empty phone Home stays at 2,487px. All standard captures have no page overflow, broken artwork or page errors.
- Added `../fixtures/phase2-nearly-complete.json`: 268 synthetic entries, extending the unchanged 232-entry demo so Bulbasaur, Ivysaur, Charmander, Squirtle, Pikachu and Eevee are each one or two categories from complete. Import via Settings and apply the reviewed import in a disposable context, with the same fixed clock. These captures exercise the four-card desktop / 1.3-card phone shelf, 72px artwork and missing-category chips. This richer phone Home measures 2,468px.
- The supplemental captures use the production preview at `127.0.0.1:5185`, including its real CSP. Both themes, the full-table disclosure, 320/600/844px widths, landscape and enlarged body text were checked without page overflow, broken artwork, page errors or CSP violations. The expanded native table retains its caption, column/row headers and links while visually reflowing into region groups.
- Outside returning-user Home, 13 standard screenshots are byte-identical to Phase 1. Phone seeded Progress has identical dimensions/layout with 40 checkbox-edge pixels differing by one RGB channel level (recorded in `review.json`); no content changes.
- Browser coverage checks bronze/silver/gold/platinum rings, silhouettes, recent sprites and a zero-activity week, picker default/change, the accessible table, axe, keyboard shelf navigation, and unchanged stored ownership while details open/close. A dialog-close focus race found by the new keyboard test was fixed and the affected Home/Progress/Dex/detail checks rerun successfully.

Phase 3 navigation has not been implemented. These are local fixture/browser checks; Safari, standalone PWA and physical devices were not tested in this phase.

# Phase 3 — navigation evidence

Phase 2 is committed as `b513e19` on `prism-forward`. Phase 3 remains local and uncommitted, with no push, merge or deployment.

- Baseline: `phase2-after/`. Run `node scripts/shots.mjs phase3-after` against the local frontend server for the 16 standard empty/seeded desktop/phone captures. All eight desktop captures remain byte-identical; the first-visit cue has already played by the harness's later Home capture.
- `phase3-after/desktop-dex-cue.png` separately captures the top-nav underline halfway through its one-time 2.4-second pulse. Browser tests also verify reduced motion, no cue for returning collections, session persistence, storage denial and deferring the cue while its link is hidden.
- Below 700px, phone captures show the four labelled tabs. Main padding is 56px plus the bottom safe area; a separate footer clearance keeps its final link reachable. The seeded document height is 2,438px (empty: 2,564px), 77px above Phase 2 from 21px additional main padding and 56px footer clearance. Dashboard content was not expanded. The earlier height assertion excludes the space reserved for the fixed navigation.
- Eleven additional `standalone-*.png` captures cover empty/seeded Home in both themes, seeded Dex/Progress/Search, both landscape themes, details and a visible copy toast. The local production preview at `127.0.0.1:5185` supplied its real CSP. `review.json` records zero violations, page errors, broken artwork or page overflow.
- Standalone layout checks use system Chrome's headless app mode in a temporary profile and assert that `(display-mode: standalone)` actually matches. Safe-area values are emulated through [Chrome's safe-area override](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride): portrait top 47px/bottom 34px, landscape left/right 47px/bottom 21px. Portrait tabs measure 90px including the home-indicator area. This does not install an app in the user's profile.
- Re-run navigation coverage with `pnpm.cmd exec playwright test tests/e2e/navigation.app.spec.ts --project=desktop-chromium --project=mobile-chromium`. Re-run standalone/offline/update checks with `pnpm.cmd exec playwright test --project=pwa-chromium`. Set `PLAYWRIGHT_USE_SYSTEM_CHROME=1` to use installed Chrome; use an unused `PLAYWRIGHT_PORT` for a fresh test build.

Phase 3 validation passed: 241 unit, 40 Worker, 89 applicable browser/PWA checks (two existing mobile skips), lint, build and focused formatting. Final affected safe-area and visible-overlay checks were rerun after visual refinements. Safari and physical devices were not tested.

# Phase 4 — final verification and handoff

Verified Phase 3 commit `8a27054` on `prism-forward` with no application changes. Phase 4's documentation and evidence remain unstaged and uncommitted; nothing was pushed, merged or deployed.

- **Overall before:** `phase1-before/`. **Approved implementation baseline:** `phase3-after/`. **Final:** `phase4-verified/`.
- Fresh `pnpm.cmd test`, `pnpm.cmd lint` and `pnpm.cmd run build:artifact` passed: 241 unit and 40 Worker tests. The fresh frontend production-build Chromium desktop/mobile/PWA run passed 89 checks with two existing mobile skips and no failures. Use `PLAYWRIGHT_USE_SYSTEM_CHROME=1` and an unused `PLAYWRIGHT_PORT` (this run: `4175`) to reproduce with the normal Playwright configuration.
- Run the standard harness against the production preview with `SHOT_BASE=http://127.0.0.1:5185` and `node scripts/shots.mjs phase4-verified`. This run restored the synthetic fixture through Settings, because the development seed hook is absent in production. All 16 captures are byte-identical to Phase 3. No page overflow, broken artwork or page errors occurred. `results.json` contains the measurements.
- Six supplemental light-theme captures show desktop/phone empty Home, seeded Home and the detail sheet with keyboard focus. Tab traversal covered Home actions, Dex shelf/device/grid, and every enabled modal control in both themes at both sizes. Escape returned focus to the opener; viewing details never changed ownership. `review.json` records the traversed controls, screenshot comparisons and zero CSP violations from the real production headers. Chrome's native dialog traversal visited browser chrome once before returning to the modal; background content never received focus.
- Final phone document heights: empty 2,564px; seeded 2,438px, including the navigation clearance added in Phase 3. Empty Home has no `0%` text. Full-page phone screenshots show the fixed tab bar at its viewport position; scroll/reachability and safe-area checks verify that final content remains accessible.

No application fixes were needed. The existing catalog chunk-size advisory remains; Safari and physical-device verification are still open. See the current [HANDOFF.md](../../HANDOFF.md) for the complete local completion record and scope limits.
