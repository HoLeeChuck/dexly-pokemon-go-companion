# Round 3 L4 — prepared; deployment blocked

Updated October 2, 2026 (America/Chicago), continuing the owner's October 1 assignment. **This candidate has not been deployed, main has not been advanced, and neither branch has been pushed.** The remaining blocker is the Codex Browser permission service, which refuses both local preview and production navigation because saved permissions cannot be verified. Required live browser acceptance cannot currently run. No release authorization is missing; the owner already authorized deployment, fast-forwarding main and both pushes.

## Source and production state

| Item | Recorded value |
| --- | --- |
| Folder-organization commit | `a309606` on `prism-forward`; 31 files, including 15 tool relocations |
| Separate L2 fix commit / application candidate | `3c6150fa1b7ea61503e49d97e4bb857f198590d6` |
| Approved predecessors | F1 `a716449`, F2 `d2aa25f`, L1 `8f2842e`, L2/L3 item 2 `09d2cd2` |
| Confirmed live source | `c49945a04d9b822e27c9a2af1cc41bcf68883d99` |
| Confirmed live Worker / recorded rollback target | `0891c9e5-8a9c-4736-beae-2e796325dfef` (100% traffic) |
| D1 migration list | No pending migrations; none applied |
| D1 Time Travel bookmark | `000000d4-00000000-000050f8-ca1717eb7db35fedcb00586dceb93165` |
| Local main / fetched remote main / remote prism-forward | `5f291b66dfce8d9838929193cfad61743bb2a307` |
| Fast-forward feasibility | Remote main is an ancestor of candidate; no merge conflict or force push needed at inspection |
| Exact Windows deploy artifact | 2,429 client/Worker files; manifest SHA-256 `caea543bba242fed1c19a27cec5078fb4ad47147f0dcc45c9d391cfa777e693d` |

The live source and version were independently read from `/api/health` and `wrangler deployments status`. The intended Worker, domain, production D1 UUID and account matched the runbook. No Worker deployment or rollback occurred. The original live version remains active; a rollback would be unnecessary without a live change.

## L2 correction

The import review keeps skipped cells as a plain comma-separated list grouped by category. It contains **one** report disclosure and textarea, prefilled with every skipped cell, its category and unavailable/untracked distinction. Names retain form context. The catalog warning is preserved. Edited report text still copies exactly; reviewed apply/save and eligibility are unchanged.

The 300-cell browser regression checks one textarea and one report disclosure, no controls in the plain skipped list, all 300 cells retained under their categories, exact edited copy and no profile write. It passed on desktop/phone Chromium and WebKit. The capture helper uses the new single report location. Optional freshness-date polish was omitted. Storage, backup/compare contracts, catalog, migrations, dependencies and Cody's eight strings were not changed by the correction or organization.

## Validation

- **260 unit and 40 Worker tests passed** on Windows and the clean Linux candidate snapshot.
- Linux source gates passed: binding generation/check, lint, formatting, Pokémon-data/catalog validators, TypeScript and production artifact build. Frozen-lockfile offline install used Node 24.19.0, pnpm 11.21.0 and the pinned browser/runtime dependencies. No dependencies were upgraded.
- **Final full Linux browser run: 263 passed, two existing exclusions, zero failures and zero retries/flaky results.** All five desktop/phone Chromium, desktop/phone WebKit and PWA projects completed. The unchanged 2,400px Home assertions passed, including freshness and backup/install notice states. See [final browser log](l4-linux-browser.txt) and [verification receipt](l4-verification.json).
- **12 focused Windows Chromium checks passed**, covering both viewports and the report regression. Lint, TypeScript, changed-file formatting and diff checks passed.
- Strict dry runs passed for both the Linux build and the fingerprinted Windows deployment artifact. The deployment command has not run, and must not rebuild between its final dry run and deployment.
- Twenty-one important source/config/test/lockfile/artwork hashes matched the Linux snapshot. The clean snapshot was made with `git archive` of the candidate, so it excludes `.dev.vars`, `.wrangler` state, the untracked owner plan and untracked research evidence.

### Initial failure and evidence limits

The first Linux aggregate preflight reached the end of the browser suite with **262 passed, two existing exclusions and one mobile WebKit failure** in the pre-existing F2 interrupted-pointer test. Immediately after resizing back to phone width, its one-time computed-style read saw `touch-action: manipulation` rather than `none`. The same unchanged test passed in a focused rerun, followed by the completely passing full run above. This is an observed intermittent result; no root cause is claimed. No assertions, timeouts, skips, or application code were changed to obtain the rerun. [Initial preflight](l4-linux-preflight-initial.txt), [focused rerun](l4-linux-targeted.txt). The aggregate command itself is not reported as green; the subsequent full browser gate and strict dry run passed separately.

Windows repository-wide formatting flags only the existing untracked `CODEX-PLAN.md`; the clean tracked Linux snapshot passes formatting. The owner plan remains untracked and is never included in a commit. Pre-existing research under `evidence/` also remains untracked. Existing bundle-size and accepted sharp/libheif development advisories remain.

Fresh interactive production-preview captures, live CSP/console acceptance, production report copying, live phone gestures, the candidate's live social card and post-deploy smoke are **pending**. Previous L2 captures are historical evidence, not new L4/live proof. Physical devices and actual Discord rendering are also pending.

## Blocker and continuation

Codex Browser returned the following for both `http://127.0.0.1:4188` and `https://dex.cjdev.app`:

> Browser use cannot access [the site] because saved browser permissions could not be verified.

It explicitly prohibited bypassing the security check or using an indirect workaround. The owner was asked to restore browser access. No alternate browser-control mechanism was used to circumvent that refusal. Repository automated test suites ran as their existing local validation workflow.

Once browser access is restored, continue under the existing owner authorization:

1. Inspect current Git state, confirm only documented changes, and reconfirm live Worker/version, remote branch ancestry and no pending production migration. **If any migration appears, stop and ask the owner.** Refresh the D1 bookmark before release.
2. Rehearse the required first-run/seeded/banner Home, phone Progress drag-fill/Undo, freshness and report-copy workflows in both themes against the local production artifact, including zero console/CSP errors. Preserve existing browser profiles; use synthetic fixtures and an isolated test context.
3. Retain or rebuild one exact candidate artifact as needed, rerun the applicable gates if source changed, and strict-dry-run/fingerprint the exact artifact to deploy. Documentation-only commits must be distinguished from the application SHA embedded in the artifact.
4. Follow [DEPLOYMENT.md](../../DEPLOYMENT.md): bookmark, recheck migrations, advance main using fast-forward only, then deploy the already-verified artifact. Do not execute the aggregate deployment script blindly because it automatically applies pending migrations.
5. Run `pnpm.cmd release:smoke:production`; assert the expected Git SHA and Worker version; complete the required live browser checks in both themes with zero console/CSP errors. Fetch production OG metadata and `/catchgrid-social.png`, checking `image/png`, 1200×630 and the approved slate image. Compare initial public/private-entry assets to the artifact where appropriate.
6. **On any live failure**, run `pnpm.cmd release:rollback:production <recorded-version-id> --yes` using the freshly recorded explicit target; currently `0891c9e5-8a9c-4736-beae-2e796325dfef`. Verify rollback health/smoke. Do not restore D1 or overwrite browser profiles as part of a Worker rollback. Cloudflare's [rollback documentation](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) describes that separation.
7. Replace this blocked status with actual deployment/smoke/browser/social evidence, update HANDOFF, commit the record, fast-forward main to the final prism-forward documentation commit, push both authorized branches, and verify remote SHAs. No force push or protection change is authorized or needed.

L3 item 1 (`docs/LAUNCH.md`) was not part of this assignment and remains unstarted. No Discord post or message was sent.

Local detailed logs, artifact manifests, the source archive and preparation receipt are under `archive/release-work/2026-10-01-l4/`. The Linux snapshot and first-failure trace/screenshots are retained under `/root/catchgrid-l4-20261001/` in Ubuntu WSL. These local operational files are ignored, not release source. Checked-in text log copies normalize line endings and trailing spaces; the original command output remains in those local locations.

## Owner checklist — after successful deployment, before posting

- [ ] Post the link in a private Discord channel and verify the slate CatchGrid preview card.
- [ ] Real iPhone Safari: open, mark, drag-fill, Undo; add to Home Screen and confirm the install hint disappears when opened from its icon.
- [ ] Real Android Chrome: open, mark and download a backup.
- [ ] Import the community sheet; review grouped skipped names and confirm there is one report form. Valid unavailable/untracked cells still stay skipped.
- [ ] Export JSON on the phone, import on the PC and compare counts.
- [ ] Open “Report a wrong entry”, then “Message Cody on Discord”; verify the owner's profile opens through both the Discord app and browser.
