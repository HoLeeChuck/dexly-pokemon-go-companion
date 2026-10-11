# Bramblin catalog update — October 13, 2026

## Oct 13 morning: Cody's checklist

Your part takes about 2 minutes. Claude does the rest and stops on anything unexpected.

1. **After 10:00 a.m. CDT on Tuesday, Oct 13**, open the **HQ · CatchGrid** chat and type **go** yourself. A "go" passed along by the PM chat doesn't count.
2. That one "go" covers: the final checks, the deploy, the live checks, a rollback if anything fails, and committing + pushing the results (steps 1–9 below). Nothing else.
3. Claude first re-reads the official Bramblin post. If Niantic changed the dates, or announced Shiny Bramblin or Brambleghast, Claude stops and asks you before adding anything.
4. Claude runs the full browser test suite before deploying (about 10–15 minutes), then deploys and checks the live site (about 10 minutes).
5. **When Claude reports done**, open https://dex.cjdev.app on your phone. Home should say **Catalog updated 2026-10-13**. Search "Bramblin": Normal should be markable, Shiny should not.
6. If anything looks wrong, tell Claude **"roll back"**. The site goes back to today's version (`b0c70140`) in about a minute. Your saved collections are not affected.

**Pre-checks already re-run on Oct 10 (23:45 CDT), branch `a4538ea`:** unit 261 passed + 1 expected failure (the ledger's "2026-10-13 is in the future" check, which clears from 7:00 p.m. CDT on Oct 12), Worker 40/40, lint, Pokémon-data validator, catalog verify, TypeScript `tsc -b`, and Windows Chromium desktop + phone: 139 passed, 1 existing skip, 0 failures. Live was `b0c70140` / `4745a62` at 100%, no pending migrations, and `dist/` still matched the launch fingerprint (`7a6e4a0e…`, 2,429 files). The official post was re-read the same night: dates unchanged, no Shiny Bramblin, no Brambleghast. The full Linux browser suite was not re-run (saved for deploy day, step 3).

---

Prepared October 4, 2026 by Claude on local branch `bramblin-2026-10-13` (from `prism-forward` at `258f92b`). **Nothing is deployed.** The owner chose to deploy on the debut day rather than add date-gated activation, because the release ledger rejects future dates by design.

## What changes

One release-ledger entry plus the tests that pinned the old state. No app code, migrations, artwork, schema or dependencies change.

- `catalog/releases.v1.json`: **#946 Bramblin released 2026-10-13**: Normal, Lucky, 100%, XXL and XXS. Male/Female follow Normal automatically. **No Shiny**, Shadow or Purified (none announced).
- **#947 Brambleghast stays unreleased.** The official post does not document its evolution. Fan sites list a 50 Candy and 20 km buddy evolution, but community sites are not accepted evidence. Add it only when an official page (pokemongo.com, niantic.helpshift.com, pokemon.com) documents it.
- Tests: `tests/unit/app-launch-catalog.test.ts` (Bramblin released, Brambleghast not; import now accepts 5 of the original 73) and `tests/e2e/catalog-feedback-app.spec.ts` (freshness shows `2026-10-13`; stale check moved to Nov 5).
- Effect: the site's "Catalog updated" date becomes **2026-10-13**, so the stale warning moves from about Oct 20 to about **Nov 3**.

## Source (official, dated)

- [Fall Marathon: Buddy Trek will bring Bramblin's Pokémon GO debut!](https://pokemongo.com/news/fall-marathon-buddy-trek-2026). Event: **Tuesday, October 13, 10:00 a.m. to Monday, October 19, 8:00 p.m. local time.** Bramblin from GO Pass tasks, Incense (Oct 13–16 and 16–19) and Field Research. The post mentions no Shiny Bramblin and no Brambleghast evolution. Re-read on October 4, 2026.

## Pre-checks done on October 4 (branch, uncommitted at time of writing)

- Unit: **261 passed, 1 expected failure**: the ledger file test reports `date 2026-10-13 is in the future`. The same ledger validates cleanly with the clock at `2026-10-13T00:00Z` and `2026-10-13T15:00Z`, and still fails at `2026-10-12T23:59Z` (the validator uses UTC days, so it passes from 7:00 p.m. CDT on Oct 12).
- Worker 40/40, lint, Prettier (only the untracked CODEX-PLAN.md flagged), Pokémon-data validator, catalog generation/sprite verify, TypeScript `tsc -b`: passed.
- Browser suites: see Results below.
- **`dist/` was deliberately not rebuilt** from this branch. `dist/` still holds the launched `4745a62` artifact, so an accidental deploy cannot ship Bramblin early.

## Deploy day: October 13, after 10:00 a.m. CDT (needs Cody's "go" in the CatchGrid chat)

Use Command Prompt (`cmd`), not Windows PowerShell 5. From `D:\Projects\Pokemon\CatchGrid`:

1. **Re-check the source.** Re-read the official post and confirm the event wasn't moved. Check pokemongo.com news for an official Brambleghast or Shiny Bramblin mention. If one exists, add it as its own dated entry with that link.
2. **Branch state.** `git status --short` should show only `?? CODEX-PLAN.md` and `?? evidence/`. Merge the Bramblin commit into `prism-forward` (fast-forward), and never commit CODEX-PLAN.md.
3. **Gates.** `pnpm.cmd run test` (all 262 unit tests now pass, with no expected failure), `pnpm.cmd run lint`, `pnpm.cmd run validate:pokemon-data`, `pnpm.cmd run catalog:verify`. Then run the full browser suite on clean Linux (WSL, `git archive` snapshot, as in the L4 record). The known WebKit tab-order flake (about 1 in 20) may need one rerun; record it if so.
4. **Build and dry run.** `pnpm.cmd run build:artifact`, then `pnpm.cmd exec wrangler deploy --dry-run --strict`.
5. **Live state.** `pnpm.cmd exec wrangler deployments status` should show `b0c70140-8b84-46f8-9198-921d6106c1d6` at 100% (unless something shipped since). `pnpm.cmd exec wrangler d1 migrations list dexly-db --remote` should show **No migrations to apply**; if any are listed, stop. Then `pnpm.cmd run release:bookmark:production` and record the bookmark.
6. **Deploy:** `pnpm.cmd run release:deploy:production`. Record the new version ID.
7. **Verify:** `pnpm.cmd run release:smoke:production`, `curl -s https://dex.cjdev.app/api/health` (new gitSha and version), then the live checks: `node archive\release-work\2026-10-04-recheck\live-checks.mjs https://dex.cjdev.app archive\release-work\2026-10-13-bramblin\live-production`. In a fresh profile on dex.cjdev.app, confirm that Bramblin's Normal cell is markable, Shiny is not, Brambleghast is unavailable, and the Home freshness line reads `Catalog updated 2026-10-13`.
8. **On any live failure, roll back** to `b0c70140-8b84-46f8-9198-921d6106c1d6`: `pnpm.cmd run release:rollback:production b0c70140-8b84-46f8-9198-921d6106c1d6 --yes`, then smoke and health again.
9. **Record and push** (part of the go): update HANDOFF.md and this file with real results, commit on `prism-forward`, `git checkout main && git merge --ff-only prism-forward && git push origin main prism-forward && git checkout prism-forward`.

## Results

### October 4 pre-check (branch working tree, snapshot `9aacbd5` via `git stash create`)

- Windows Chromium, desktop + phone: first run found one more pinned count. The compare test expected "Misty has 1 of 956"; with Bramblin released, the correct total is **957**. Test updated. Rerun of both affected specs: 69 passed, 1 existing skip.
- **Clean Linux (WSL, offline frozen install, Node 24.19.0), all five projects: 262 passed, 2 existing skips, 0 failures.** One flaky result: the known WebKit first-run tab-order test, which passed on retry. That flake is fixed separately on `prism-forward` (keyboard activation; 80/80 WebKit repeats passed, against 10/80 failures before). Log: `/root/catchgrid-bramblin-20261004/browser.log` in Ubuntu WSL.
- Rebased onto `prism-forward` at `d0c3072` (flake fix) on October 4. If `prism-forward` has moved since, rebase again before deploy day's gates.
