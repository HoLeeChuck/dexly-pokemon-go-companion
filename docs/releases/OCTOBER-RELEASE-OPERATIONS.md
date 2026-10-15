# October/November 2026 release operations

Read the dated GO checklist first. These instructions supersede the operational portions of the older three RUNBOOKs, while preserving their historical evidence. **Preparation is local only. No production action or push is authorized until Cody types the release's go in the fresh CatchGrid worker chat.** A PM relay does not count. The intended go covers that release, final gates, deploy, rollback on failure, recording results and publication of `main`/`prism-forward`, as in the original runbooks.

## 1. Identify the exact candidate

Use `D:\Temp\catchgrid-bramblin-2026-10-15`, not the original checkout, for preparation and builds. Read its `AGENTS.md`, `HANDOFF.md`, `docs/BRAMBLIN-PREP-REPORT-2026-10-15.md`, the dated checklist and `docs/DEPLOYMENT.md`. Check `git status --short --branch`, `git worktree list`, `git log -1 --oneline`, and the original checkout's status. Preserve unrelated files. Only this prep's report and screenshots may be expected untracked evidence; stop on new unexplained tracked changes.

Select the exact branch in the dated checklist. Do not take the later branch or `polish-after-2026-11-01` to ship an earlier release. Do not merge the obsolete `codex/post-redesign-release-audit` branch. It dates from August 30 and includes retired Events/Field Kit code.

Read the official sources again and check announced times in **America/Chicago**. The ledger validates UTC dates, which can turn green hours before the local debut. A passing date test is not permission to deploy early. If source changes expand the approved release, settle and validate that scope before publishing.

For a later release, first record the actually deployed predecessor SHA/version. Rebase only this branch's own commits onto that predecessor's current source branch, retaining the earlier backup refs. Preserve the downstream branch tips and restack in order when necessary. Stop if the intended predecessor is not live.

## 2. Repeat the local gates

Use Node 24.19.0 and the repository's pinned pnpm 11.21.0 through Corepack. The machine's bare `pnpm.cmd` currently resolves to 11.25.0, so use `corepack.cmd pnpm` in Command Prompt. Do not upgrade packages.

```bat
corepack.cmd pnpm --version
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm run validate:source
corepack.cmd pnpm run build:artifact
corepack.cmd pnpm exec wrangler deploy --dry-run --strict
git diff --check
```

No expected future-date failure is allowed on deploy day. `validate:source` includes binding types/check, lint, formatting, unit/Worker tests and both catalog validators. Keep generated evidence below ignored `archive/` or use focused formatting if untracked capture/report artifacts are present; never conceal a tracked formatting failure.

Run all five browser projects, including **PWA and both WebKit projects**, from a fresh tracked-source archive. This helper uses the existing Linux Node runtime and Playwright browsers, installing exact lockfile dependencies and reusing pnpm's cache where available. Override `CATCHGRID_NODE_BIN` if that runtime has moved; do not copy secrets or Windows `node_modules` into Linux.

```bat
git archive --format=tar -o archive/release-work/deploy-source.tar HEAD
wsl.exe -d Ubuntu -- bash /mnt/d/Temp/catchgrid-bramblin-2026-10-15/scripts/release/verify-linux-browser.sh /mnt/d/Temp/catchgrid-bramblin-2026-10-15/archive/release-work/deploy-source.tar 5398
```

The helper refuses an occupied port and retains evidence below the Linux user's `~/.cache/catchgrid-browser/run-*` (override with `CATCHGRID_BROWSER_WORKDIR`). This machine mounts `/tmp` in memory and clears it on WSL shutdown, so do not use `/tmp` for durable release evidence. Record any initial failure and rerun only when justified; never change assertions to get a pass. Browser tests build their own fixture frontend, so they do not overwrite the production `dist/client` artifact.

Preview the actual production artifact on a free loopback port and run the release-specific browser check:

Start `corepack.cmd pnpm exec vite preview --host 127.0.0.1 --port 5397 --strictPort --outDir dist/client` in a hidden helper with its PID recorded. Verify that port is free first. Do not substitute the browser suite's fixture server for this artifact preview.

```bat
set CATCHGRID_CAPTURE_ENGINES=chromium
node scripts/release/verify-october-catalog.mjs http://127.0.0.1:5397 bramblin archive/release-work/deploy-preview
```

Use `minior` or `greavard` for those releases. Linux WebKit is preferred for screenshot capture: Windows WebKit crashed during a full-page capture in this preparation. The full Linux test suite still exercises WebKit. Every preview server must have a recorded PID and a free port; stop only the server/processes you started. Do not reuse somebody else's server. Check both phone and desktop screenshots. Physical phone acceptance remains separate.

Record the candidate SHA and artifact hashes after the final build and dry run. Never rebuild between the reviewed dry run and deploy. This release changes the bundled public ledger; the private D1 catalog version remains `2026-08-24.1` and is not evidence that the public ledger failed to update.

## 3. Read live state, retain recovery information

After Cody's go and the local gates:

```bat
curl.exe -fsS https://dex.cjdev.app/api/health
corepack.cmd pnpm exec wrangler whoami
corepack.cmd pnpm exec wrangler deployments status
corepack.cmd pnpm exec wrangler d1 migrations list dexly-db --remote
```

Verify the account, Worker `dexly-companion`, production D1 UUID `154ac34c-cdfc-4a98-a0c4-f159153a6e2e`, and predecessor at 100% traffic. Record its **exact Worker version ID** as rollback target. For Bramblin, the October 15 read-only health check still reports `b0c70140-8b84-46f8-9198-921d6106c1d6` / `4745a62`; refresh rather than assume.

**There are no new migrations in these candidates.** If the remote list shows anything pending, stop and investigate; do not run `deploy:production`, `release:migrate:production`, or `catalog:sync` blindly. Preserve a fresh bookmark:

```bat
corepack.cmd pnpm run release:bookmark:production
```

## 4. Deploy that artifact, then prove the result

```bat
corepack.cmd pnpm run release:deploy:production
corepack.cmd pnpm run release:smoke:production
curl.exe -fsS https://dex.cjdev.app/api/health
node scripts/release/verify-october-catalog.mjs https://dex.cjdev.app bramblin archive/release-work/live-bramblin
```

Substitute the stage/output name for Minior and Greavard. Use fresh disposable browser contexts; never import into Cody's personal profile. Confirm the new SHA and Worker version, the exact checklist's catalog cells and freshness date, clean REGISTERED dot, theme/layout behavior, sources, and no app console/CSP errors. Check GET/HEAD health, readiness, catalog/version, manifest, robots, and unauthorized private API behavior via the smoke script. On a fresh live browser, also verify install/offline and explicit PWA update acceptance. A local fixture PWA test does not prove production caching.

Run the live browser helper from the retained Linux candidate too, with `CATCHGRID_CAPTURE_ENGINES=chromium,webkit`, the production URL and the same release stage. The Windows Chromium-only setting above does not count as live WebKit acceptance.

If any live check fails, roll back immediately to the **recorded explicit predecessor**:

```bat
corepack.cmd pnpm run release:rollback:production RECORDED_WORKER_VERSION_ID --yes
corepack.cmd pnpm run release:smoke:production
curl.exe -fsS https://dex.cjdev.app/api/health
```

Confirm the predecessor SHA/version after rollback. Worker rollback does not roll back D1 or browser-local profiles. No database restore, secret rotation, profile reset or data deletion is part of this release. See [Cloudflare rollback limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## 5. Record and publish only after successful live checks

Update the release record and HANDOFF with real times, candidate/deployed SHA, new Worker version, bookmark, rollback target and checks. Commit only named files. Preserve original `CODEX-PLAN.md`, brief, `evidence/`, Oct 11 screenshots, `.dev.vars`, `.wrangler/state` and original `dist/`.

The original checkout still owns `prism-forward`; do not force-check it out in another worktree. After verifying its tracked tree is clean, fast-forward it with `git -C D:\Projects\Pokemon\CatchGrid merge --ff-only RELEASE_BRANCH`. If this prep's untracked report copy would block the merge, first hash-check and preserve **only that named copy** in the prep worktree's archive, then move it out of the way. Do not stash/reset/clean the original checkout.

Then fast-forward `main` to the reviewed release source and push `main` and `prism-forward` using the original runbook's publication procedure, returning the original checkout to `prism-forward`. No force push. Restack remaining release branches onto the new recorded predecessor while retaining backup refs. The separate polish branch still requires its own post-November-1 approval; do not publish it with these releases. Report actual success or rollback plainly. Cody performs the physical-phone/Discord checks and posts any announcement himself.
