# CatchGrid

An unofficial, local-first Pokémon GO collection companion at <https://dex.cjdev.app/>. It shows a visual Pokédex, collection progress, shareable collection visuals, and Pokémon GO search strings. Public use needs no account or game credentials; collections stay in the browser.

Development folder: `D:\Projects\Pokemon\CatchGrid`. Current state and open items: [HANDOFF.md](HANDOFF.md). Lasting rules: [AGENTS.md](AGENTS.md).

## Product

| Destination | What it does                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Home        | Collection count, weekly/monthly recap card, almost-complete species, next legacy move window                            |
| Dex         | Browse Pokémon and forms, one-tap marking by category, silhouettes for missing Pokémon, evolution hints in details       |
| Progress    | Collection map (status or category-depth view), paint mode for ranges, regional medals, collection poster, compare links |
| Search Lab  | Build my own, My missing, Cody’s picks (eight recommendations), Discord output, legacy move windows with calendar export |
| Settings    | Appearance and accent color, trainer name, JSON/CSV export and reviewed import, recovery snapshots, bulk region setup    |
| `#compare`  | Opens a friend’s compare link and shows who can help whom; the data travels in the link fragment and is never uploaded   |
| `/cody`     | Unlisted private owner workflow (React app with authenticated Worker/D1 storage)                                         |

Press `/` anywhere to jump to a Pokémon.

Retired and not coming back: Events, Field Kit, the `/advanced/` page (its tools now live in Search Lab and Settings), public trading boards, public accounts, SMNA branding, and game-account automation. Old links fall back to Home.

## Layout

```text
app/          Public app (plain ES modules, no framework)
  main.js       state, routing, rendering and events
  data.js       browser collection storage (reuses src/lib contracts)
  catalog.js    bundled catalog with reviewed overlay (catalog-review.js)
  insights.js   medals, almost complete, evolution hints, recaps
  share.js      compare-link encoding and comparison
  poster.js     canvas posters and recap cards
  recommendations.js, legacy-moves.js, search.ts, dom.js, motion.js
  app.css, features.css, tokens.css
cody/         Entry for the private owner route
src/          React app used by /cody, plus shared browser storage and backup code
shared/       Domain, CSV and search rules shared by browser and Worker
worker/       Cloudflare Worker: public catalog API and authenticated owner API
catalog/      Versioned catalog, medals, evolution families, legacy move windows
migrations/   Immutable D1 history
public/       Static assets, artwork, service worker, legal pages
scripts/      Catalog sync/verification and release smoke checks
tests/        unit/, worker/, e2e/ (Playwright)
docs/         ARCHITECTURE.md, DEPLOYMENT.md, latest release record
```

## Develop

Node 22.13 or newer and the pnpm version pinned in `package.json`.

```powershell
cd D:\Projects\Pokemon\CatchGrid
pnpm install --frozen-lockfile
pnpm exec vite --host 127.0.0.1 --port 5191 --strictPort
```

Open `http://127.0.0.1:5191/`. Never overwrite `.dev.vars` or reset `.wrangler/state`.

| Command                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `pnpm test`                 | Unit and Worker/D1 tests                         |
| `pnpm lint` / `pnpm format` | Static checks and formatting                     |
| `pnpm build`                | Binding types, TypeScript and production build   |
| `pnpm test:e2e:chromium`    | Desktop, mobile and accessibility browser tests  |
| `pnpm catalog:verify`       | Catalog, artwork and immutable-generation checks |
| `pnpm check`                | Everything above except browser tests            |

Set `PLAYWRIGHT_USE_SYSTEM_CHROME=1` to use installed Chrome for browser tests.

## Data rules

Stable form IDs, the `catchgrid:local-profile:v2` schema, JSON/CSV backups and recovery snapshots stay compatible. National Dex totals count default species only. Catalog `2026-08-24.1` is a dated snapshot; do not present it as current game data without research. Legacy infrastructure names (`dexly-companion`, `dexly-db`, `dexly:*` keys) are kept on purpose.

Deployment is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and needs explicit approval each time.
