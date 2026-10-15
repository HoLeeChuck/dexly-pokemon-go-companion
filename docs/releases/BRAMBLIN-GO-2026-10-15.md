# Bramblin go checklist, October 15, 2026

**Candidate:** `bramblin-2026-10-15`, in `D:\Temp\catchgrid-bramblin-2026-10-15`. Supersedes the October 13 candidate for deployment. No push/deploy has occurred during preparation.

## Two-minute checklist for Cody and the fresh Claude worker

1. Cody types **go** in the **PL · Pokémon** chat (the Pokémon lead, which now owns CatchGrid). The October 13 10:00 CDT release time has passed. Read [the prep report](../BRAMBLIN-PREP-REPORT-2026-10-15.md), [the sweep](OFFICIAL-NEWS-SWEEP-2026-10-15.md), and [release operations](OCTOBER-RELEASE-OPERATIONS.md).
2. Select the new branch, confirm the tracked tree and official sources, then follow operations steps 1-5. Full tests take longer than this checklist. Stop on unexplained source/account/migration changes. Use the worktree to preserve original leftovers and artifact.
3. Scope: the original six ledger records, **Shiny Grafaiai, Shadow/Purified Golisopod and Palossand**, and dated Shiny Gigantamax Cinderace provenance. Keep Brambleghast, Shiny Bramblin, Shadow/Purified Lurantis, Minior and Shiny Greavard unavailable. Preserve the REGISTERED pill fix.
4. After deployment, verify **Catalog updated 2026-10-13**; Bramblin Normal markable and Shiny unavailable; Shroodle/Grafaiai Shiny markable; Zekrom/Wimpod/Fomantis/Sandygast/Golisopod/Palossand Shadow and Purified markable; pill reads **● REGISTERED · NORMAL**. Run smoke, live browser checks and PWA acceptance before publication.
5. Rollback target, freshly reconfirmed before deploying: **`b0c70140-8b84-46f8-9198-921d6106c1d6`** if production is still the October 4 release. On failure run the explicit rollback in operations step 4, then smoke/health again. Never select a target by age alone.
6. Record results and perform the authorized fast-forwards/pushes only after successful checks. Minior still waits until October 19 after 17:00 CDT; Greavard until November 1 after 10:00 CST. Cody checks his actual phone and handles the announcement.

Official release sources: [Buddy Trek](https://pokemongo.com/news/fall-marathon-buddy-trek-2026), [Rocket Harvest](https://pokemongo.com/news/harvest-festival-tgr-2026), [Cinderace](https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026), and the evolution links in the sweep. Do not interpret today's review date as an obtainable date.

## Lead review, October 15, 2026 (PL · Pokémon)

- Re-checked: unit 295/295 and Worker 40/40, lint, types, format, data validators, catalog verify, artifact build and strict dry run all pass. Ledger diff: 10 records, none dated after October 13.
- This worktree's `node_modules` was damaged (missing Vite client files, so Vitest could not start). It was reinstalled from the frozen lockfile offline; the broken copy was moved to `D:\Temp\catchgrid-bramblin-node_modules.broken-2026-10-15` (safe to delete). `dist/` was not touched.
- Official Buddy Trek page re-read in a browser: Bramblin has no Shiny marker and Brambleghast is not mentioned. Leek Duck and Serebii report Brambleghast by evolution (50 Candy, 20 km buddy walk). Brambleghast stays unavailable in this release; Cody decides whether to add it with labelled community sources in the Minior release.
- This worktree, its evidence archive and the reviewed `dist/` live only in `D:\Temp`. Release before any temp cleanup.
