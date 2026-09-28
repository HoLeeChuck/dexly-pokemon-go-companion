# First-run release attempt — blocked before deployment

**Outcome: not released.** The owner authorized deployment to <https://dex.cjdev.app/>, fast-forwarding `main`, and pushing both branches, with an explicit stop for migrations and rollback for live failures. Pre-deployment Linux WebKit checks failed. Production was left unchanged, and no rollback was necessary.

The requested record path retains September 27. Execution crossed midnight in America/Chicago and finished September 28, 2026. This record is the stop point for the release attempt.

## Production and Git state

| Item                                              | Recorded state                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Worker                                            | `dexly-companion`                                                                                                     |
| Unchanged live version / intended rollback target | `257fbfc0-bcc2-4b45-8125-3f079ebf475b`                                                                                |
| Unchanged live Git SHA                            | `a8d0f722ea4dd6ede7a63ca43d85378e5be7168d`                                                                            |
| Unreleased candidate                              | `32b6e14c608c5333ac2931b12f5a5e062405c8d3`                                                                            |
| Git publication                                   | `main` fast-forwarded; `main` and `prism-forward` pushed to the candidate, followed by this documentation-only record |
| D1 Time Travel bookmark                           | `000000c7-00000000-000050f4-90a5de11ccfb2ce5afff8d4dfa03d03b`                                                         |
| Migrations                                        | Listing and apply both reported none pending; zero applied                                                            |
| Production deploy / rollback                      | Neither command executed                                                                                              |

The final public health response confirms the original healthy Worker and Git SHA: [production-health.json](production-health.json). **The branches are ahead of production.** GitHub accepted the owner's authorized direct pushes using the existing administrator bypass; no branch-protection setting was changed and no force push was used.

## Preparation completed

- `bc9ca97`: committed Phase 4 handoff and screenshot evidence, as required.
- `cce2955`: formatted the previously unformatted Phase 1 evidence JSON.
- `3eab3c4`: confined the system-Chrome setting to Chromium projects and used the full bundled Chromium browser for standalone app-mode testing. Playwright's default headless shell did not report standalone mode. All three PWA checks subsequently passed locally and in Linux CI.
- `32b6e14`: corrected the phone-height test to exclude both documented Phase 3 navigation additions: 56px after the footer and 21px additional main padding. The original 2,400px content limit remains intact.

Application code, catalog, migrations, dependency versions and Worker configuration did not change during release preparation; those paths match Phase 3 `8a27054` exactly. Only documentation/evidence and browser-test setup/assertions changed. `CODEX-PLAN.md` remains untracked and was not edited or committed. It was temporarily held outside the formatter for the source gate and restored with identical SHA-256, recorded in [verification.json](verification.json).

## Validation and blockers

| Gate                                                  | Result                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Binding generation/check, lint, tracked formatting    | Passed                                                                                                    |
| Unit / Worker tests                                   | 241 / 40 passed                                                                                           |
| Pokémon-data and deterministic catalog/artwork checks | Passed; dated catalog `2026-08-24.1`, 1,269 forms                                                         |
| Final candidate TypeScript, client and Worker build   | Passed                                                                                                    |
| Final candidate `wrangler deploy --dry-run --strict`  | Passed                                                                                                    |
| Linux Chromium/PWA on `32b6e14`                       | 89 passed; 2 existing mobile skips                                                                        |
| Linux WebKit on `32b6e14`                             | Failed phone-height assertion on all three attempts; remainder canceled after the blocker was established |
| CI quality                                            | Source/tests/build/dry run passed; existing dependency audit failed                                       |
| Post-deployment smoke and live first-run checks       | Not run: deployment was blocked                                                                           |

`release:preflight` was invoked, but **there is no claim of a fully passing aggregate preflight**. Initial formatting and browser-channel issues were corrected. The Windows all-browser rerun had 152 passes, four existing mobile skips, four WebKit link-focus failures and one PWA launch-mode failure. The PWA configuration failure was fixed. A minimal isolated page reproduced Windows WebKit skipping ordinary links during Tab navigation; this does not establish a Safari result or excuse the separate Linux failures.

The final Linux run is [36381020076](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/36381020076). Its WebKit check measured **2,486px** of seeded phone content after excluding all 77px of navigation clearance, against the **2,400px** maximum. This failed on the initial attempt and both retries. The [retained final WebKit log](linux-webkit-final.txt) contains the exact assertion and cancellation boundary. Chromium completed successfully before the remaining workflow was canceled.

The earlier run, [36380405549](https://github.com/HoLeeChuck/dexly-pokemon-go-companion/actions/runs/36380405549), used identical application source. Before it was superseded, mobile WebKit exhausted retries on nine checks: seeded Home height; first-run backup/import; first-run region navigation; footer links; quick jump; unknown-route fallback; phone navigation across the breakpoint; blocked session storage; and route overflow. Representative failures were waiting for the import link to become stable and waiting for the Johto heading after clicking its region. See [initial WebKit failure evidence](linux-webkit-initial.txt). The full suite was not completed, and the underlying application-versus-runner causes have not been established. These failures cannot be classified as the plan's permitted Windows-only page-process crash exception.

CI quality still reports the previously documented transitive `sharp`/libheif advisory through Miniflare/Wrangler development tooling: two moderate findings and one high finding, patched in `sharp >=0.35.4`. See [dependency-audit.txt](dependency-audit.txt). No dependencies were upgraded during this release attempt. The existing bundle-size advisory also remains.

## Stop state

No new Worker version was uploaded, no production migration was applied, no D1 restore was performed, and no live public collection was seeded. Browser rehearsal used disposable local contexts only. Production health was rechecked and remains healthy at the original version.

A future release attempt must resolve or establish an acceptable cause for the Linux WebKit failures and repeat the required gates before deployment. Real Safari and physical-device behavior remain unverified. This attempt stops with its record; no application fixes, deployment, or further release work follow it.
