# CatchGrid current handoff

Updated October 2, 2026. Start with [AGENTS.md](AGENTS.md), [README.md](README.md) and [FOLDER-GUIDE.md](FOLDER-GUIDE.md). The local owner assignment is [CODEX-PLAN.md](CODEX-PLAN.md), which must never be committed.

## October 4, 2026 — LAUNCHED (2026-10-04 12:24 CDT)

Owner gave the go on the Project HQ Decisions page; the PM chat ran LAUNCH-MORNING.md steps 1–8.

- Source `3cdaa41` (app `4745a62`), artifact fingerprint `7a6e4a0e…` / 2,429 files, unchanged.
- Pre-deploy live: `0891c9e5-8a9c-4736-beae-2e796325dfef` at 100%; `wrangler d1 migrations list --remote`: **No migrations to apply**.
- D1 bookmark: `000000da-00000000-000050fa-7299e90dde9dc84c3ca0277c9ecaa064`.
- Strict dry run: 2,433 asset files read.
- **Deployed Worker version `b0c70140-8b84-46f8-9198-921d6106c1d6`** on dex.cjdev.app.
- Smoke: 11/11 ok (private bootstrap 401 as expected). `/api/health`: gitSha `4745a62fc55f72dfe40deb2cf262e4692ee1b393`, version `b0c70140…`.
- Live checks (`live-checks.mjs`, Chromium + WebKit, desktop + phone, both themes): **43/43 passed**, zero app console/CSP errors.
- Rollback target if needed: `0891c9e5-8a9c-4736-beae-2e796325dfef`.
- Still owner-only: physical iPhone/Android and Discord-card checks, then posting the announcement draft.

## October 4, 2026 — launch ready, waiting for the owner's go

**Live is still `c49945a`, Worker `0891c9e5-8a9c-4736-beae-2e796325dfef`** (read-only check at 03:50 CDT; no pending migrations). Claude re-verified the L4 candidate overnight, without deploying, pushing or merging. Interactive WebKit checks found that first-time visitors could intermittently see the "new version is ready" bar. This is fixed in **`4745a62`**, which is the new application candidate. The rebuilt `dist/` artifact is fingerprinted, and must not be rebuilt before deploy.

- `4745a62`: 262 unit and 40 Worker tests, lint, format, catalog validators, build and strict dry run on Windows and clean Linux. Clean full Linux browser run: 263 passed, 0 failures. Interactive Chromium/WebKit desktop/phone, both themes: 43/43, zero app console/CSP errors.
- Known: one existing WebKit tab-order test fails about 1 in 20 before and after the fix (a smooth-scroll click race in the test). Bramblin/Brambleghast debut in GO on October 13, so a catalog update is the first post-launch task. Freshness warns from about October 20.
- **Next:** follow [LAUNCH-MORNING.md](docs/releases/2026-10-02-launch/LAUNCH-MORNING.md) once the owner says go: bookmark, migration stop, deploy, smoke/live checks, rollback target, push. Then do the phone/Discord checks and post the announcement draft (L3 item 1, a draft only, not posted).

## Live and current release status (October 2 record)

**Live remains `c49945a04d9b822e27c9a2af1cc41bcf68883d99`, Worker `0891c9e5-8a9c-4736-beae-2e796325dfef`.** Both were freshly confirmed using production health and Wrangler deployment status. The owner authorized L4 deployment, fast-forwarding main and pushing main/prism-forward. Authorization remains valid, but release is **blocked before deployment** because Codex Browser cannot verify saved browser permissions for either the local preview or production. It explicitly prohibits bypassing that check. Restore browser access before continuing the required interactive preview/live acceptance.

- `a309606`: existing folder organization committed separately on `prism-forward`.
- `3c6150f`: separate approved L2 pre-release fix; one report textarea contains every skipped cell grouped by category, while the skipped list stays plain text. The 300-cell regression passes.
- **260 unit, 40 Worker, 263 full Linux browser tests passed**, with two existing exclusions and zero final failures/retries. Source/catalog/format/lint/type/build and both strict dry runs passed. The first full run had one existing F2 WebKit resize/touch failure, followed by a passing unchanged focused test and full rerun; retained in the release record. The 2,400px budget is unchanged and passes.
- Production has **no pending migrations**. A D1 bookmark and explicit rollback target are recorded. No migrations were applied, no deploy/rollback occurred, main was not advanced and neither branch was pushed. Local and remote main, and remote prism-forward, remain `5f291b6` at inspection.
- See [the L4 release record and owner checklist](docs/releases/2026-10-02-launch/RELEASE.md), [verification receipt](docs/releases/2026-10-02-launch/l4-verification.json) and [full final browser log](docs/releases/2026-10-02-launch/l4-linux-browser.txt). Resume from the record's continuation steps; recheck current live/remote/migration state and refresh the bookmark before release. Stop and ask if any migration appears. Roll back to the explicitly recorded version on any live failure.
- L1, L2 and L3 item 2 were approved by Claude as confirmed by the owner. L3 item 1 (announcement) remains outside this assignment. Physical-device and real Discord acceptance remain pending.

## October 1, 2026 — historical L2/L3 item 2 checkpoint

The original local-review notes below describe the state before the owner's L4 assignment; the current status above supersedes their review/authorization holds.

### L4 step 0 — approved pre-release correction

The owner confirmed Claude approval of L1, L2 and L3 item 2 and authorized the L2 correction followed by L4. Folder organization is committed separately as `a309606`; CODEX-PLAN.md and pre-existing research evidence remain untracked. The import review now retains a plain category-grouped skipped list and one editable/copyable report containing every skipped cell, including the distinct untracked-form reason. The catalog warning and reviewed import behavior are unchanged. The optional date display polish was omitted to preserve the approved layout.

Fresh checks: 260 unit and 40 Worker tests, plus 12 focused Windows Chromium desktop/phone checks, including 300 skipped cells producing exactly one report textarea. Full release gates and live/device evidence are recorded separately when performed.

**L1 is approved by Claude. L2 and L3 item 2 are complete locally on prism-forward and stop here for Claude review.** The owner authorized a local commit only; no push, merge or deploy. This current status supersedes the historical L1/F1/F2 review requests below.

- Added inline report drafts to Pokémon details, the Dex scanner, Sources & credits and unavailable skipped import cells. Pokémon, form and category are prefilled when known; edited text copies exactly, with an in-place fallback when clipboard access fails. The owner-approved Discord profile is an explicit new-tab link. Drafting/copying sends no request and changes no collection data.
- Home (first-run and returning) and the Dex shelf show the newer catalog/ledger date, currently **2026-09-29**. The stale warning starts after 21 calendar days. Existing Home lines contain the information; the **2,400px limit is unchanged**.
- L3 item 2 now attributes unavailable skipped cells to CatchGrid's catalog and offers the same report action. Reviewed import eligibility and apply/save behavior remain unchanged. Cody's picks, catalog data, storage/backup/compare formats, migrations, dependencies and private owner behavior are preserved.
- **259 unit, 40 Worker and 259 Linux browser tests passed**, with two existing browser exclusions, zero failures/retries in the final full run. Lint, TypeScript/artifact build, focused formatting and diff checks passed. **32 production-build captures / 48 measurements**, zero console/page/CSP errors; maximum captured phone Home height **2,394px**. Intermediate failures and evidence limits are recorded in the [L2 review](docs/releases/2026-10-02-launch/L2-REVIEW.md), with browser log, source hashes and screenshots.
- **L3 item 1 and L4 are unstarted.** Do not write the announcement, publish, or continue a later phase without a separate owner assignment. Physical-device, real Discord and live-site acceptance remain unverified. CODEX-PLAN.md has phase status notes and stays local/untracked.
- Pre-existing repository organization edits and evidence are preserved and remain unstaged. Only this phase's handoff note is included in the phase commit; the existing HANDOFF reorganization is not swept into it.

## Current checkpoint

- Checkout: `prism-forward`; application candidate `3c6150f`, based on organization `a309606`, approved L2 `09d2cd2` and L1 `8f2842e`. Release-record documentation follows separately. CODEX-PLAN.md and pre-existing research evidence remain untracked and excluded from commits.
- F1 (`a716449`) and F2 (`d2aa25f`) were approved according to the current plan. Their local backup/install guidance and phone Progress/social-card work remain intact and undeployed.
- L1 (`8f2842e`) completed the official-source catalog audit locally and was approved by Claude on October 1. Historical L1 checks: 257 unit, 40 Worker and 16 focused Windows browser tests, plus lint/build/catalog checks. The audit corrected Toxel and Sinistea availability; unsourced entries remain unavailable. [Audit and evidence](docs/releases/2026-10-02-launch/CATALOG-AUDIT.md).
- Confirmed current production release: `c49945a`, Worker `0891c9e5-8a9c-4736-beae-2e796325dfef`, originally deployed September 28. [Successful production release record](docs/releases/2026-09-28-first-run-2/RELEASE.md). L4 preparation freshly verified this state without changing it.

## Selected next work and limits

Restore interactive browser access, then finish the already-authorized L4 release using the release record. All required source and Linux automated gates have passed for application candidate `3c6150f`. Do not infer completed live checks from fixture tests or historical captures. The owner already authorized deploy, fast-forward and both pushes; do not request that authorization again. L3 item 1 remains unstarted.

Physical iPhone Safari/Home Screen, Android Chrome, phone drag-fill/Undo, backup/restore round trips and actual Discord-card rendering remain owner acceptance items. Browser emulation and dated checks are separate from physical proof.

Preserve browser-local profiles, reviewed imports and recovery, stable form IDs, the exact eight recommended strings, default-representative totals, private owner storage separation, themes/accessibility, PWA update acceptance and the 2,400px phone Home content budget. Keep the recorded sharp/libheif development advisory and catalog freshness gaps explicit; organization did not solve them.

## Organization completed

Internal tools now live under `scripts/catalog`, `artwork`, `validation`, `captures`, `release` and `legacy`. Package commands and executable repository-root resolution were repaired. The legacy catalog script is retained for history and is not part of the current sync command.

Retired code and old test output are under ignored `archive/`. Application source, assets, catalog, migrations, research evidence, local configuration/database and dependency versions were preserved. Full prior handoff history is [retained here](docs/history/HANDOFF-through-2026-09-30.md); use it for dated evidence, not as current next-step instructions.

Current organization checks and limits are recorded in [the organization report](docs/organization/2026-09-30.md). The full move manifests and original changed-file bytes remain locally in `../Organization-2026-09-30/catchgrid/`.

Fresh organization checks: 257 unit and 40 Worker tests, lint, catalog/Pokémon-data validation and the artifact build passed. All 2,711 protected-file hashes remain unchanged. Changed-file formatting passed; repository-wide formatting still flags the untouched local CODEX-PLAN.md. Browser/device/live checks were not run.
