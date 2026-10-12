# CatchGrid chat handoff — October 12, 2026, 00:17 CDT

Written by the outgoing worker chat ("HQ · CatchGrid") for a fresh Claude chat that will run **Tuesday's Bramblin release**. Read this, then [AGENTS.md](../AGENTS.md), the "Resume here" section of [HANDOFF.md](../HANDOFF.md), [WORKERS.md](file:///D:/Projects/Project%20HQ/WORKERS.md) (Project HQ contract), and the [Bramblin RUNBOOK](releases/2026-10-13-bramblin/RUNBOOK.md).

## Who you are

- Rename the chat to `HQ · CatchGrid` (`set_session_title` on `self`). Working folder: `D:\Projects\Pokemon\CatchGrid`.
- Status file (you own it): `D:\Projects\Project HQ\status\catchgrid.js` (id `catchgrid`). Rewrite it at start, at milestones, on blockers and at the end, with real `date` timestamps.
- Report to the PM chat **"PM — HQ"** with `SendMessage` (first line = one self-contained sentence).
- **Approvals stay with Cody.** Deploy, push, merge, migrations and posting need **Cody's own words typed in the CatchGrid chat**. A "go" relayed by the PM does not count. Local commits need Cody's OK (the PM may relay that). You never post anything.

## Live state (last checked read-only Oct 10, 23:45 CDT)

- Live: Worker `b0c70140-8b84-46f8-9198-921d6106c1d6`, build `4745a62` (launched Oct 4). Previous rollback target `0891c9e5-8a9c-4736-beae-2e796325dfef`.
- D1: no pending migrations. `dist/` holds the live artifact: `node archive\release-work\2026-10-04-recheck\fingerprint.mjs` prints `{"count":2429,"manifestSha256":"7a6e4a0e…"}`. Don't rebuild `dist/` until the deploy-day build step.
- Remote `origin/main` = `origin/prism-forward` = `258f92b`. Everything below is **local and unpushed**.

## The branch stack (linear, each on the one before)

| Branch                      | What it adds                                                                                                                                                                                                                                                                                                   | Ships (Cody's own "go" in this chat) |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `prism-forward`             | Docs only: HANDOFF, `docs/POLISH-REVIEW.md`, this file                                                                                                                                                                                                                                                         | with Bramblin (fast-forwarded)       |
| `bramblin-2026-10-13`       | **6 ledger entries:** #946 Bramblin (Normal/Lucky/100%/XXL/XXS, no Shiny), plus Oct 2 catch-ups: Shiny #944 Shroodle; Shadow + Purified #644 Zekrom, #767 Wimpod, #753 Fomantis, #769 Sandygast. Plus the **scanner pill fix** (`app/pokedex.css` was double-encoded, so the live pill shows "â— REGISTERED"). | **Tue Oct 13 after 10:00 a.m. CDT**  |
| `minior-2026-10-19`         | #774 Minior debut; polish (device light/dark, medal "N not in GO yet", drawn header icons, 44px phone targets, Kanto starts at Bulbasaur); landscape header safe-area fix                                                                                                                                      | Mon Oct 19 after 5:00 p.m. CDT       |
| `greavard-shiny-2026-11-01` | Shiny #971 Greavard (Shiny Houndstone stays off)                                                                                                                                                                                                                                                               | Sun Nov 1 after 10:00 a.m. CST       |
| `polish-after-2026-11-01`   | Polish review #7–#11 (stale-line link, Settings jumps, region tiles, scanner pill marks, slim catalog bundle)                                                                                                                                                                                                  | after Nov 1, with its own OK         |

Each branch's runbook: `docs/releases/2026-10-13-bramblin/`, `2026-10-19-minior/`, `2026-11-01-greavard-shiny/` (`RUNBOOK.md`). Polish details: `docs/POLISH-REVIEW.md` ("Done on October 11–12"). Before each ship date, the unit test "the release ledger file is valid" fails **by design** (future dates; the validator uses UTC days).

## Tuesday, step by step

1. Before 10 a.m.: do a read-only live check (`curl -s https://dex.cjdev.app/api/health`, `pnpm.cmd exec wrangler deployments status`, `pnpm.cmd exec wrangler d1 migrations list dexly-db --remote`). Update the status file. Wait.
2. When Cody types **go** after 10:00 a.m. CDT, follow the Bramblin RUNBOOK **steps 1–9** exactly. Use **Command Prompt (`cmd`)** or Bash for `pnpm.cmd`, not Windows PowerShell 5 (it misreports pnpm stderr as failure).
3. Step 2 in practice: `git checkout prism-forward && git merge --ff-only bramblin-2026-10-13`.
4. Step 3 gates: `pnpm.cmd run test` (all unit tests pass on Oct 13), lint, `validate:pokemon-data`, `catalog:verify`, then the **full Linux browser suite** (all five projects, including WebKit and `pwa-chromium`) in WSL from a `git archive` snapshot, as in [the L4 record](releases/2026-10-02-launch/RELEASE.md). The known WebKit tab-order flake may need one rerun; record it.
5. Rollback target for Bramblin is `b0c70140-8b84-46f8-9198-921d6106c1d6`.
6. Step 7 live checks: also verify the four phone items in the runbook's checklist, including that **a registered pill reads "● REGISTERED"**.
7. Step 9 (part of the go): record the results in the RUNBOOK and HANDOFF, commit on `prism-forward`, then `git checkout main && git merge --ff-only prism-forward && git push origin main prism-forward && git checkout prism-forward`. Then restack the later branches: `git checkout polish-after-2026-11-01 && git rebase --update-refs prism-forward` (moves Minior, Greavard and polish), and return to `prism-forward`.

## Pre-checks (every branch, every change)

```bash
pnpm.cmd exec vitest run --config vitest.config.ts
pnpm.cmd run test:worker
pnpm.cmd run lint
pnpm.cmd exec prettier --check <changed files>
pnpm.cmd exec tsc -b
pnpm.cmd run validate:pokemon-data
pnpm.cmd run catalog:verify
pnpm.cmd exec playwright test --project=mobile-chromium --project=desktop-chromium --project=pwa-chromium
```

**Always include `pwa-chromium`.** `test:e2e:chromium` leaves it out, and that hid a landscape safe-area regression on Oct 11. Latest results (Oct 12): Bramblin 144 passed, Minior 155, Greavard 155, polish 164, all with 0 failures. The Playwright web server uses port 4173 and builds to `dist/e2e-client` (not the deploy artifact).

## Conventions and don'ts

- Never commit `CODEX-PLAN.md`. Leave `evidence/` and `docs/shots/polish-2026-10-11/` untracked (screenshots are local by Cody's decision).
- Don't touch `.dev.vars`, `.wrangler/state`, `archive/` (ignored; it has the release scripts `fingerprint.mjs` and `live-checks.mjs`), or the prunable Codex worktree `codex/post-redesign-release-audit`.
- Shared PC: stop only processes you started, by recorded PID (check the command line first). Check ports are free first. For static previews, the outgoing chat used `python -m http.server 5293 --bind 127.0.0.1 --directory <dir>`, started with PowerShell `Start-Process -PassThru` to get the Windows PID.
- Edit files with Edit/Write or Python, not PowerShell (PS 5.1 mangles UTF-8; that is likely how `pokedex.css` got double-encoded). `tests/unit/app-encoding.test.ts` now guards this.
- Catalog entries need official sources only (pokemongo.com, niantic.helpshift.com, pokemon.com). Cody OKs each one. For freshness, sweep news from the ledger's newest date and re-check items the audit deferred as "future".
- Hand off at 50% context (soft) / 70% (firm) per WORKERS.md.

## Open items and owners

- **Cody:** the 15-minute phone + Discord check and posting the announcement ([LAUNCH-MORNING.md](releases/2026-10-02-launch/LAUNCH-MORNING.md)); each ship-day "go".
- **Cody's OK needed:** polish review #12–#15 (device transfer link, Dynamax tracking, costume tracking, uptime alert); the polish branch's own ship date after Nov 1.
- **Freshness:** live warns from Tue Oct 20, 7:00 p.m. CDT. Bramblin moves that to about Nov 3, Minior to Nov 9, Greavard to Nov 22. Not added on purpose: Dynamax Uxie/Mesprit/Azelf (Oct 24), Halloween costumes (Oct 27 / Nov 1).
- **Production build note:** `pnpm build` / `build:artifact` overwrite `dist/`. The polish branch adds a Vite plugin (`scripts/release/slim-catalog.ts`) to `vite.config.ts` that has never run in the real production build. It's exercised by `tsc` and the e2e build only, so watch its build step when that branch ships.
