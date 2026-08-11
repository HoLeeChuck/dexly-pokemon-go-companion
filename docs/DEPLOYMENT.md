# Cloudflare deployment

## Current deployment status

The repository is not ready for an unattended production deploy. `wrangler.jsonc`
contains the placeholder D1 ID `00000000-0000-0000-0000-000000000001`; remote migration
or deployment must not be attempted until it is replaced with the database UUID from
the intended Cloudflare account.

The owner still needs to choose or confirm:

- the Cloudflare account and who is allowed to deploy;
- the Git provider, repository owner/name, visibility, and production branch;
- whether to keep the names `dexly-companion` and `dexly-db`;
- a long random private `APP_ACCESS_TOKEN` and its rotation owner;
- the default `workers.dev` hostname or a custom domain; and
- whether preview/staging deployments are needed and who pays for their resources.

No repository, Cloudflare account, DNS, or domain choice should be inferred from the
local project.

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
availability check is desired. The committed `pnpm-lock.yaml` lets CI use
`pnpm install --frozen-lockfile`.

## First production deployment

These actions mutate the selected Cloudflare account. Review the account shown by
Wrangler before continuing.

1. Authenticate and confirm the target account:

   ```powershell
   pnpm exec wrangler login
   pnpm exec wrangler whoami
   ```

2. Create the production database once:

   ```powershell
   pnpm exec wrangler d1 create dexly-db
   ```

   Copy the returned database UUID into the production `d1_databases[0].database_id`
   entry in `wrangler.jsonc`. Keep the binding name `DB` unless application code and
   generated types are changed together. Commit the reviewed configuration change.

3. Configure the private access key as a Cloudflare secret, never as a plaintext
   `vars` value:

   ```powershell
   pnpm exec wrangler secret put APP_ACCESS_TOKEN
   ```

   Enter the value only at Wrangler's prompt. If Wrangler requires an initial Worker
   record first, the private API safely returns `PRIVATE_API_NOT_CONFIGURED` until the
   secret is added; do not share the URL as ready during that interval.

4. Re-run the local preflight after the real binding is committed.

5. Perform the production action explicitly:

   ```powershell
   pnpm deploy:production
   ```

   This existing script runs a fresh build, applies all pending migrations to remote
   `dexly-db`, and only then runs `wrangler deploy`. It is intentionally not part of
   `pnpm check`. To migrate without deploying, use `pnpm db:migrate:production` and
   review the target printed by Wrangler.

6. Verify the deployed hostname:

   ```powershell
   Invoke-RestMethod https://YOUR-HOST/api/health
   ```

   Then open the UI, enter the application access key, confirm that bootstrap succeeds,
   make and undo a harmless collection change, and verify that a request without the
   key cannot read `/api/v1/bootstrap`.

The health route is public and cacheable; collection endpoints are private and
`no-store`. A healthy response proves Worker-to-D1 connectivity, not authorization or
catalog completeness.

## Migrations and recovery

- Local and remote migration commands are separate by design. Never add `--remote` to
  normal development startup.
- Review every SQL migration and back up important data before destructive schema
  changes. Prefer backward-compatible expand/migrate/contract releases.
- Cloudflare D1 records migration state and remote migration application creates a
  backup/restore point as documented by Cloudflare. A failed migration is rolled back,
  but that is not a substitute for testing or an application-level recovery plan.
- Application CSV imports create a backup snapshot, but this vertical slice does not
  expose a restore button or endpoint. This does not replace a D1 database backup.
- If deployment fails after a successful migration, assess schema compatibility before
  rolling the Worker back. Do not blindly reverse data migrations.

Use [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and
[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) as the
authoritative recovery references for the selected Cloudflare plan.

## Git-connected Workers Builds

After the repository and account choices are made, Cloudflare Workers Builds can deploy
from GitHub or GitLab. A safe initial production configuration is:

| Setting           | Recommended value                                         |
| ----------------- | --------------------------------------------------------- |
| Production branch | The owner-approved protected branch (commonly `main`).    |
| Build command     | `pnpm check`                                              |
| Deploy command    | `pnpm db:migrate:production && pnpm exec wrangler deploy` |
| Root directory    | Repository root                                           |
| Runtime           | Node.js 22.13+ with pnpm 11.21                            |

The build command already creates the production bundle. The deploy command keeps the
remote migration explicit and ordered before the Worker rollout. Protect the production
branch, require the checks, and limit Cloudflare deploy access.

Do not enable automatic preview-branch deployments with the current configuration.
Wrangler environment bindings are non-inheritable, and an unreviewed preview could
otherwise point at production D1 or fail unpredictably.

See [Workers Builds Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/),
[build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
and [build branch controls](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).

## Safe staging design

Staging requires separate resources, not only a different hostname:

1. Create a second D1 database such as `dexly-db-staging`.
2. Add a Wrangler `staging` environment with a distinct Worker name and the real
   staging D1 UUID. Repeat the entire D1 binding object because environment bindings do
   not inherit.
3. Set a different `APP_ACCESS_TOKEN` secret for staging.
4. Apply migrations to the staging binding and run smoke tests there before production.
5. Configure branch previews to use staging only after the binding has been reviewed.

With the Cloudflare Vite plugin, select the environment at **build time**, for example:

```powershell
$env:CLOUDFLARE_ENV = 'staging'
pnpm build
pnpm exec wrangler deploy
Remove-Item Env:CLOUDFLARE_ENV
```

The plugin emits a flattened deploy configuration. Building the default environment
and adding `wrangler deploy --env staging` afterward is not equivalent and must not be
used as a shortcut. The staging migration command should also select the reviewed
staging environment/binding explicitly once that configuration exists.

Official references:

- [Vite plugin Cloudflare environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
- [D1 environments](https://developers.cloudflare.com/d1/configuration/environments/)
- [Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Workers secrets with the Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/)
- [GitHub Actions alternative](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
