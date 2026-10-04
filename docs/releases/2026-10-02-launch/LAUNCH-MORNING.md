# CatchGrid launch morning

Prepared overnight, October 4, 2026 (America/Chicago), by Claude. **Nothing has been deployed, pushed or merged, and no migrations have been run.** Production is still the September 28 release. Everything below is ready, so the launch needs only your "go".

## Short version

- **What ships:** application commit `4745a62` on `prism-forward`. That's the approved L4 candidate `3c6150f` plus one small overnight fix (below). The exact build is already on disk in `dist/` and fingerprinted, so don't rebuild it.
- **Verified tonight:** 262 unit and 40 Worker tests, lint, formatting, catalog validators and the strict dry run. A fresh, clean Linux browser run passed **263 with 0 failures** (2 existing skips). An interactive pass over the exact build (Chromium and WebKit, desktop and phone, dark and light) passed **43 of 43** with zero app console or CSP errors.
- **Live right now (read-only check, 03:50):** `c49945a`, Worker `0891c9e5-8a9c-4736-beae-2e796325dfef` at 100%. No pending D1 migrations. Wrangler is still logged in.
- **If anything goes wrong after deploy:** roll back to `0891c9e5-8a9c-4736-beae-2e796325dfef` with one command (step 7).

To launch, tell the PM chat or Claude **"go"**. It runs steps 1–6 and stops on anything unexpected. You can also run them yourself in **Command Prompt** (`cmd`). Avoid Windows PowerShell 5 for this: on September 28, PowerShell 5 misreported pnpm's normal stderr as a failure and triggered an unnecessary rollback.

## The overnight fix (why the SHA changed)

In Safari/WebKit, a **brand-new visitor** could see "A new version of CatchGrid is ready. Update now / Later" on their very first page load. WebKit briefly reports a first-install service worker as "waiting", and both bootstraps treated any waiting worker as an update. This was intermittent: 4 of 6 fresh WebKit visits against the old build showed it, and Chromium never did. It is also present in today's production. It would have been the first thing a Discord friend on an iPhone saw.

The fix is two lines (`public/pwa-bootstrap.js`, `public/app-bootstrap.js`): announce an update only when an older worker is still active. A new unit test fails without the fix. After the fix, 0 of 9 fresh visits showed the banner, and the "update only applies when the person accepts it" PWA test still passes. Nothing else changed. Storage, backups, catalog, migrations, dependencies and Cody's eight strings are untouched.

If you'd rather ship the exact build approved on October 1, it is preserved at `archive/release-work/2026-10-04-recheck/artifact-3c6150f/` (manifest `caea543b…`). It has the first-visit banner bug, so I don't recommend it.

## Launch steps (from `D:\Projects\Pokemon\CatchGrid`)

```bat
cd /d D:\Projects\Pokemon\CatchGrid
```

**1. Confirm source and the exact artifact.** Stop if anything differs.

```bat
git status --short
git log --oneline -3
node archive\release-work\2026-10-04-recheck\fingerprint.mjs
```

Expected: only `?? CODEX-PLAN.md` and `?? evidence/` are untracked. `4745a62` is the application commit, with this documentation commit above it. The fingerprint prints `{"count":2429,"manifestSha256":"7a6e4a0e320b31bc0a6f82eb50ff7aa3fd76047be363752373bcb3bc6beaa6f4"}`.

**2. Confirm live state and that no migration is pending.**

```bat
pnpm.cmd exec wrangler whoami
pnpm.cmd exec wrangler deployments status
pnpm.cmd exec wrangler d1 migrations list dexly-db --remote
```

Expected: your usual Cloudflare account, version `0891c9e5-8a9c-4736-beae-2e796325dfef` at 100%, and **"No migrations to apply!"**. **If any migration is listed, stop. Do not apply it.**

**3. Take a fresh D1 bookmark and write it down.**

```bat
pnpm.cmd run release:bookmark:production
```

For reference, the latest bookmarks: `000000d8-00000000-000050fa-1702ec503dbca315218fb177201acafc` (Oct 4, 03:53) and `000000d4-00000000-000050f8-ca1717eb7db35fedcb00586dceb93165` (Oct 1). This release has no migrations, so a D1 restore should never be needed. A Worker rollback doesn't touch D1.

**4. Dry-run the exact artifact one more time.** This doesn't rebuild it.

```bat
pnpm.cmd exec wrangler deploy --dry-run --strict
```

Expected: `Read 2433 files from the assets directory …\dist\client` and `--dry-run: exiting now.`

**5. Deploy.**

```bat
pnpm.cmd run release:deploy:production
```

Write down the new Worker version ID it prints.

**6. Smoke and live checks.**

```bat
pnpm.cmd run release:smoke:production
curl -s https://dex.cjdev.app/api/health
node archive\release-work\2026-10-04-recheck\live-checks.mjs https://dex.cjdev.app archive\release-work\2026-10-04-recheck\live-production
```

Expected: all smoke checks pass. `/api/health` shows `"gitSha":"4745a62fc55f72dfe40deb2cf262e4692ee1b393"` and the new version ID. The live check prints `43/43 passed`. It covers the first visit with no update banner, freshness, Cody's picks, report copy plus the Discord link, the skipped-cell import report, the backup reminder, the JSON round trip, phone drag-fill plus Undo, the social card and zero console/CSP errors, in Chromium and WebKit, at desktop and phone sizes, in both themes. It uses throwaway browser profiles only and writes nothing to the server.

**7. On any live failure: roll back.**

```bat
pnpm.cmd run release:rollback:production 0891c9e5-8a9c-4736-beae-2e796325dfef --yes
pnpm.cmd run release:smoke:production
curl -s https://dex.cjdev.app/api/health
```

Health should show `c49945a…` / `0891c9e5…` again. Don't restore D1 or touch browser profiles as part of a Worker rollback.

**8. After a good launch: record and push.** This is part of the go.

Update `RELEASE.md` and `HANDOFF.md` with the real version ID, bookmark and smoke results, then commit on `prism-forward` (never `CODEX-PLAN.md`), then:

```bat
git checkout main
git merge --ff-only prism-forward
git push origin main prism-forward
git checkout prism-forward
```

No force push is needed. Remote `main` (`5f291b6`) is an ancestor of `prism-forward`.

## Your phone checks (about 15 minutes, after step 6)

1. **Discord card first, privately.** Post `https://dex.cjdev.app` in a private channel or a DM to yourself. The preview should be the **slate CatchGrid card** ("Track every catch. Build the perfect search."), not the old green ball. Discord caches link previews. If you see the old green card, post `https://dex.cjdev.app/?v=2` instead, and use that link in the announcement.
2. **iPhone, Safari:** open the link. Expect **no** "new version" bar on the first visit. Open a region, tap to mark a few, go to Progress, drag down the check column to fill several, then tap **Undo**. Then Share › Add to Home Screen, open it from the new icon, and check that the "Add to Home Screen" hint is gone.
3. **Android, Chrome** (if you have one handy): open, mark a few, then Settings › **Download JSON backup**.
4. **Import the community sheet** on one device. In Google Sheets: File › Download › Microsoft Excel (.xlsx). Then Settings › Import collection › "Choose spreadsheet, backup or CSV". The review should show a short skipped list and **one** "Report a wrong entry" box. Valid not-in-GO-yet cells stay skipped. Tap Apply.
5. **Phone to PC:** on the phone, Settings › Download JSON backup. On the PC, Settings › Import that file › Apply. The Home counts should match.
6. **Report path:** open any Pokémon's details › **Report a wrong entry** › **Message Cody on Discord**. It should open your Discord profile in the app, and also in a browser.

When these look right, post the announcement.

## Announcement (DRAFT for you to edit; nothing has been posted)

> **CatchGrid is live: https://dex.cjdev.app** 🎉
>
> It's a free Pokémon GO collection tracker I built. Mark what you have across Normal, Shiny, Lucky, 100%, XXL, XXS, Shadow and Purified, see your progress and medals, and copy ready-made search strings straight into GO. No account and no login. It never touches your game account.
>
> **Your data stays in your browser.** Nothing is uploaded, so back it up now and then: Settings › **Download JSON backup**. Your phone and computer keep separate copies. To move it, download the JSON on one and import it on the other.
>
> **Already using the community Pokédex sheet?** In Google Sheets: File › Download › Microsoft Excel (.xlsx). Then in CatchGrid: Settings › Import collection › Choose spreadsheet. You'll see a review before anything is saved, and it only adds, never removes.
>
> **iPhone:** open it in Safari › Share › **Add to Home Screen**, then use the new icon. That keeps Safari from clearing your collection. If you already marked things in Safari first, download the JSON backup and import it inside the Home Screen app.
>
> **See something wrong?** Open the Pokémon › **Report a wrong entry** › copy the message and send it to me (there's a "Message Cody on Discord" button). If an import skips something that IS in GO, report that too.
>
> It's an unofficial fan project, so expect a few rough edges. Tell me what breaks!

(About 1,300 characters, within one Discord message. Remove the emoji if you prefer. It makes no sync promises, matching the plan.)

## Known and accepted for launch

- **Catalog freshness:** the catalog/ledger date is 2026-09-29. The site starts saying "Some recent releases may be missing" after 21 days, around October 20. Bramblin and Brambleghast debut in GO on **October 13** and are deliberately still unreleased in the catalog, so a catalog update is the first post-launch task.
- **Test flake, not an app bug:** one existing WebKit browser test (first-run Home tab order, then a click on the Johto card) fails about 1 time in 20, both before and after the fix. The trace shows the card still smooth-scrolling when the test clicks. A clean full rerun passed. Logs are in `recheck-1004-linux-flake-repeat.txt`.
- **Windows WebKit:** Playwright's WebKit on Windows fails 5 keyboard/tab-order tests, a known platform quirk. Linux is the release gate and passes.
- Bundle-size warning, the sharp/libheif dev-tool advisory, Cloudflare alerting and real-device VoiceOver review stay open, as in the release record.

## Evidence

- Interactive results: `archive/release-work/2026-10-04-recheck/live-4745a62/` (local; `live-checks.json` and 54 screenshots). Committed summary: [recheck-1004-interactive.json](recheck-1004-interactive.json).
- Linux browser logs: [clean full run](recheck-1004-linux-browser.txt), [first run with the one flake](recheck-1004-linux-browser-first.txt), [flake repeat comparison](recheck-1004-linux-flake-repeat.txt).
- Artifact manifest: `archive/release-work/2026-10-04-recheck/deploy-artifact-manifest-4745a62.json`. Build and dry-run logs are alongside it.
