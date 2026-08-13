# Cloudflare deployment

## Current production

CatchGrid is deployed. These values are intentional and are not placeholders:

| Resource           | Current production value                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Public source      | [HoLeeChuck/dexly-pokemon-go-companion](https://github.com/HoLeeChuck/dexly-pokemon-go-companion)     |
| Primary domain     | [dex.cjdev.app](https://dex.cjdev.app/)                                                               |
| Worker fallback    | [dexly-companion.codyleejohnson26.workers.dev](https://dexly-companion.codyleejohnson26.workers.dev/) |
| Worker name        | `dexly-companion`                                                                                     |
| D1 binding         | `DB`                                                                                                  |
| D1 database        | `dexly-db`                                                                                            |
| D1 database UUID   | `154ac34c-cdfc-4a98-a0c4-f159153a6e2e`                                                                |
| Catalog snapshot   | `2026-08-11.2`: 949 released species represented by standard forms                                    |
| Private API access | Configured Worker secret `APP_ACCESS_TOKEN`; its value is never stored in Git                         |

The static application and `/api/health` are public. Collection bootstrap requests and
private mutations require an `Authorization: Bearer <APP_ACCESS_TOKEN>` header outside
localhost.
This protects one shared private profile; it is not multi-user authentication.

## Local preflight

Use the toolchain pinned by `package.json`, then verify the exact revision to deploy:

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm db:migrate:local
pnpm check
pnpm test:e2e
node scripts/verify-sprites.mjs
```

`pnpm check` is non-deploying: it lints, checks formatting, runs both Vitest suites,
generates Wrangler types, type-checks, and builds. Playwright remains an explicit
browser gate. The offline sprite check is deterministic. Run
`node scripts/verify-sprites.mjs --network` only when an external PokeMiners
availability check is desired. The committed lockfile lets CI use
`pnpm install --frozen-lockfile`.

Refreshing `catalog/catalog.v1.json` or `catalog/evolution-families.v1.json` is not a
routine preflight step. Those commands retrieve upstream data and create reviewable
source changes; run them only for an intentional catalog update.

## Production update runbook

These actions mutate the live Cloudflare account and D1 database. Review the exact Git
revision, SQL migrations, and Wrangler account before continuing.

1. Confirm the working tree and revision intended for release:

   ```powershell
   git status --short
   git log -1 --oneline
   ```

2. Authenticate and confirm the target account, database, and pending migrations:

   ```powershell
   pnpm exec wrangler login
   pnpm exec wrangler whoami
   pnpm exec wrangler d1 migrations list dexly-db --remote
   ```

   Stop if Wrangler reports an unexpected account, Worker, binding, database name, or
   UUID. Do not compensate by creating another database during a normal update.

3. Run the complete local preflight and review generated artifacts or migration diffs.

4. Perform the production action explicitly:

   ```powershell
   pnpm deploy:production
   ```

   This script runs a fresh build, applies pending migrations to remote `dexly-db`, and
   only then deploys the Worker. It is intentionally not part of `pnpm check`. To migrate
   without deploying, use `pnpm db:migrate:production` only after checking compatibility
   between the existing Worker and the new schema.

5. Verify the deployed service:

   ```powershell
   Invoke-RestMethod https://dex.cjdev.app/api/health
   ```

   Then open the UI, enter the application access key, confirm bootstrap succeeds, make
   and undo a harmless collection change, and verify a request without the key cannot
   read `/api/v1/bootstrap`.

The health route is public and cacheable. A healthy response proves Worker-to-D1
connectivity, not authorization, private-state integrity, or catalog completeness.

## Existing resources and secret rotation

Do not run `wrangler d1 create dexly-db` during a normal update. The configured database
already exists; creating another one produces a different UUID and does not move
production data. Change the binding only as part of an explicit migration or disaster
recovery plan.

The `APP_ACCESS_TOKEN` is configured. Rotate it only intentionally:

```powershell
pnpm exec wrangler secret put APP_ACCESS_TOKEN
```

Enter the new value only at Wrangler's interactive prompt, save it in the approved
password manager, and retest authenticated and unauthenticated access. Never put the
token in `wrangler.jsonc`, a `vars` block, command history, documentation, screenshots,
or Git. If it is absent on a non-loopback host, the private API fails closed with
`503 PRIVATE_API_NOT_CONFIGURED`.

If production ever has to be rebuilt in a new Cloudflare account, create a new D1
database only as part of that reviewed recovery procedure, restore or migrate the data,
update the UUID, apply all migrations, configure a new secret, deploy, and complete the
same authentication smoke tests before directing users to it.

## Migrations and recovery

- Local and remote migration commands are separate by design. Never add `--remote` to
  normal development startup.
- Review every SQL migration and back up important data before destructive schema
  changes. Prefer backward-compatible expand/migrate/contract releases.
- Migration `0004_trade_requests.sql` is additive. It creates the trade-specific wanted
  table, copies only Normal, Shiny, XXL, and XXS legacy goals, and skips an already-owned
  size goal. It does not create costume catalog forms; generic Costume remains a
  candidate request trait.
- Once a migration has been applied remotely, do not edit or renumber it. Add a later
  migration for corrections.
- Cloudflare D1 records migration state and remote migration application creates a
  backup/restore point as documented by Cloudflare. A failed migration is rolled back,
  but that is not a substitute for testing or an application recovery plan.
- Application CSV imports create a backup snapshot, but CatchGrid does not expose a restore
  button or endpoint. This does not replace a D1 database backup.
- If deployment fails after a successful migration, assess schema compatibility before
  rolling the Worker back. Do not blindly reverse data migrations.

Use [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and
[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) as the
authoritative recovery references for the selected Cloudflare plan.

## Trade-data migration behavior

Production migration `0004_trade_requests.sql` moves active trade goals away from the
general collection-category vocabulary:

- allowed requests: Normal, Shiny, XXL, XXS, and generic Costume;
- allowed explicit offer traits: Shiny, XXL, XXS, and Costume;
- Normal offers use an empty trait list;
- Hundo, Lucky, Shadow, and Purified are rejected for trade matching; and
- collecting an active XXL or XXS goal clears that wanted row in the same D1 batch.

Worker integration tests apply all migrations to isolated D1 storage and cover these
allowlists, invalid input, costume mapping, already-owned size rejection, transactional
size-goal completion, and bootstrap serialization before production deployment.

## Git-connected Workers Builds

The canonical source is already on GitHub, but this document does not assume Cloudflare
Workers Builds is enabled. If Git-connected deployment is enabled later, a safe initial
production configuration is:

| Setting           | Recommended value                                         |
| ----------------- | --------------------------------------------------------- |
| Production branch | Protected `main` after required checks pass.              |
| Build command     | `pnpm check`                                              |
| Deploy command    | `pnpm db:migrate:production && pnpm exec wrangler deploy` |
| Root directory    | Repository root                                           |
| Runtime           | Node.js 22.13+ with pnpm 11.21                            |

The build command creates the production bundle. The deploy command keeps the remote
migration explicit and ordered before the Worker rollout. Protect `main`, require the
checks, and limit Cloudflare deploy access.

Do not enable automatic preview-branch deployments with the production configuration.
Wrangler environment bindings are non-inheritable, and an unreviewed preview could
otherwise point at production D1 or fail unpredictably.

See [Workers Builds Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/),
[build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
and [build branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

## Safe staging design

Staging requires separate resources, not only a different hostname:

1. Create a second D1 database such as `dexly-db-staging`.
2. Add a Wrangler `staging` environment with a distinct Worker name and the real
   staging D1 UUID. Repeat the complete D1 binding because environment bindings do not
   inherit.
3. Set a different `APP_ACCESS_TOKEN` secret for staging.
4. Apply migrations to the staging binding and run smoke tests there before production.
5. Configure branch previews to use staging only after the binding is reviewed.

With the Cloudflare Vite plugin, select the environment at build time:

```powershell
$env:CLOUDFLARE_ENV = 'staging'
pnpm build
pnpm exec wrangler deploy
Remove-Item Env:CLOUDFLARE_ENV
```

The plugin emits a flattened deployment configuration. Building the default environment
and adding `wrangler deploy --env staging` afterward is not equivalent. The staging
migration command must also select the reviewed staging binding explicitly.

Official references:

- [Vite plugin Cloudflare environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
- [D1 environments](https://developers.cloudflare.com/d1/configuration/environments/)
- [Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Workers secrets with the Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/)
- [GitHub Actions alternative](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
