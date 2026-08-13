# Cloudflare deployment

This runbook releases CatchGrid from an exact reviewed Git revision. A checked-in
configuration or successful local build is not evidence that staging or production is live.
Record command output, Worker version IDs, catalog version, and the deployed Git SHA for
each release.

## Configured resources

Legacy infrastructure names are retained intentionally so a product rename does not replace
databases, Worker history, or user bookmarks.

| Environment | Worker                    | D1 database        | D1 UUID                                | Route                                                                                                                             |
| ----------- | ------------------------- | ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Production  | `dexly-companion`         | `dexly-db`         | `154ac34c-cdfc-4a98-a0c4-f159153a6e2e` | [dex.cjdev.app](https://dex.cjdev.app/) plus legacy [workers.dev fallback](https://dexly-companion.codyleejohnson26.workers.dev/) |
| Staging     | `dexly-companion-staging` | `dexly-db-staging` | `1f8ee380-b50d-4620-88ce-66fee539c10c` | environment-assigned `workers.dev` URL                                                                                            |

Both environments bind D1 as `DB`, but the UUIDs are deliberately different. Each must
have a different `APP_ACCESS_TOKEN` Worker secret; values never belong in Git, shell
arguments, screenshots, logs, or documentation. The public app does not need either token.

The release target in this working tree is catalog `2026-08-13.1`: National Dex #1-1025,
949 released standard species, 177 reviewed collector forms, and 1,202 form rows total.
Unreleased standard placeholders remain in denominators. Do not infer that this target has
been deployed until live version/smoke checks say so.

## Local release gate

Use the versions pinned in `package.json` and the committed lockfile:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium webkit
pnpm db:migrate:local
pnpm release:preflight
```

`release:preflight` runs, in order:

1. `pnpm check` - ESLint, Prettier, unit tests, Worker/D1 tests, binding generation,
   TypeScript, and the production build;
2. `pnpm catalog:verify` - dated catalog/provenance/form verification plus the immutable
   migration refusal regression;
3. `pnpm test:e2e` - mobile/desktop Chromium and WebKit, resilience, and axe flows; and
4. `wrangler deploy --dry-run --strict` - non-mutating package validation.

The compatibility date remains `2026-08-11`, the newest date accepted by the checked-in
workerd test runtime. Advance Wrangler, the Cloudflare Vitest pool, and the compatibility
date together only after the complete Worker suite passes.

Do not run `catalog:sync` during routine deployment. A catalog update is a reviewed source
change that increments the catalog version and migration filename. Existing migrations are
immutable.

## Staging release

The staging D1 resource has been provisioned and is configured with its real UUID. It remains
an open release gate until the reviewed revision is migrated, deployed, and smoke-tested.
Never substitute the production UUID.

1. Confirm account, branch, exact revision, and pending staging migrations:

   ```powershell
   git status --short
   git log -1 --oneline
   pnpm exec wrangler whoami
   pnpm exec wrangler d1 migrations list dexly-db-staging --remote --env staging
   ```

2. If not already configured for this environment, set a staging-only secret interactively:

   ```powershell
   pnpm exec wrangler secret put APP_ACCESS_TOKEN --env staging
   ```

   Do not reuse production's value. Retest both authorized and unauthorized behavior after
   every rotation.

3. Apply the reviewed migrations to staging:

   ```powershell
   pnpm exec wrangler d1 migrations apply dexly-db-staging --remote --env staging
   ```

4. Select the staging environment at **build time**, then deploy the flattened output:

   ```powershell
   $env:CLOUDFLARE_ENV = 'staging'
   pnpm build
   pnpm exec wrangler deploy --strict --message CatchGrid-staging-release
   Remove-Item Env:CLOUDFLARE_ENV
   ```

   With the Cloudflare Vite plugin, building the default environment and appending
   `--env staging` only to the final deploy is not equivalent.

5. Against the returned staging URL, verify `GET` and `HEAD` for `/api/health`,
   `/api/ready`, `/api/v1/catalog/version`, and `/api/v1/catalog`; confirm the catalog is
   profile-free, version `2026-08-13.1`, and reports the reviewed Git SHA. Also test install,
   offline/update behavior, an authorized harmless change/undo, and unauthorized private
   API rejection.

No staging smoke result is recorded merely by this document. Preserve the actual URL,
timestamps, response headers, version IDs, and command output in release evidence.

## Production release

Proceed only after local and staging gates are green and the reviewed source is the intended
protected `main` revision.

1. Confirm source and Cloudflare account:

   ```powershell
   git status --short
   git log -1 --oneline
   pnpm exec wrangler whoami
   pnpm exec wrangler d1 migrations list dexly-db --remote
   ```

   Stop on an unexpected account, Worker, D1 name, UUID, migration, or dirty tree.

2. Re-run the complete non-mutating gate:

   ```powershell
   pnpm release:preflight
   ```

3. Capture and retain the production D1 Time Travel bookmark:

   ```powershell
   pnpm release:bookmark:production
   ```

   The script runs `wrangler d1 time-travel info dexly-db --json`. Do not migrate without
   preserving a current bookmark in the release record.

4. Apply the additive migrations and deploy as separate reviewed actions:

   ```powershell
   pnpm release:migrate:production
   pnpm release:deploy:production
   ```

   Migration `0008_phase_b_catalog_schema.sql` adds Phase B catalog metadata;
   `0009_phase_b_catalog_data.sql` publishes the `2026-08-13.1` snapshot by additive
   upsert. Applied migrations must never be edited or renumbered. Schema changes must remain
   compatible with the previous Worker in case deployment fails after migration.

5. Run the scripted public smoke gate:

   ```powershell
   pnpm release:smoke:production
   ```

   It probes GET/HEAD liveness, readiness, catalog/version, manifest, and robots, then
   rejects missing/placeholder Git metadata. Also verify canonical/OG/PWA output, CSP, HSTS,
   cache headers, no browser-console CSP errors, controlled update/offline behavior,
   authorized owner change/undo, and unauthorized private-API denial.

`pnpm deploy:production` runs preflight, bookmark, migration, deployment, and smoke in that
order. The named steps above are preferred when producing auditable release evidence. This
runbook does not claim that production smoke has been run for the current revision.

## Probes and caching

- `GET/HEAD /api/health` is liveness and deliberately avoids D1.
- `GET/HEAD /api/ready` is uncached D1/catalog readiness.
- `GET/HEAD /api/v1/catalog/version` is the small release/catalog check.
- `GET/HEAD /api/v1/catalog` is profile-free and edge-cacheable.
- Private API responses are `no-store`; the service worker must never cache them.
- `/assets/*` is immutable, while HTML, bootstrap, manifest, and service-worker files
  revalidate.

Measure live cache hit ratio, transfer compression, D1 rows read, and public/private
response headers after deployment. Source tests establish behavior, not live performance.

## Secrets and owner access

Production rotation:

```powershell
pnpm exec wrangler secret put APP_ACCESS_TOKEN
```

Staging rotation:

```powershell
pnpm exec wrangler secret put APP_ACCESS_TOKEN --env staging
```

Enter values only at Wrangler's interactive prompt and store them in the approved password
manager. If a token is missing outside loopback, the private API fails closed with
`503 PRIVATE_API_NOT_CONFIGURED`. The unlisted `/cody` route is one owner's compatibility
surface, not multi-user authentication. Cloudflare Access for that route/private APIs is a
future account-level hardening option and must be tested on staging before production.

## Rollback and D1 recovery

List deployments and versions before changing traffic:

```powershell
pnpm exec wrangler deployments list
pnpm exec wrangler versions list
```

If the migrated schema remains backward-compatible, roll back to an explicitly reviewed
Worker version:

```powershell
pnpm exec wrangler rollback <VERSION_ID> --message "Rollback <incident-reference>"
```

`pnpm release:rollback:production` selects the preceding Worker version and is safe only
when that exact version is known. Worker rollback does not undo D1. D1 Time Travel restore
overwrites database state and cancels in-flight queries; use the retained bookmark only as
a deliberate incident action after impact review. A rollback rehearsal/bookmark record is
still required before this launch gate is closed.

Browser-local profiles are independent of D1 rollback. Recovery snapshots and full-profile
exports are the user portability boundary; the legacy hostname notice exists because local
storage cannot cross origins automatically.

Authoritative references:

- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare Vite environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## GitHub checks and protection

`.github/workflows/ci.yml` exposes exactly these required checks:

- `quality`
- `browser-mobile-chromium`
- `browser-desktop-chromium`
- `browser-mobile-webkit`
- `browser-desktop-webkit`

Protect `main` after these checks exist on the repository: require a pull request, all five
checks, current branches, stale-approval dismissal, no force push/deletion, and a narrowly
controlled emergency bypass. The workflow has `contents: read` and no Cloudflare credential;
deployment remains an explicit operator action. Branch protection and synchronization of
the reviewed release SHA to public `main` require external GitHub evidence and are not
complete because this runbook describes them.

If deployment is automated later, use separate protected GitHub Environments and narrowly
scoped Cloudflare API tokens for staging and production. Never give an unreviewed preview a
production D1 binding.

## Monitoring and unresolved launch evidence

Structured logs, Worker version metadata, full logs, and sampled traces are configured.
Cloudflare account notifications/dashboards for Worker 5xx/latency, D1 errors and rows read,
catalog cache behavior, and private-route 429s are **not yet evidenced**. Alert ownership and
an incident drill remain open.

The CSP permits Cloudflare Web Analytics and the privacy notice covers aggregate analytics,
but enablement and live delivery are **not verified**. Adding another vendor requires a new
CSP/privacy review.

Before broad public launch, the release record must still include:

- accepted permission/legal risk or replacement assets for the pinned sprites;
- real-device VoiceOver, keyboard, 200% zoom, contrast, reduced-motion, and all-theme review;
- trustworthy production LCP, INP, and CLS evidence (not inferred from bundle size);
- Cloudflare alerts/measurements and a rollback rehearsal;
- verified legacy-origin export messaging before any fallback retirement; and
- protected-`main`, staging, production smoke, headers, CSP, and exact-SHA evidence.
