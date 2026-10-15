# Bramblin release preparation, October 15, 2026

**Bramblin is ready for Cody's release go. Nothing was pushed or deployed.** The candidate is `bramblin-2026-10-15` in `D:\Temp\catchgrid-bramblin-2026-10-15`. Minior and Greavard are restacked locally and retain their scheduled dates. Their future-date test failures are intentional until those dates; their browser suites now pass.

This report's authoritative copy and all supporting material are in that worktree. An identical report is copied to `D:\Projects\Pokemon\CatchGrid\docs\BRAMBLIN-PREP-REPORT-2026-10-15.md` for discovery. Links below use the worktree's absolute location so the copied report remains useful.

## Release decisions and official sweep

The review starts **September 29, 2026**, the newest ledger date on the original `prism-forward` checkout (`e1eedf0`), and runs through **October 15**. It also checks the prepared candidate's October 13-15 interval and every item marked future-dated in `docs/codex-questions.md`. The October 4 deploy date was not used as the starting point.

Read the [complete official sweep](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/OFFICIAL-NEWS-SWEEP-2026-10-15.md) for the dated decisions, costume/background/item exclusions, unresolved questions and all source links. The [40-page source manifest](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/official-source-manifest.json) records retrieval times and SHA-256 values; original responses remain in the worktree's ignored `archive/release-work/2026-10-15-prep/official/`. Dates describe availability or event times, not guessed article publication dates.

| Available | Finding and decision                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sep 29    | Shiny Applin and its sourced evolutions are already covered. Preserve.                                                                                                                             |
| Oct 2     | Preserve Shiny Shroodle and Shadow/Purified Zekrom, Wimpod, Fomantis and Sandygast from the prepared release.                                                                                      |
| Oct 2     | Add Shiny Grafaiai and Shadow/Purified Golisopod and Palossand. Official GO evolution announcements support these inferences; the ledger explicitly labels the inference and records both sources. |
| Oct 3     | Add dated provenance for Shiny Gigantamax Cinderace. It was already available in the base catalog, so this record does not newly enable it.                                                        |
| Oct 13    | Preserve Bramblin Normal, Lucky, 100%, XXL and XXS. Shiny Bramblin and Brambleghast remain unavailable because sufficient official evidence was not established.                                   |

The revised candidate contains **ten ledger records beyond `prism-forward`: nine availability records and one provenance record**. Four records are new in this prep; the original six remain. The displayed date stays **Catalog updated 2026-10-13**, because today's review does not change an obtainable date. Shadow/Purified Lurantis stays unavailable pending official GO evolution evidence. No form IDs, category model, artwork, migrations, dependency versions or private owner catalog data changed.

The future sweep retains Minior on **October 19 after 17:00 CDT** and Shiny Greavard on **November 1 after 10:00 CST**. It also identifies October 24 Dynamax lake-trio encounters, Halloween costumes, October 31 Mega Chandelure, later event backgrounds/rewards and undated Dynamax species. Unsupported categories are documented rather than silently added. Minior's colors debut across different showers; the first color is not identified, so the approved single default representative remains.

**November follow-ups:** official 2023 documentation establishes Greavard-to-Houndstone evolution, correcting the older runbook's lack-of-source claim. The prepared Greavard branch still enables only Greavard; its go checklist requires an explicit on-day decision about Shiny Houndstone under the same sourced-evolution policy. Mega Chandelure also needs its form identity/types reviewed and an appropriate October 31 or later release. Neither known follow-up is concealed by a claim that the November catalog is fully caught up.

## Branches and preservation

| Branch/ref                                       | Outcome                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prism-forward` at `e1eedf0`                     | Original checkout preserved. Its tracked tree stays clean. Brief, `CODEX-PLAN.md`, October 11 screenshots and earlier audit evidence remain untouched. Only the requested report copy is added there.                                                                                          |
| `bramblin-2026-10-13` at `847a513`               | Original candidate preserved. The new October 15 branch started here, retaining the existing REGISTERED dot fix.                                                                                                                                                                               |
| `bramblin-2026-10-15`                            | Four sourced ledger records, two unit tests, new release checklists/helpers, research and continuity documentation. Catalog implementation commit: `e5068ca`. Final tested production artifact source: `0cdb381`; subsequent changes on this branch are reports and verification helpers only. |
| `minior-2026-10-19`                              | Original four commits rebased cleanly onto revised Bramblin. Corrected color wording and three existing cross-platform CSS defects. Application/test candidate tested at `2f8c276`.                                                                                                            |
| `greavard-shiny-2026-11-01`                      | Original three commits rebased cleanly onto revised Minior, inheriting its corrections. Refreshed November source decisions. Application/test candidate tested at `2db8603`.                                                                                                                   |
| `backup/minior-before-prep-2026-10-15`           | Preserves original `48d3cac`.                                                                                                                                                                                                                                                                  |
| `backup/greavard-before-prep-2026-10-15`         | Preserves original `1329e94`.                                                                                                                                                                                                                                                                  |
| `polish-after-2026-11-01` at `71c6709`           | Preserved, not included or restacked. Rebase its own changes onto the eventually released Greavard source only for its separately authorized later work.                                                                                                                                       |
| `codex/post-redesign-release-audit` at `68a1226` | Inspected read-only. This is an obsolete August 30 audit line with retired Events/Field Kit code, not the correct release base. Left untouched.                                                                                                                                                |

Final report/evidence commits are propagated through Minior and Greavard with documentation-only restacks. Use the named branch refs for their final tips, not the historical tested hashes as checkout instructions. No `main`/`prism-forward` fast-forward, remote branch update, HQ message, migration, bookmark, secret change or deployment occurred. Original `.dev.vars`, `.wrangler/state`, profiles and live `dist/` were not modified.

## Validation results

Windows used Node **24.19.0**, pinned pnpm **11.21.0** via Corepack and Wrangler **4.120.1**. Linux used the existing Node 24.19.0 runtime and Chromium/WebKit installations. The lockfile and dependency versions were preserved.

| Check                                                                            | Bramblin                               | Minior                                                     | Greavard                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Unit suite                                                                       | **295 passed**                         | **296 passed**, one expected date-guard failure for Oct 19 | **297 passed**, one expected date-guard failure listing Oct 19 and Nov 1 |
| Worker suite                                                                     | **40 passed**                          | Same unchanged Worker/configuration as Bramblin            | Same unchanged Worker/configuration as Bramblin                          |
| Full Linux browser suite, all five projects                                      | **267 passed, 2 existing skips**       | **289 passed, 4 applicable skips**                         | **289 passed, 4 applicable skips**                                       |
| Final browser failures/retries                                                   | **0 / 0**                              | **0 / 0**                                                  | **0 / 0**                                                                |
| Actual production-artifact desktop/phone checks, Chromium and WebKit, light/dark | **140 passed**, no console/page errors | **140 passed**, no console/page errors                     | **140 passed**, no console/page errors                                   |
| Type check and production artifact build                                         | Pass                                   | Pass                                                       | Pass                                                                     |
| Strict production deployment dry run                                             | Pass                                   | Repeat on authorized deploy day                            | Repeat on authorized deploy day                                          |

Bramblin's complete `validate:source` passes binding generation/check, lint, formatting, unit/Worker tests, Pokémon-data validation and catalog verification. Validators confirm **1,025 National Dex representatives, 1,269 forms, 10 costumes, 73 transformations and 1,915 unique sprite references**; immutable generation checks reproduce the existing catalog and migration exactly. Minior/Greavard lint and touched CSS formatting pass; their builds pass with generated Worker typings. No date guards or browser assertions were weakened.

The browser projects are mobile/desktop Chromium, mobile/desktop WebKit and PWA Chromium. Their coverage includes imports/exports and recovery, storage failure behavior, comparison, search, freshness, responsive navigation, accessibility, offline caching and explicit update acceptance. The future suites add two desktop skips for phone-only polish checks, in addition to the two existing exclusions. Fixture suite results, built-artifact previews, public health and physical-device evidence are separate.

### Defects found and resolved in the future releases

The first full Minior and Greavard Linux runs each had **nine failures** (280 passed, four skips). A focused run on the preserved Minior tip `48d3cac` reproduced all nine, establishing that these predated the new catalog changes:

- Returning phone Home measured **2,410px**, and the notices variant **2,406px**, against the unchanged **2,400px** limit.
- The footer link measured **41px**, below the required **44px** tap area.
- The landscape header extended **3.64px** into the right safe area.

The fix is three CSS values in Minior, inherited by Greavard: phone medal padding **6 → 4px**, inline footer block padding **15 → 17px**, and the 800-1000px header gap **12 → 8px**. The approved visual structure, content, fonts, data behavior and desktop layout remain. Full suites then pass without retries. Actual artifact captures measure returning phone Home at **2,390px** and the footer target at **45px** in both Chromium and WebKit, both themes, without horizontal overflow. Impeccable's detector found only the pre-existing width transition and accent-border rules elsewhere in the files; those unrelated styles were preserved.

### Rehearsal limitations and recovered setup failures

- Windows WebKit crashed during an initial full-page screenshot. Linux WebKit completed the full suite and every final artifact capture. The failed attempt is retained in the ignored archive; it is not presented as passing Windows WebKit evidence.
- A fresh Linux directory initially lacked one offline dependency tarball. The helper now installs exact frozen-lockfile versions with cache reuse. A separate disposable baseline attempt hit pnpm's external-symlink guard; it was abandoned and repeated with a normal isolated install.
- Fresh Linux artifact builds initially lacked generated Worker typings; running the normal `cf-typegen` step resolved this. These were setup failures, not catalog/application failures.
- This WSL setup mounts `/tmp` in memory. Console logs and screenshots were copied to the Windows worktree before shutdown, but transient initial trace directories are gone. The reusable helper now retains future runs below `~/.cache/catchgrid-browser/` instead.
- No physical phone, real collection, live-game availability, authenticated owner mutation, or new production/PWA release was exercised. Fresh live and physical checks remain in the go procedure.

## Screenshots and evidence

Final artifact capture sets cover **Home, Dex, Progress, Search Lab, Settings, Sources & credits, and the registered Bramblin inspector**, at **1440×900 desktop** and **390×844 phone**, in both themes and engines. There are **52 final core screenshots per release, 156 total**, plus focused returning-Home captures for the Minior spacing fix. Earlier attempts are retained separately. Full-page phone images show the fixed tab bar at its viewport position; that is a capture artifact, not a mid-page navigation element.

- [Bramblin desktop Home](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/linux-final/chromium-desktop-dark-home.png), [phone REGISTERED pill](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/linux-final/chromium-phone-registered-bramblin.png), [WebKit phone Progress](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/linux-final/webkit-phone-light-progress.png).
- [Minior desktop Home](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/minior/webkit-desktop-dark-home.png), [returning phone Home](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/minior/chromium-phone-dark-returning-home.png).
- [Greavard phone Sources](D:/Temp/catchgrid-bramblin-2026-10-15/docs/shots/bramblin-prep-2026-10-15/greavard/chromium-phone-light-about.png).
- [Bramblin source gates](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/bramblin-source-gates.txt), [full browser log](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/bramblin-linux-browser.txt), [artifact checks](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/bramblin-artifact-browser.json).
- [Minior final browser log](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/minior-linux-final.txt), [saved-tip baseline](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/minior-saved-tip-baseline.txt), [artifact checks](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/minior-artifact-browser.json).
- [Greavard final browser log](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/greavard-linux-final.txt), [artifact checks](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/greavard-artifact-browser.json).

The browser helper confirms the REGISTERED pseudo-element contains exactly `● `, enables Bramblin Normal and the sourced catch-ups, and rejects the unavailable cells. Screenshots also confirm the visible dot is clean.

## Strict dry run and production state

`corepack.cmd pnpm exec wrangler deploy --dry-run --strict` completed successfully against the final Bramblin production artifact, with output ending **`--dry-run: exiting now.`** [Full output](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/bramblin-dry-run.txt).

```text
Using redirected Wrangler configuration: dist/dexly_companion/wrangler.json
Read 2433 files from the assets directory
Total Upload: 61.32 KiB / gzip: 15.40 KiB
DB: dexly-db
OWNER_AUTH_LIMITER: 10 requests/60s
OWNER_MUTATION_LIMITER: 120 requests/60s
CF_VERSION_METADATA: Worker Version Metadata
ENVIRONMENT: production
--dry-run: exiting now.
```

The blank configured `BUILD_SHA`/`BUILD_TIME` bindings in Wrangler output are expected: Vite embeds release metadata through compile-time constants. The actual local Worker health check returned its build's real SHA and time. The final `dist/` has **2,428 files** (2,425 client files); its sorted file-manifest SHA-256 is **`8ae94b5e166e3a3d8ac9799fc26216ae41d1967cb79a861a21902dee38127249`**. [Fingerprint and critical-file hashes](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/artifact-fingerprint.json). The filesystem count and Wrangler's reported traversal count are recorded separately. The artifact was not rebuilt after this final dry run.

Read-only [production health evidence](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/2026-10-15-prep/live-health-before.json) still reports **October 4 source `4745a62fc55f72dfe40deb2cf262e4692ee1b393`** and **Worker `b0c70140-8b84-46f8-9198-921d6106c1d6`**. Remote deployment traffic, migration state and recovery bookmark must be refreshed during the authorized release. No remote D1 commands were run in this prep.

Only free loopback ports were used. The preview process started by this task and its identified Worker child were stopped; Linux capture servers stop via traps and the browser harness owns its own servers. No unrelated process was stopped.

## Three go checklists

1. [Bramblin, October 15](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/BRAMBLIN-GO-2026-10-15.md).
2. [Minior, October 19 after 17:00 CDT](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/MINIOR-GO-2026-10-19.md).
3. [Shiny Greavard, November 1 after 10:00 CST](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/GREAVARD-GO-2026-11-01.md).

Each links the [exact worker operations](D:/Temp/catchgrid-bramblin-2026-10-15/docs/releases/OCTOBER-RELEASE-OPERATIONS.md): fresh scope/time/source checks, all local gates, exact artifact, account/live/migration inspection, bookmark, deploy, smoke/browser/PWA checks, explicit predecessor rollback and post-success publication. Bramblin's expected predecessor is `b0c70140-8b84-46f8-9198-921d6106c1d6`, subject to recheck. Minior/Greavard rollback IDs must be recorded from their actual predecessor releases; they cannot be invented before those releases exist.

For a fresh Claude worker after Cody's go:

```text
Work in D:\Temp\catchgrid-bramblin-2026-10-15. Read docs\BRAMBLIN-PREP-REPORT-2026-10-15.md and docs\releases\BRAMBLIN-GO-2026-10-15.md in full, then follow the linked release operations. Preserve the original checkout and its untracked files, refresh all release gates and recovery information, and act only within Cody's release go.
```
