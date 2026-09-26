# Versioned Pokémon catalog

`catalog.v1.json` contains one stable representative for every National Pokédex species through #1025, including unreleased placeholders, plus 244 reviewed Pokémon GO collector forms as of 2026-08-24. Application-owned IDs never depend on artwork filenames.

## Data contract

- `speciesId` identifies a National Pokédex species and is shared by its collector forms.
- `formId` is the stable collection-record key. Existing `form-NNNN-standard` IDs remain unchanged when a representative gains a specific form label.
- `isDefault` identifies the one representative that contributes to National Dex and regional medal progress. Alternate forms never inflate species totals.
- `release` and `rules` separate reviewed availability from collection eligibility. Asset presence is never release proof.
- `availability` is advisory geography. It powers recommendations and the accessible regional browser but never hides forms or changes saved collection state.
- `assets.*.upstreamPath` points to a repository-local file under `public/artwork/pokemon-home`.
- `artworkIsFallback` is true when a named form intentionally uses representative species art. The UI exposes that state rather than silently showing a possibly wrong form.

`catalog/catchgrid-update.v1.json` is the reviewed availability/form source, `catalog/catalog-base-2026-08-19.v1.json` is the immutable stable-ID baseline, and `catalog/home-artwork-manifest.v1.json` pins the artwork inventory. Migration `0011` contains additive schema changes and upserts; it never deletes form or collection rows.

## Recording a Pokémon GO release

When Niantic announces a debut (a new species, a Shiny, a Shadow, …), add one entry to `catalog/releases.v1.json`. No catalog regeneration or migration is needed; the public app applies the ledger on top of `catalog.v1.json` at build time.

```json
{
  "date": "2026-10-10",
  "dex": 848,
  "categories": ["normal", "shiny"],
  "source": "https://pokemongo.com/news/…",
  "note": "Toxel hatches from 7 km Eggs."
}
```

- `date`: when it became available (YYYY-MM-DD, not in the future).
- `dex` for the default species, or `formId` (for example `form-0052-galar`) for one form.
- `categories`: any of `normal`, `shiny`, `lucky`, `hundo`, `xxl`, `xxs`, `shadow`, `purified`. Male and Female follow Normal and `genders.v1.json` automatically.
- `source`: an official https link (pokemongo.com, niantic.helpshift.com, nianticlabs.com, pokemon.com). Community sites are not accepted here.
- `status` (optional): `released` by default; `unreleased` or `ineligible` corrects an earlier mistake. When entries disagree, the newest date wins.

`pnpm test` validates the ledger (tests/unit/app-releases.test.ts) and fails on a bad date, a non-official source, an unknown Pokémon or category, or a duplicate. Deploying publishes the change to everyone; each person’s collection is kept as is, and newly released cells simply become markable. The private `/cody` cloud catalog is still updated through migrations.

## Artwork synchronization

Pokémon HOME art comes from the [Bulbagarden Archives HOME artwork category](https://archives.bulbagarden.net/wiki/Category:HOME_artwork). Run:

```powershell
pnpm catalog:sync:artwork
pnpm catalog:sync
```

The artwork sync uses the MediaWiki `imageinfo` API at build time, downloads 256px files locally, and records each Archives file page, source timestamp, Archives SHA-1, local SHA-256, and byte size. The app never scrapes or hotlinks Bulbagarden at runtime. A missing required normal or released-Shiny file fails the sync.

Named forms use exact HOME files when a reviewed mapping exists. Otherwise they use the species representative with `artworkIsFallback: true`. Pokémon GO event costumes cannot transfer to HOME, so existing costume IDs use explicit representative-art fallbacks. The [Bulbapedia Event Pokémon (GO) page](<https://bulbapedia.bulbagarden.net/wiki/Event_Pok%C3%A9mon_(GO)>) is treated as a secondary inventory and chronology; it is not official release evidence, and future-dated entries beyond the catalog cutoff are excluded.

## Verification

```powershell
pnpm validate:pokemon-data
pnpm catalog:verify
```

The verifier checks the complete #1–#1025 range, stable IDs, source hashes, category rules, alternate-form invariants, regional metadata, local artwork paths, and byte-for-byte reproducibility of the catalog, migration, and report.

## Copyright and project notice

Pokémon names and imagery remain property of their respective owners. The [Bulbagarden Archives copyright notice](https://archives.bulbagarden.net/wiki/Archives:Copyrights) does not grant blanket unrestricted redistribution rights. CatchGrid retains attribution, provenance, and its unofficial/no-affiliation notice; attribution is not represented as permission or an open license.
