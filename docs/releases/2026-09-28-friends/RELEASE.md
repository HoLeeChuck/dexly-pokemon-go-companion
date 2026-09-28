# Friends release — Phase F1 review record

Status: **F1 implemented and self-reviewed by Codex; awaiting Claude. Local only.** The owner authorized committing F1 on `prism-forward`, with no push or deployment. F2 and F3 are not implemented. This is a preparation record, not a production release.

## Acceptance review

| F1 requirement | Result and evidence |
| --- | --- |
| Home backup reminder after 25 new entries or seven days with changes | Pass. Counts currently owned keys absent from the last export, including alternate forms and categories. The seven-day clock starts when an unexported collection difference is first observed. Removals count as changes for the time threshold; an unchanged export never nags. |
| Dismissible, without nagging | Pass. Dismissal survives reloads and navigation. It snoozes until another 25 additions or seven more days with unexported changes. Returning to the exported collection cancels the pending change clock. |
| Last export date in preferences; export clears reminder | Pass for JSON, CSV and XLSX. A failed download does not clear the reminder. Settings shows the last export date. Home's backup action downloads the existing complete JSON format. |
| Dismissible iOS Safari hint below the welcome hero | Pass. iPhone/iPad Safari detection, remembered dismissal, and both `navigator.standalone` and `display-mode: standalone` checks are covered. Standalone hides the hint and install link. |
| Browser-only storage and cross-device instructions in Settings | Pass. Settings says phone and computer are separate and describes Download JSON → Import. The banner's install link opens and focuses the instructions. Instructions also cover exporting before moving into a Home Screen app. |
| Request persistent storage once after ten entries | Pass. The preference is set before the asynchronous request, so navigation, repeated renders and reloads do not request again. Settings queries the current grant on each load and displays yes/no; denied, rejected and unavailable APIs are handled. Status refresh is confined to Settings. |
| No collection/schema/backup changes | Pass. Safety bookkeeping only writes `catchgrid:prism:backup-reminder:v1`, `catchgrid:prism:storage-persist-requested`, and `catchgrid:prism:ios-install-dismissed`. Browser tests compare the raw stored profile before/after reminders, dismissal, persistence and export; JSON contents retain the collection. Storage contracts, recovery code, catalog, recommendation strings, dependencies and migrations are untouched. |
| 390×844 layout, both themes, unchanged 2,400px budget | Pass on Linux Chromium and WebKit. New Home with hint: **2,332px**; returning after export: **2,380px**; small returning collection with banner: **2,375px**; empty collection with both notices after clearing: **2,394px**. These use the existing content-height formula excluding the documented 77px navigation clearance. The original seeded Home height test also passes with its banner. No limit or exclusion was changed. |
| Keyboard, accessibility and controls | Pass. Existing keyboard traversal includes the new dismiss button on iOS. Notice actions have at least 44px height and do not overlap dismissal. No serious/critical axe findings in the new/returning/banner/combined states in either theme. |
| Before/after captures | Pass for F1: eight before and eight after images cover desktop/phone Home (new, returning after export, banner) and Settings. Phone uses an iOS Safari user agent for hint coverage, with system Chrome rendering. See [before](../../shots/f1-before/) and [after](../../shots/f1-after/). |
| Phone Progress single-category mode and new social card | Deferred to F2, as required by the F1-only scope. No F2 screenshots or implementation are claimed. |
| Owner device checklist | Recorded below; requires real devices and a future authorized release. Browser emulation is not physical iPhone/Safari or Android proof. |

## Validation

- `pnpm.cmd test`: **253 unit tests, 40 Worker tests passed**.
- `pnpm.cmd lint`: passed.
- `pnpm.cmd run build:artifact`: TypeScript, public/private clients, Worker and bundle report passed. Existing large-chunk warning remains informational.
- Focused Prettier and `git diff --check`: passed.
- Full Linux browser suites, fresh Ubuntu 26.04 WSL copy with the frozen lockfile and Node 24.19.0: **209 passed, four existing exclusions, zero failures or retries**. Breakdown: Chromium desktop/phone/PWA **115 passed**; WebKit desktop/phone **94 passed**. All 52 F1 browser cases passed. [Full log](f1-linux-browser.txt), [summary, measured heights and source hashes](f1-verification.json).
- Local production preview at `http://127.0.0.1:5192/`: all eight captures had production CSP headers, **zero CSP violations, page errors or console errors**, and no horizontal overflow. [Measurements](../../shots/f1-after/measurements.json). Its persistence API is intentionally stubbed to denial for deterministic screenshots; real grant behavior is browser-controlled.
- Self-review included phone welcome, backup banner and Settings images; preference-only writes; export error ordering; scope; source hashes; and the retained 2,400px assertion. Desktop empty and phone returning captures are byte-identical to before. Desktop returning has identical dimensions with a localized ring-legend colour difference; it is not claimed as byte-identical.

Interim checks caught a Dex navigation timing failure. Self-review also identified an unnecessary asynchronous persistence-status refresh outside Settings; that refresh was narrowed to Settings, and navigation passed both subsequent full runs. The initial navigation failure is not treated as a proven root-cause diagnosis. An intermediate layout measured 2,408px in both Linux engines after separating the dismiss hit area from the action links. Reducing banner-state card padding brought it under the unchanged limit. Early Windows development checks also ran during an HMR edit and tried to import an empty fixture (the existing UI correctly disables empty imports); final tests use the real bulk-clear flow. These interim results are not represented as successful verification.

## Implementation choices and references

The new preference stores exported/dismissed key baselines and dates, independently of the profile. Existing collections with no export record qualify immediately at 25 entries. With fewer entries, observation starts the seven-day clock; no old export date is invented. Preference write failures retain in-memory behavior for the current tab through the existing safe preference helpers.

The first-run phone steps are compact rows and the portrait group is narrower to reserve space for the hint. Banner-state dashboard padding is compact; a returning dashboard with no reminder keeps its existing layout. Desktop layout and the rest of the product retain their current behavior.

Persistent storage is requested through the browser's [Storage API](https://webkit.org/blog/14403/updates-to-storage-policy/). The result is not inferred from installation or saved as a permanent grant. The install instructions account for [separate Home Screen app storage](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/): export first and import in the installed app. Downloaded backups remain useful even after persistence is granted.

## Owner checklist before sharing the eventual release

- [ ] Open the Discord link on a real iPhone in Safari.
- [ ] Add CatchGrid to the Home Screen; open it from the icon and verify the install hint is absent.
- [ ] Export JSON before moving an existing Safari collection into the Home Screen app; import it there and verify counts.
- [ ] Open the Discord link on a real Android phone; exercise marking and backup download.
- [ ] Import the community spreadsheet through review on the real devices and verify counts.
- [ ] Export JSON on one device and import it on the other; compare collection counts and forms/categories.
- [ ] Complete the F2/F3 acceptance items and a separately authorized release before claiming the full Friends release is ready.

No main-branch update, push, deployment, production migration or live-data mutation was performed for F1. The owner's plan receives the requested status note locally and remains excluded from the phase commit.
