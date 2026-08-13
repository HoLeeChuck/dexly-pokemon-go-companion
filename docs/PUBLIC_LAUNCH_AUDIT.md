# CatchGrid public launch audit

**Audit date:** August 13, 2026

**Audited source:** `711c299` on `agent/configure-production-d1`

**Live site:** <https://dex.cjdev.app>

**Catalog:** `2026-08-12.1`
**Recommendation:** **Hold the broad public launch.** A small, clearly labeled standard-form beta is possible after the P0 items below are resolved.

## Executive summary

CatchGrid has a sound technical foundation. The production build succeeds, unit and Worker/D1 tests pass, the live database has every committed migration, the current manifest agrees with the live API, all 1,810 sprite URLs work, and npm reports no known dependency vulnerabilities.

It is not yet ready to be presented as a complete Pokémon GO collection companion. The current model contains 949 released, standard National-Dex representatives only. It omits regional forms, Unown letters, Mega Evolutions, Gigantamax forms, costumes, and other alternate forms, while the Home page says its totals are the complete regional Dex including unreleased Pokémon. Browser-local data is also isolated by hostname, so a person who used the old Workers URL will appear to have an empty collection on `dex.cjdev.app`.

The main risks are product/data correctness, local-data continuity, asset rights, deployment reproducibility, and public-read scaling. These should be closed before a community-wide announcement.

## Verification completed

| Check                                     | Result                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lint and formatting                       | Pass                                                                                                                      |
| Unit tests                                | 87/87 pass                                                                                                                |
| Worker/D1 tests                           | 33/33 pass                                                                                                                |
| TypeScript and production build           | Pass                                                                                                                      |
| Production client bundle                  | 265.37 KB JS / 85.02 KB gzip; 83.94 KB CSS / 17.06 KB gzip                                                                |
| Dependency advisory scan                  | No known vulnerabilities, production and full lockfile                                                                    |
| Catalog schema/offline verification       | Pass: 949 species, 949 forms, 1,810 sprite references                                                                     |
| Commit-pinned sprite network verification | 1,810/1,810 successful                                                                                                    |
| Live catalog vs checked-in manifest       | Exact match                                                                                                               |
| Current PoGoAPI comparison                | No feed omissions; 12 reviewed 2026 releases supplement the feed; Shiny Solgaleo is the only intentional shiny difference |
| D1 migration state                        | No pending production migrations                                                                                          |
| Live API GET                              | `/api/health` and `/api/v1/catalog` return 200                                                                            |
| Chromium end-to-end suite                 | 20 pass; 1 brittle color assertion fails; 1 real mobile Search Lab alignment assertion fails                              |
| iOS/WebKit end-to-end suite               | Not implemented                                                                                                           |
| Core Web Vitals                           | Not measured; no launch baseline yet                                                                                      |

## P0 — resolve before public launch

### 1. Define and represent the actual Pokédex scope

The catalog has exactly one `standard` form for each of 949 released species. It does not contain the form-level collection the product roadmap and recent UI discussions require:

- regional forms such as Alolan Ninetales;
- all 28 Unown forms;
- Mega and Primal forms, including the 2026 Mega Mewtwo X/Y debuts;
- Gigantamax forms, including Gigantamax Rillaboom, released August 1, 2026;
- costumes, gender differences, Rotom-style forms, fused forms, and other alternate forms.

`src/components/HomeDashboard.tsx:58` says totals include each region's complete Dex and unreleased Pokémon, but the denominator at `HomeDashboard.tsx:62-74` is the released-only catalog. Consequently, a new profile displays 949 “Complete Dex,” 949 available, and zero unavailable. That is a materially false product claim.

**Required decision:** either build the full form-aware catalog before launch or explicitly launch as a **standard-form beta** and revise every completeness, unavailable, medal, and progress claim. A form-aware schema should keep species progress separate from form collections so an Unown or costume collection does not distort the National Dex total.

### 2. Protect collections during the hostname transition

The public collection is stored in `localStorage` under `dexly:local-profile:v1` (`src/lib/localProfile.ts:3`). Browser storage is origin-specific. Data saved at `https://dexly-companion.codyleejohnson26.workers.dev` is invisible at `https://dex.cjdev.app`.

`workers_dev` is still enabled, so both origins remain usable and can silently diverge.

**Required:** choose `https://dex.cjdev.app` as canonical, show an export/migration notice on the legacy origin, document the move, and only then redirect or disable the Workers hostname. Do not silently redirect existing users before they export, because the new origin cannot read the old origin's storage.

### 3. Make the public repository and production source agree

The GitHub repository is public and its default branch is `main`, but `main` and `origin/main` are still at the original MVP commit `4d5f39e`. Production and the current working branch are at `711c299`. There is no `.github/workflows` CI configuration.

This means the public source does not represent the live product, and no automated gate prevents an untested release.

**Required:** merge the release branch into `main`, add a required CI workflow for `pnpm check`, catalog verification, and Playwright, protect `main`, and deploy only an identified commit. Production deployments currently have no tag or message and `/api/health` exposes no Git SHA, so the live release cannot be independently tied to source.

### 4. Stop catalog synchronization from rewriting migration history

`scripts/sync-catalog.mjs:275` always writes `migrations/0003_full_released_pokedex.sql`. Migration 0003 has already been applied in production. A future catalog sync would rewrite an applied migration instead of creating a new immutable migration, causing local/production drift and making recovery unreliable.

**Required:** make catalog sync generate a new numbered migration or a reviewed data artifact. Never modify an already-applied migration. Add a test that fails when a catalog sync targets an existing migration number.

### 5. Resolve sprite licensing before broad distribution

CatchGrid hotlinks commit-pinned images from PokeMiners. PokeMiners states that its repository is for educational use only and that the content belongs to The Pokémon Company and Niantic. The repository does not provide an open redistribution license. Attribution and an unofficial-fan-project disclaimer do not grant usage rights.

**Required:** obtain appropriate permission/legal guidance or replace the imagery with assets whose use is clearly permitted. Until then, treat this as a launch risk, not as solved attribution.

Source: <https://github.com/PokeMiners/pogo_assets#disclaimer>

### 6. Remove the public catalog read bottleneck

Every public `/api/v1/catalog` request calls the full private bootstrap repository (`worker/index.ts:87-96`). `getBootstrap` performs seven D1 queries and reads the catalog, approximately 7,592 category-rule rows, categories, and even profile collection/trade tables that are discarded afterward (`worker/repository.ts:102-111`). The live response is 675,594 bytes and does not show a Cloudflare edge-cache hit; its five-minute `Cache-Control` only helps repeat requests from the same browser.

On Workers Free, D1 includes 5 million rows read per day. At roughly 8,500 returned rows per cold bootstrap, only about 585 cold catalog loads can consume that allowance, before accounting for scanned rows or other traffic. On Workers Paid this is less likely to fail immediately, but it is still unnecessary load and latency.

**Required:** publish the versioned catalog as a static generated JSON asset or place a dedicated catalog response in Cloudflare Cache API/KV. Use a catalog-only repository query as the fallback. Confirm the Cloudflare plan and add usage alerts before launch.

Cloudflare source: <https://developers.cloudflare.com/d1/platform/pricing/>

## P1 — complete during launch hardening

### Data correctness and recovery

1. **Local CSV imports bypass rule validation.** Cloud imports add `withRuleIssues`, but the browser-local path at `src/App.tsx:748` calls `previewCanonicalWideCsv` directly. It can import collected states that are unreleased or ineligible. Use the same shared rule validator in both modes and add parity tests.
2. **Corrupt browser data silently becomes an empty profile.** `loadLocalProfile` catches any parse error and returns a blank collection (`src/lib/localProfile.ts:23-38`). Preserve the bad payload, show a recovery message, validate every entry, and offer download/reset rather than silently appearing to lose data.
3. **Storage writes can fail without a durable recovery path.** `saveLocalProfile` directly calls `localStorage.setItem` (`localProfile.ts:41-42`). Handle quota/security exceptions, avoid mutating in-memory state before persistence succeeds, and show a durable error.
4. **Local imports have no automatic pre-import backup.** Create a downloadable or local rollback snapshot before applying a reviewed import. Test restore, not only export.
5. **Catalog provenance is incomplete.** The manifest stores hashes for released and rarity feeds, but not shiny, shadow, types, evolution, or asset-tree metadata. Store every input hash and a reviewed-delta file so the snapshot is reproducible.
6. **Near-term release calendar:** Nickit's shiny debut is scheduled for Sunday, August 16, 2026, from 2:00–5:00 p.m. local time. It is correctly false on August 13. Prepare a dated, reviewed update without making it true early. Official source: <https://pokemongo.com/en/news/communityday-august-2026-nickit>

### Security and privacy

1. **The CSP blocks CatchGrid's own theme bootstrap.** `index.html:11-21` contains an inline script, while `public/_headers:2` allows only `script-src 'self'`. The live browser reports the script blocked. Move it to an external file or use a reviewed hash; do not add broad `unsafe-inline`.
2. **Cloudflare's injected analytics beacon is also blocked.** Either deliberately allow the exact Cloudflare script and beacon endpoints or disable the injection. Do not leave broken telemetry and recurring console errors.
3. **The owner token endpoint has no rate limiting.** `/cody` being unlisted is not an authentication control. Keep the token high entropy, rate-limit failed authentication and private mutation routes, and consider Cloudflare Access for the owner page.
4. **There is no public privacy notice.** Explain that collections and appearance preferences are stored in the browser, that data does not automatically sync, how exports/deletion work, and what request/analytics data Cloudflare processes.
5. **HSTS is absent from the live response.** Add it only after confirming every relevant hostname is permanently HTTPS.
6. **Repository policies are missing.** Add `SECURITY.md`, a vulnerability contact, and a deliberate source-code license or an explicit all-rights-reserved statement. Keep third-party asset rights separate.

Positive findings: API writes are same-origin, SQL is prepared/bound, the owner secret is a Worker secret rather than source code, unauthorized production bootstrap fails closed, and baseline clickjacking, MIME, referrer, permissions, and CSP headers are present.

### Deployment and operations

1. Create a separate staging Worker and staging D1. The deployment guide describes one, but no staging environment exists in `wrangler.jsonc`.
2. Add a pre-deploy D1 Time Travel bookmark/backup step and a tested rollback runbook. Applying migrations before code deployment can leave the old Worker on a new schema if deployment fails.
3. Make health checks support `HEAD` or configure monitors to use `GET`. Live `HEAD /api/health` and `HEAD /api/v1/catalog` return 401 even though GET returns 200.
4. Separate liveness from readiness. The current health endpoint queries D1, so a D1 outage makes the entire Worker look dead.
5. Add structured logs, release identifiers, error-rate/latency alerts, D1 rows-read alerts, and a public incident contact. Observability is enabled, but deployments have no source message/tag.
6. Scope CI's Cloudflare API token to this Worker, D1 database, and required zone operations. Do not reuse the broad interactive OAuth credential for automation.
7. Decide whether to disable `workers_dev` after the hostname migration to prevent split local collections.

### Mobile, accessibility, and cross-browser quality

1. Fix the Search Lab mobile hero alignment. The current Chromium assertion fails and the captured page shows the hero ending before the right edge of the viewport.
2. Update the sticky-controls color assertion to compare computed color semantically; Chrome now serializes the same color as `color(srgb ...)`, making the current exact `rgb(...)` test brittle.
3. The full-screen mobile navigation is visually modal but lacks dialog semantics, a focus trap, and an inert/hidden background (`src/App.tsx:181-251`). Keyboard and screen-reader users can still reach underlying page content.
4. Add WebKit/iPhone projects. `playwright.config.ts:30-48` runs Chromium only even though most reported production issues came from iOS Safari.
5. Add automated axe/WCAG checks and manual keyboard, VoiceOver, 200% zoom, contrast, and reduced-motion passes. The app already has useful focus-visible and reduced-motion CSS, but there is no release evidence.
6. Increase the mobile logo/home touch target to at least 44×44 CSS pixels.
7. Add a username field (visually hidden if appropriate) to the owner password form to remove the browser accessibility/password-manager warning.

### Performance and resilience

1. Give hashed `/assets/*` files a one-year immutable cache policy. They currently return `max-age=0, must-revalidate` despite content hashes.
2. Cache or statically serve the catalog and compress/version it. Avoid rebuilding and serializing a 676 KB D1 payload for every new visitor.
3. Keep lazy sprite loading, but provide a locally controlled fallback for GitHub/PokeMiners outages and rate limiting.
4. Measure Core Web Vitals on production: LCP, INP, and CLS at mobile and desktop sizes. No trustworthy baseline was available during this audit. Use the 75th percentile targets recommended by web.dev: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1.
5. Add a failure-state test for catalog/API downtime and a recoverable offline/connection message. Do not let a transient catalog failure look like an empty collection.

Web Vitals source: <https://web.dev/articles/vitals>

### Public presentation and documentation

1. Add a canonical URL, Open Graph/Twitter metadata, and a sharing image. Discord is a core use case, so link previews matter.
2. Add a real `robots.txt`. It currently returns the SPA HTML with status 200.
3. Either add a valid web manifest and icons or stop implying installability. `/manifest.webmanifest` currently returns the SPA HTML.
4. Update stale catalog references in `README.md:66`, `docs/ARCHITECTURE.md:148`, and `docs/DEPLOYMENT.md:16` from `2026-08-11.2` to the actual `2026-08-12.1` snapshot.
5. Remove stale empty-state copy at `src/components/PokemonGrid.tsx:70`, which still suggests generation and type filters that no longer exist.
6. Reconcile branding across the repository name, Worker/database/internal storage keys, documentation, CatchGrid UI, and `dex.cjdev.app`. Internal legacy keys may be retained for data continuity, but document why.

## Recommended launch sequence

1. **Scope and rights gate:** decide full form-aware launch vs standard-form beta; resolve sprite usage.
2. **Data integrity gate:** fix local import validation, corrupt-storage recovery, pre-import backup, and hostname migration.
3. **Catalog gate:** correct completeness claims, implement authoritative denominators, make migrations immutable, record every input hash, and schedule Nickit.
4. **Release gate:** merge to `main`, add required CI, staging D1/Worker, backup, tagged deployment, and runtime Git SHA.
5. **Security/performance gate:** fix CSP/telemetry, rate-limit owner auth, cache the catalog, add immutable asset caching, policies, and alerts.
6. **Experience gate:** make all E2E tests green, add WebKit and accessibility coverage, and record Core Web Vitals.
7. **Soft launch:** invite a small group on the canonical domain for 48–72 hours; monitor D1 rows, Worker errors, sprite failures, imports, and mobile reports.
8. **Public launch:** announce only after the launch checklist is signed off and rollback has been rehearsed.

## Go/no-go checklist

- [ ] Product scope is accurate in UI and documentation.
- [ ] Required forms (or explicit beta exclusions) are implemented.
- [ ] Canonical-domain migration protects existing local collections.
- [ ] Asset usage has an accepted legal/permission position.
- [ ] `main` matches production and required CI is green.
- [ ] Catalog sync never rewrites applied migrations.
- [ ] Browser and cloud imports enforce identical rules.
- [ ] Catalog is edge-cached/static and D1 usage alerts are active.
- [ ] CSP has zero live console violations; analytics is intentionally enabled or disabled.
- [ ] Owner routes are rate-limited and private recovery is tested.
- [ ] Chromium and WebKit E2E suites pass.
- [ ] Accessibility and Core Web Vitals launch baselines are recorded.
- [ ] Privacy, security, licensing, and third-party notices are published.
- [ ] Staging, production backup, rollback, monitoring, and release identification are tested.
- [ ] Nickit shiny update is scheduled for August 16, 2026 local event time.

## Reference sources

- Pokémon GO Fest 2026 Global (Solgaleo and 2026 Mega information): <https://pokemongo.com/gofest/global>
- Gigantamax Rillaboom Max Battle Day: <https://pokemongo.com/en/news/gigantamax-rillaboom-max-battle-day-2026>
- Nickit Community Day: <https://pokemongo.com/en/news/communityday-august-2026-nickit>
- Current PoGoAPI released feed: <https://pogoapi.net/api/v1/released_pokemon.json>
- Current PoGoAPI shiny feed: <https://pogoapi.net/api/v1/shiny_pokemon.json>
- Cloudflare D1 pricing: <https://developers.cloudflare.com/d1/platform/pricing/>
- Cloudflare D1 limits: <https://developers.cloudflare.com/d1/platform/limits/>
- Cloudflare Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>
- PokeMiners asset disclaimer: <https://github.com/PokeMiners/pogo_assets#disclaimer>
- Core Web Vitals: <https://web.dev/articles/vitals>
