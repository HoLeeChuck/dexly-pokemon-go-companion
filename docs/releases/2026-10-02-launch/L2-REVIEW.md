# Round 3 L2 and L3 item 2 — local review

October 1, 2026. The owner authorized **L2 and L3 item 2 only**, with a local commit on `prism-forward`. L1 was approved by Claude. No push, merge, deployment, announcement draft, catalog changes or release operations are included.

## Implemented

- **Report a wrong entry** expands beside the Pokémon details, in the Dex scanner and on Sources & credits. Its editable message includes species/Dex number, form, category, correction and optional source URL. The generic report leaves clear fields to fill in. Drafts stay in the page and are not persisted or sent.
- **Copy report** copies the visible edited text exactly. Denied/unavailable clipboard access selects the message within the same disclosure, including inside the details dialog. The explicit **Message Cody on Discord** link uses the plan's owner-approved profile URL, one production constant, `target="_blank"` and `rel="noopener"`.
- **Catalog updated 2026-09-29** uses the newer catalog/ledger date. Whole UTC calendar days determine the warning: day 21 is fresh; day 22 adds “Some recent releases may be missing.” Home uses existing annotation/caption lines; the Dex shelf uses its existing introduction.
- Skipped import review says **“CatchGrid's catalog says this isn't in GO yet. If that's wrong, report it.”** A generic report is available immediately, and each unavailable skipped cell offers the same report prefilled with its Pokémon/form/category. Untracked form categories remain distinct. A sheet with only skipped entries no longer incorrectly claims everything is already registered.
- Report controls have separate IDs across details, scanner and skipped rows, including repeated entries. Viewing, drafting and copying do not change ownership, eligibility or import application.

## Validation

- **259 unit and 40 Worker tests passed.** New unit cases cover catalog/ledger ordering, an empty ledger, the 21/22-day boundary and time-zone offsets.
- Full repository lint, TypeScript/artifact build, focused formatting and `git diff --check` passed. The existing large-bundle warning remains. Dependencies, catalog, migrations, storage schemas, backup formats, compare format and recommendation strings are unchanged.
- **Final Linux browser run: 259 passed, two existing exclusions, zero failures/retries.** The suite includes all Chromium, WebKit and PWA projects with four workers. New browser cases cover exact copy, no report requests, denied clipboard, keyboard/Escape focus, alternate forms, generic/scanner reports, draft preservation, both themes/accessibility, import review/application and fresh/stale Home. [Full log](l2-linux-browser.txt), [verification and matching source hashes](l2-verification.json).
- Production-build captures use a local static preview of `dist/client` with the repository's `public/_headers` CSP applied. **32 captures / 48 measurements**, with **zero console/page/CSP errors**. Maximum phone Home content height is **2,394px**, below the unchanged **2,400px** limit. The existing documented 77px navigation-clearance adjustment is unchanged.
- [Screenshots and measurements](../../shots/l2-after/) cover phone/desktop, dark/light, first-run/returning/backup-banner/both-notice Home, the Dex shelf, details report, Sources & credits and skipped cells. Stale-date scenarios are measured too. Dates affect the activity chart, so these capture heights are distinct from the frozen September fixtures in the regression suite.

### Intermediate failures and fixes

The initial placement in Home's top row pushed its action buttons onto another line; the stale warning also exposed a 2px overrun in a small-collection case. Moving freshness to the existing Categories caption preserved the layout budget without shrinking controls or changing the limit. New tests were corrected to use the existing Charizard scanner selection and preserve an already-open paste disclosure.

The full suite exposed a pre-existing assertion that still expected 954 released defaults after L1 added Toxel and Sinistea. That expected count is now 956; compare behavior and catalog data are unchanged. A later full run had one desktop WebKit Johto navigation failure (258 passes, two existing exclusions); it is retained as an observed intermittent failure, not a proven root-cause diagnosis. The final full run result is recorded above and in the verification JSON.

## Reproduce and review

Use the pinned lockfile and `pnpm.cmd` on Windows. Run `pnpm.cmd test`, `pnpm.cmd lint`, `pnpm.cmd build:artifact` and the focused formatting check for changed files. Browser evidence uses the existing Ubuntu WSL Node 24.19.0 / Playwright runtime with the matching frozen lockfile. A separate Linux snapshot excludes local secrets, Worker state and private evidence; the final source hashes are recorded in `l2-verification.json`.

`scripts/captures/shots-l2.mjs` captures the local built preview specified by `SHOT_BASE` (default `http://127.0.0.1:4188`); `SHOT_REQUIRE_CSP=1` requires CSP headers. It imports only the committed synthetic demo fixture through the existing reviewed import flow, not a real owner's workbook/profile.

**Stop for Claude review.** L3 item 1 (`docs/LAUNCH.md`) and all of L4 remain unstarted. The plan is local/untracked and must stay out of the commit. Unrelated organization changes remain unstaged, including the pre-existing HANDOFF reorganization; only this phase's handoff note is staged. Live state, physical phones, real Discord opening and real platform clipboard behavior remain unverified.
