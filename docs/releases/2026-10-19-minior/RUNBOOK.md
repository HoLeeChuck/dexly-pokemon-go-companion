# Minior catalog update — October 19, 2026

> October 15 restack: this branch now includes the revised `bramblin-2026-10-15` candidate. Use [MINIOR-GO-2026-10-19.md](../MINIOR-GO-2026-10-19.md) and [OCTOBER-RELEASE-OPERATIONS.md](../OCTOBER-RELEASE-OPERATIONS.md) for current operations. Original tip `48d3cac` is retained at `backup/minior-before-prep-2026-10-15`. Earlier counts and base hashes below are historical. No push or deploy occurred.

The October 15 full Linux rehearsal found nine failures already reproducible on the saved October 12 tip: phone Home was 2410px (2406px with notices) against its unchanged 2400px budget, the footer link was only 41px tall, and the landscape header exceeded the safe area by 3.64px. Three CSS corrections reduce phone medal block padding from 6px to 4px, increase inline footer-link block padding from 15px to 17px, and reduce the 800-1000px header gap from 12px to 8px. The assertions, fonts, layout structure, data behavior and desktop styles remain unchanged. Final results are in the prep report.

## Oct 19 evening: Cody's checklist

Your part takes about 2 minutes. Claude does the rest and stops on anything unexpected.

1. **After 5:00 p.m. CDT on Monday, Oct 19** (when the Orionids meteor shower starts), open the **HQ · CatchGrid** chat and type **go** yourself. A "go" passed along by the PM chat doesn't count.
2. That one "go" covers: the final checks, the deploy, the live checks, a rollback if anything fails, and committing + pushing the results (steps 1–9 below). Nothing else.
3. Claude first re-reads the official Minior post. If Niantic moved the shower or announced Shiny Minior, Claude stops and asks you before changing anything.
4. **Bramblin must already be live.** This branch is built on top of it. If Bramblin hasn't shipped, Claude stops and asks.
5. **When Claude reports done**, open https://dex.cjdev.app on your phone. Home should say **Catalog updated 2026-10-19**. Search "Minior": Normal should be markable, Shiny should not. Search "Brambleghast": Normal markable, Shiny not.
6. **Also check the five small polish changes** (OK'd on Oct 11):
   - With your phone in light mode, a private tab opens CatchGrid light. Dark mode opens it dark.
   - The top-right search and appearance buttons show drawn icons.
   - Dex › Kanto opens on Bulbasaur (#0001).
   - Home medals show lines like "3 not in GO yet" (Sinnoh).
   - The footer "Sources & credits" link is easy to tap.
7. If anything looks wrong, tell Claude **"roll back"**. The site goes back to the Bramblin version. Your saved collections are not affected.

---

Prepared October 10, 2026 by Claude on local branch `minior-2026-10-19`, on top of `bramblin-2026-10-13`. The owner OK'd preparing it on October 10 (through the PM chat). **Nothing is deployed or pushed.** As with Bramblin, there is no date-gated code: the release ledger rejects future dates, so this ships on the debut day.

## What changes

The catalog part is one release-ledger entry plus the tests that pinned the old state. The small app polish riding along is listed in its own section below. No migrations, artwork, schema or dependencies change.

- `catalog/releases.v1.json`: **#774 Minior released 2026-10-19**: Normal, Lucky, 100%, XXL and XXS. **No Shiny**, Shadow or Purified (none announced). Minior is genderless.
- `catalog/releases.v1.json`: **#947 Brambleghast released 2026-10-13** (obtainable by evolving Bramblin: 50 Candy, walk 20 km as buddy): Normal, Lucky, 100%, XXL and XXS, mirroring Bramblin. **No Shiny**, Shadow or Purified. This is added on Cody's 2026-10-15 decision with **community sources**: Niantic's Buddy Trek page does not mention Brambleghast. The record's `source` stays the official Bramblin page; the new optional `communitySources` field carries [Leek Duck](https://leekduck.com/events/fall-marathon-buddy-trek-2026/) and [Serebii](https://serebii.net/pokemongo/events/fallmarathon:buddytrek.shtml), which Sources & credits lists under Community references (never as official). `app/releases.js` validates the field (https links) and `catalog/README.md` documents it. Bramblin's own note now points to this entry instead of saying Brambleghast stays unreleased. Backups of the pre-change tips: `backup/minior-before-brambleghast-2026-10-15`, `backup/greavard-before-brambleghast-2026-10-15`.
- The catalog keeps one default Minior representative. The October 15 source recheck says core colors debut across different showers; the first color and all-seven availability are not established. No color forms are added in this approved scope. The earlier claim that the colors were merely battle states was too broad.
- Tests: `tests/unit/app-launch-catalog.test.ts` (Minior released without Shiny; import now accepts 7 of the original 73 with Brambleghast, 66 not eligible), `tests/e2e/catalog-feedback-app.spec.ts` (freshness shows `2026-10-19`; stale check moved to Nov 11) and `tests/e2e/app.spec.ts` (compare total **958**).
- Effect: "Catalog updated" becomes **2026-10-19**. The stale warning moves from about Nov 3 (after Bramblin) to the evening of **Nov 9** (UTC Nov 10).

## Polish riding along (owner OK through the PM chat, October 11)

From [the polish review](../../POLISH-REVIEW.md). These are small app changes in a separate commit after the Minior catalog commit. No storage, backup, import, catalog data, migration or dependency changes.

- **Appearance follows the device on first visit.** `public/prism-bootstrap.js` uses `prefers-color-scheme` until the person picks a theme. A saved choice still wins. `app/main.js` now names the toggle correctly on load (it used to always say "Switch to light appearance"), and the Settings copy no longer says "Dark by default".
- **Medal note.** `medalShelf` (`app/insights.js`) returns `unavailable`: the default species in the region whose category isn't released. Each medal with any shows "N not in GO yet" on its own line (`.medal-unavailable`). The total and thresholds are unchanged (the S version, not a recount). Phone medal cards lose 2px of vertical padding to keep the 2,400px phone Home limit: returning Home measured 2,377px in a local capture, and the budget tests pass.
- **Header icons.** `index.html` uses drawn SVGs (the tab-bar search path, plus a half-filled circle) instead of the `⌕`/`◐` characters. CSS is in `app/features.css` (`.header-icon`).
- **Phone tap targets.** The footer "Sources & credits" link gets 15px inline padding (a 44px tap area with no layout shift). `.evolve-option` labels (the Settings silhouettes checkbox, and the Search Lab options) are at least 44px tall, with checkboxes that can't shrink. The Search Lab "Storage filters" summary is at least 44px.
- **Kanto starts at #0001.** The default selection in `app/main.js` is Bulbasaur, not Charizard.
- Tests: new `tests/e2e/polish-app.spec.ts` (light/dark first visit and saved choice, Bulbasaur start, medal note, SVG icons, 44px phone targets). `tests/unit/app-features.test.ts` covers `unavailable`. `tests/e2e/catalog-feedback-app.spec.ts` now expects the scanner report to start at #1 Bulbasaur, then #2 Ivysaur.
- After screenshots: `docs/shots/polish-2026-10-11/after-phone-light-medals.png` and `after-phone-light-system-01-home-first-run.png`.
- Not covered before deploy day: WebKit (the new spec also runs there in the full Linux suite, step 3) and real phones.

## Source (official)

- [Explore by starlight during meteor showers for a chance to encounter Minior!](https://pokemongo.com/news/minior-meteor-showers-2026). The post says Minior "will make its Pokémon GO debut". First shower: **Orionids, October 19–24, 5:00–11:59 p.m. local**; Explore by Starlight 5:00–9:00 p.m. Later showers: Leonids Nov 14–19, Geminids Dec 11–16, and others in 2027. Found in the wild in Meteor Form. Shiny Minior is not mentioned. Read on October 10, 2026.

## Pre-checks re-run on October 12, 00:12 CDT (with the header fit fix, on Bramblin + pill fix)

- **Header fit fix added** (`fix: keep the landscape header clear of the right safe area`, owner OK on Oct 12). The October 11 pre-checks below used `test:e2e:chromium`, which leaves out the `pwa-chromium` project. That project caught the drawn header icons pushing the appearance button to 801px at 844×390 with 47px safe-area insets (the limit is 797px). With 16px icons, a 4px gap and 9px side padding on the icon-only button, it's at 783px (782px before the icons).
- Unit: **294 passed, 1 expected failure** (Bramblin's and Minior's future dates). Worker 40/40, lint, Prettier, TypeScript `tsc -b`, Pokémon-data validator and catalog verify all passed.
- Windows Chromium desktop + phone **+ PWA: 155 passed, 2 skips, 0 failures**. The pill fix from Bramblin is underneath, so its `encoding-app` check runs here too.

## Pre-checks re-run on October 11, 01:22 CDT (Minior + polish, on Bramblin's six entries)

- Unit: **263 passed, 1 expected failure** (Bramblin's and Minior's future dates). Worker 40/40, lint, Prettier on the changed files, TypeScript `tsc -b`, Pokémon-data validator and catalog verify all passed.
- Windows Chromium, desktop + phone: **150 passed, 2 skips, 0 failures** (the second skip is the phone-only tap-target test on desktop). One intermediate focused run had a single failure in "retired and unknown routes fall back to Home" (`main` briefly empty). It passed in the next two runs, unchanged; recorded as an intermittent result, with no root cause claimed.

## Pre-checks done on October 10 (branch working tree)

- Unit: **262 passed, 1 expected failure**: the ledger file test reports Bramblin (until Oct 13) and Minior as future dates. With the clock fixed, the ledger still fails at `2026-10-18T23:59Z` and validates cleanly at `2026-10-19T00:00Z` and `2026-10-19T22:00Z`. (The validator uses UTC days, so it passes from 7:00 p.m. CDT on Oct 18, before the debut. Deploy after 5 p.m. CDT on Oct 19 anyway.)
- Worker 40/40, lint, Prettier on the changed files, Pokémon-data validator and catalog verify all passed.
- Windows Chromium, desktop + phone: **139 passed, 1 existing skip, 0 failures**.
- Full Linux browser suite: not run yet. It's saved for deploy day (step 3).
- `dist/` was not rebuilt.

## Deploy day: October 19, after 5:00 p.m. CDT (needs Cody's "go" in the CatchGrid chat)

Use Command Prompt (`cmd`), not Windows PowerShell 5. From `D:\Projects\Pokemon\CatchGrid`:

1. **Re-check the source.** Re-read the official post and confirm the Orionids dates haven't moved. Check pokemongo.com news for Shiny Minior. If it's announced, add it as its own dated entry with that link. Also re-read the official Buddy Trek page and news for Brambleghast: if Niantic now documents (or contradicts) the evolution, update the #947 record and tell Cody.
2. **Branch state.** Bramblin must be live and recorded on `prism-forward`. Rebase this branch onto `prism-forward` (only the Minior commits should move). `git status --short` should show only `?? CODEX-PLAN.md` and `?? evidence/`. Fast-forward `prism-forward` to the Minior commit. Never commit CODEX-PLAN.md.
3. **Gates.** `pnpm.cmd run test` (all unit tests pass now, with no expected failure), `pnpm.cmd run lint`, `pnpm.cmd run validate:pokemon-data`, `pnpm.cmd run catalog:verify`. Then the full browser suite on clean Linux (WSL, `git archive` snapshot, as in the L4 record).
4. **Build and dry run.** `pnpm.cmd run build:artifact`, then `pnpm.cmd exec wrangler deploy --dry-run --strict`.
5. **Live state.** `pnpm.cmd exec wrangler deployments status` should show the Bramblin version `8fea498e-a753-41b3-82dd-80be37e300c3` at 100% (record its ID as the rollback target; stop if it differs). `pnpm.cmd exec wrangler d1 migrations list dexly-db --remote` should show **No migrations to apply**; if any are listed, stop. Then `pnpm.cmd run release:bookmark:production` and record the bookmark.
6. **Deploy:** `pnpm.cmd run release:deploy:production`. Record the new version ID.
7. **Verify:** `pnpm.cmd run release:smoke:production`, `curl -s https://dex.cjdev.app/api/health` (new gitSha and version), then `node archive\release-work\2026-10-04-recheck\live-checks.mjs https://dex.cjdev.app archive\release-work\2026-10-19-minior\live-production`. In a fresh profile, confirm that Minior's Normal cell is markable, Shiny is not, and Home reads `Catalog updated 2026-10-19`.
8. **On any live failure, roll back** to the Bramblin version from step 5: `pnpm.cmd run release:rollback:production 8fea498e-a753-41b3-82dd-80be37e300c3 --yes`, then smoke and health again.
9. **Record and push** (part of the go): update HANDOFF.md and this file with real results, commit on `prism-forward`, `git checkout main && git merge --ff-only prism-forward && git push origin main prism-forward && git checkout prism-forward`.
