# First-run release attempt 2 — released

**Live at <https://dex.cjdev.app/> from `c49945a`, Worker `0891c9e5-8a9c-4736-beae-2e796325dfef`.** Final verification passed September 28, 2026 at 06:16 UTC (01:16 America/Chicago). The owner authorized deployment, fast-forwarding `main` to `prism-forward`, and pushing both branches, with a migration stop and rollback on live failure. This record completes that assignment.

## Release state

| Item                               | Value                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Released source                    | `c49945a04d9b822e27c9a2af1cc41bcf68883d99`                                                               |
| Worker                             | `dexly-companion`                                                                                        |
| Final live version                 | `0891c9e5-8a9c-4736-beae-2e796325dfef`                                                                   |
| Recorded rollback version          | `257fbfc0-bcc2-4b45-8125-3f079ebf475b` / Git `a8d0f722ea4dd6ede7a63ca43d85378e5be7168d`                  |
| Fresh D1 Time Travel bookmark      | `000000c8-00000000-000050f4-4e75e891f94c011f875f3c1f83b429f1`                                            |
| Migrations                         | List and apply both reported none pending; zero applied                                                  |
| Git                                | Fixes committed on `prism-forward`; `main` fast-forwarded; both branches pushed with this documentation  |
| Exact dry-run artifact fingerprint | `d9e4c7e7a3965fc9f3e5d0610e9e51f84a15151810dac1c8eaebee8db82a1927` over 2,427 client/Worker/config files |

The artifact was built once at the released source, passed the strict dry run, and was fingerprint-checked before deployment and retry. No rebuild occurred between the dry run and deployment. Production reported the expected source/version, and all 11 checked public/private-entry HTML, bootstrap, service-worker, manifest and initial JS/CSS resources matched the local artifact bytes. See [verification.json](verification.json), [deployment.json](deployment.json), [production health](production-health.json) and [live browser results](live-browser/results.json).

## Step 1: complete Linux WebKit baseline

[Run 36381020076, attempt 2](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/36381020076/attempts/2), WebKit job `108801981690`, completed the whole 70-test suite: **18 failures, one flaky test, 49 passes, two pre-existing mobile exclusions**. No fail-fast or cancellation truncated this baseline. It ran source `32b6e14`; the starting HEAD `8ed54be` differed only in documentation, so application and tests were identical.

**REAL** below means the feature failed on its initial attempt and both configured retries. Rendering stalls sometimes surfaced at different pending calls or as a crashed page; they are persistent failures, not reclassified as flaky. **FLAKY** means a normal configured retry passed. The complete test log and retry evidence are retained in [baseline-webkit.txt](baseline-webkit.txt); structured classifications are in [baseline-classification.json](baseline-classification.json).

| Classification | Project        | Test                                                  | Log line                          | Fix                                        |
| -------------- | -------------- | ----------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| REAL           | mobile-webkit  | Returning Home artwork, medals and responsive heatmap | [29](baseline-webkit.txt#L29)     | F1                                         |
| REAL           | mobile-webkit  | First-run backup/import                               | [145](baseline-webkit.txt#L145)   | F2                                         |
| REAL           | mobile-webkit  | Footer sources/credits                                | [244](baseline-webkit.txt#L244)   | F2                                         |
| REAL           | mobile-webkit  | Retired/unknown route fallback                        | [343](baseline-webkit.txt#L343)   | F2                                         |
| REAL           | mobile-webkit  | Quick jump                                            | [448](baseline-webkit.txt#L448)   | F2                                         |
| REAL           | mobile-webkit  | No horizontal overflow on destinations                | [545](baseline-webkit.txt#L545)   | F2                                         |
| REAL           | mobile-webkit  | Phone destinations, keyboard and 700px boundary       | [650](baseline-webkit.txt#L650)   | F2                                         |
| REAL           | mobile-webkit  | Blocked session storage and Dex cue                   | [737](baseline-webkit.txt#L737)   | F2                                         |
| REAL           | mobile-webkit  | Hidden Dex link preserves first-visit cue             | [830](baseline-webkit.txt#L830)   | F2                                         |
| REAL           | desktop-webkit | First-run backup/import                               | [951](baseline-webkit.txt#L951)   | F2                                         |
| REAL           | desktop-webkit | First-run introduction and logical tab order          | [1041](baseline-webkit.txt#L1041) | F2                                         |
| REAL           | desktop-webkit | Quick jump                                            | [1131](baseline-webkit.txt#L1131) | F2                                         |
| REAL           | desktop-webkit | Footer sources/credits                                | [1224](baseline-webkit.txt#L1224) | F2                                         |
| FLAKY          | desktop-webkit | Retired/unknown route fallback                        | [1321](baseline-webkit.txt#L1321) | Passed normal retry; also covered after F2 |
| REAL           | desktop-webkit | No horizontal overflow on destinations                | [1362](baseline-webkit.txt#L1362) | F2                                         |
| REAL           | desktop-webkit | Phone destinations, keyboard and 700px boundary       | [1458](baseline-webkit.txt#L1458) | F2                                         |
| REAL           | desktop-webkit | Blocked session storage and Dex cue                   | [1553](baseline-webkit.txt#L1553) | F2                                         |
| REAL           | desktop-webkit | Dex cue confined to empty Home, once per tab          | [1647](baseline-webkit.txt#L1647) | F2                                         |
| REAL           | desktop-webkit | Hidden Dex link preserves first-visit cue             | [1744](baseline-webkit.txt#L1744) | F2                                         |

## Steps 2 and 4: diagnosis and fixes

- **F1 — fallback font wrapping:** Linux WebKit's font fallback wrapped the dashboard action row, medal text, tools and footer more than Chromium; adding Arial after the existing native system fonts removes the height failure without changing the approved Windows Chromium composition.
- **F2 — animated image filters:** empty Home's interpolated image filters accompanied persistent Linux WebKit rendering stalls/crashes; crossfading static silhouette and colour layers through opacity removed all 17 persistent interaction failures while preserving the seven-image, 1.2-second stagger and reduced-motion presentation. The [upstream WebKit report](https://bugs.webkit.org/show_bug.cgi?id=264966) informed this diagnosis; the before/after full-suite result is the project-specific evidence.

Commit `e14abfe` adds permanent **failure-only** section measurements and full-page attachments from both engines. CI installs both engines for that diagnostic, explicitly uses `--max-failures=0` for WebKit, and allows manual branch runs before advancing `main`. Commit `c49945a` contains F1 and F2. No test skips/fixmes, weaker assertions, dependency upgrades or timeout-based acceptance were added.

The separate diagnostic run [36383891646](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/36383891646) captured the requested data after the complete baseline. It was then canceled to inspect that data immediately; it is **not** claimed as a passing release gate. Both the baseline above and the final candidate suite below completed in full.

The [Linux section diagnostic](linux-height-before.json) measured **2,486px WebKit versus 2,380px Chromium** on the same Linux runner. The earlier ~2,361px Chromium measurement was on Windows. The growing sections were in the seeded dashboard, not the first-run hero/how-to cards:

| Section              | Linux Chromium | Linux WebKit | Difference |
| -------------------- | -------------: | -----------: | ---------: |
| Dashboard action row |           44px |       73.5px |    +29.5px |
| Medal shelf          |      448.094px |    461.281px |  +13.187px |
| Share/tools card     |      246.406px |    294.484px |  +48.078px |
| Footer               |           96px |        111px |      +15px |

Other measured sections matched between Linux engines. The final complete suites pass the original **2,400px seeded-content limit** in both engines. The prior 77px navigation-clearance accounting is unchanged. Fresh Windows captures remain **2,361px content / 2,438px document** for the seeded phone; empty Home is 2,564px and is outside that seeded-dashboard budget.

Visual review checked Phase 1 empty Home, Phase 2 dashboard, and Phase 3 navigation captures. All four standard Chromium Home captures are byte-identical to Phase 3. Fifteen of the 16 standard screenshots are identical; desktop seeded Dex differs at 956 pixels by at most one colour-channel level, with identical dimensions. See [visual comparison](visual-comparison.json), fresh [Chromium empty](phone-home/phone-empty-chromium.png), [Chromium seeded](phone-home/phone-seeded-chromium.png), [WebKit empty](phone-home/phone-empty-webkit.png), and [WebKit seeded](phone-home/phone-seeded-webkit.png) phone captures. These captures use Windows browser engines. All seven normal-motion reveals were also checked in both engines and both themes, followed by the real import link: [animation-check.json](animation-check.json).

## Step 3: accepted dependency advisory

The owner explicitly accepted the existing sharp/libheif advisory through Miniflare/Wrangler **for this release**. The CI audit remains red: two moderate findings and one high finding, including [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). This is existing development tooling, absent from the deployed Worker bundle; the prior release used the same dependency versions. See [dependency-audit.txt](dependency-audit.txt). `package.json` and the lockfile are unchanged. A Wrangler upgrade is a separate future task. The existing catalog chunk-size advisory also remains.

## Step 5: release gates and live checks

| Check                                                     | Result                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Binding generation/check, lint and formatting             | Passed                                                                                                           |
| Unit / Worker D1 tests                                    | 241 / 40 passed                                                                                                  |
| Pokémon-data and deterministic catalog/artwork validation | Passed; catalog `2026-08-24.1`, 1,269 forms                                                                      |
| Exact candidate Linux WebKit                              | **68 passed, zero retries**, two pre-existing mobile exclusions                                                  |
| Exact candidate Linux Chromium/PWA                        | **89 passed, zero retries**, two pre-existing mobile exclusions                                                  |
| CI quality                                                | Source/tests/build/dry run passed; accepted existing dependency audit failed                                     |
| Local aggregate preflight                                 | Source/build passed; browser result 152 passed, four existing exclusions, five Windows WebKit failures           |
| Local overflow timeout follow-up                          | Passed unchanged on rerun                                                                                        |
| Final production artifact strict dry run                  | Passed                                                                                                           |
| Migration list and apply                                  | Both reported none pending; zero applied                                                                         |
| Final live smoke                                          | **11/11 passed**                                                                                                 |
| Final live artifact comparisons                           | **11/11 byte matches**                                                                                           |
| Final live browser                                        | Four isolated desktop/phone × empty/seeded contexts; eight light/dark captures; zero CSP, page or console errors |

The final complete Linux run is [36384734840](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/36384734840), on **exact source `c49945a`**. Retained logs: [WebKit](linux-webkit-final.txt), [Chromium/PWA](linux-chromium-final.txt). None of the original REAL or FLAKY cases required a retry in this run.

**No green Windows aggregate preflight is claimed.** Its four persistent failures are the previously isolated Windows WebKit behavior that skips ordinary links during native Tab navigation. An additional desktop route-load timeout passed an unchanged targeted rerun. The tests were retained, and the complete Linux suites pass all these workflows. See [local preflight](local-preflight.txt) and [overflow rerun](windows-overflow-rerun.txt). The final separate [strict dry run](dry-run.txt) verified the artifact after the aggregate command stopped at the Windows browser failures.

The user-owned `CODEX-PLAN.md` was temporarily held outside the formatter and restored with identical SHA-256 `AB176AD8234090549DACE98E3CB90782D2FE625BFEB04EB3A07E3BA6A8CD4398`; it remains untracked and uncommitted.

Live checks exercised the empty hero, seven portraits, normal-motion reveal and import focus, seeded recent artwork, six almost-complete cards, ten medals, all four phone destinations/current-page states, both themes, overflow and artwork loading. Isolated fixture contexts used the real reviewed Settings import and preserved ownership while navigating. No existing public browser profile or private owner collection was seeded. Public health/readiness/catalog succeeded; unauthenticated private bootstrap correctly returned 401. Evidence: [production smoke](production-smoke.txt), [live browser results and captures](live-browser/results.json), and [local production-preview rehearsal](local-browser.json).

## Operator wrapper incident and recovery

The first invocation used legacy **Windows PowerShell 5** with `ErrorActionPreference=Stop` and `2>&1 | Tee-Object`. It misclassified pnpm's ordinary stderr command banner as a terminating `NativeCommandError`, although the spawned Wrangler command continued. Cloudflare history confirms candidate version **`cb4f225f-1a92-4378-b0f6-c13958c37722`** became active at **06:14:01.303 UTC**, followed by the guarded rollback to **`257fbfc0-…`** at **06:14:05.563 UTC**. The wrapper also mishandled the rollback banner; the API/history and all **11 recovery smoke checks** independently confirmed successful recovery. No D1 restore was performed.

The invocation was corrected to **PowerShell 7**, guarded against older versions, and kept explicit native exit-code checks. After verifying recovery and rechecking the artifact fingerprint, the same already-approved artifact was redeployed. Final version **`0891c9e5-…`** passed every live check above. The final deployment therefore remains active. This operator false alarm is retained rather than presenting the rollout as uninterrupted. See [deployment.json](deployment.json), [recovery smoke](wrapper-recovery-smoke.txt), and [final deployment log](deployment.txt).

## Final handoff and stop

`HANDOFF.md` now reflects the actual live version, source, rollback target, bookmark, validation limits and operator incident. `main` was fast-forwarded from `prism-forward`; both authorized branches contain the source and this record. Direct pushes use the repository's existing administrator bypass; no protection setting or force push was used.

Real Safari and physical devices remain unverified. Storage/backup contracts, owner D1 data, catalog, immutable migrations and dependency versions were preserved. Release attempt 2 is complete; no subsequent phase, dependency upgrade or further deployment is part of this run.
