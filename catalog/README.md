# Versioned Pokémon catalog

`catalog.v1.json` contains one stable representative for every National Pokédex species through #1025, including unreleased placeholders, plus 177 reviewed Pokémon GO collector forms as of 2026-08-13. All app-facing IDs are owned by this project; PokeMiners filenames are isolated inside each form's `assets` mapping.

## Data contract

- `speciesId` identifies a National Pokédex species and is shared by its collector forms.
- `formId` is the stable collection-record key. Never derive or rename it from an upstream filename.
- `formKey` is a stable, human-readable key within a species, such as `standard`, `alola`, or `female`.
- `isDefault` identifies the one representative that contributes to National Dex and regional medal progress. Collector forms never inflate those denominators.
- `variantKind` and `collectorGroupId` organize regional, Unown, Mega/Primal, Gigantamax, Rotom, fusion, gender, and costume families without changing record IDs.
- `release` records reviewed Pokémon GO release facts. `null` means “not asserted by this snapshot,” not `false`.
- `rules` is the database-ready category state (`released`, `unreleased`, `ineligible`, or `unknown`).
- `tradeable` describes the form itself. Shadow Pokémon remain non-tradeable through their category rules.
- `assets.*.upstreamPath` is a relative PokeMiners path. The commit-pinned `source.rawBaseUrl` turns it into a deterministic URL.

Normal releases, Shiny releases, Shadow eligibility, types, rarity, and names begin with a hash-pinned PoGoAPI snapshot. Reviewed, dated overrides preserve newer official decisions, including Shiny Solgaleo, without rewriting older migrations. Purified follows Shadow; Normal, Hundo, XXL, and XXS are enabled for every released representative. Lucky follows trade eligibility: Mythical Pokémon are ineligible except for Meltan and Melmetal. A mined sprite proves only that an asset exists, not that a Pokémon or Shiny was released.

Collector forms expose Normal and Shiny tracking only. Lucky, Hundo, XXL, XXS, Shadow, and Purified are deliberately `ineligible` on those form rows, keeping species-category progress separate from form galleries. This reviewed snapshot includes all 28 Unown, released regional families, current Mega/Primal and Gigantamax families, selected gender/Rotom/fusion families, and a conservative initial costume set; it does not claim every historical costume is cataloged.

`catalog-overrides.v1.json` is the reviewed input, `region-medals.v1.json` is the versioned regional and category-specific denominator policy, and `CHANGE_REPORT_2026-08-13.md` records sources, hashes, decisions, and the remaining asset-license blocker. Each region explicitly defines Normal, Shiny, Lucky, Hundo, XXL, XXS, Shadow, and Purified thresholds. Every category's platinum goal remains the complete regional species allocation, including unreleased or currently ineligible species; availability never shrinks the goal. `catalog.v1.json` and migration `0009` are generated outputs.

## Sprite source and URL convention

Sprites come from the semantic addressable-assets directory in [PokeMiners/pogo_assets](https://github.com/PokeMiners/pogo_assets/tree/master/Images/Pokemon%20-%20256x256/Addressable%20Assets):

```text
https://raw.githubusercontent.com/PokeMiners/pogo_assets/{commit}/Images/Pokemon%20-%20256x256/Addressable%20Assets/{upstreamPath}
```

The manifest pins commit `1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90`. Do not use `master` in runtime URLs. Some upstream forms use `.fFORM`, `.cCOSTUME`, or `.g2`, while `.s` denotes a Shiny asset. The generator consumes exact mappings; it never picks an arbitrary matching filename.

## Verification

Offline validation needs only Node:

```powershell
node scripts/verify-sprites.mjs
```

Opt into HTTP `HEAD` requests for each unique referenced sprite:

```powershell
node scripts/verify-sprites.mjs --network
```

The verifier checks the complete #1–#1025 representative range, stable IDs, source hashes, form semantics, all 28 Unown, required families, current release regressions, regional medal denominators, and exact sprite mappings.

## Catalog synchronization

Catalog migrations are immutable. To create a new snapshot, increment `catalogVersion` and `nextMigration` in `catalog-overrides.v1.json`, then run `pnpm catalog:sync`. The generator refuses to overwrite an existing migration before making any network request. `pnpm catalog:verify` also regenerates the manifest, change report, and migration into a temporary directory and byte-compares all three with the checked-in artifacts, so hand edits and stale generated output fail the release gate.

The sync process:

1. Resolves a specific PokeMiners commit and enumerates its exact addressable-asset filename tree.
2. Verifies each PoGoAPI input against its expected published SHA-256, then records each raw response hash.
3. Hashes the sorted asset tree and complete reviewed override file for reproducibility.
4. Preserves stable IDs and existing migrations; retired mappings remain available for history.
5. Writes one new additive migration, the manifest, and a human-readable change report.
6. Requires review of release/eligibility evidence independently from asset presence.

## Copyright and project notice

The PokeMiners repository does **not** contain an open-source license. Its README describes the repository as educational-use-only and says the assets belong to The Pokémon Company and Niantic. That disclaimer does not grant redistribution rights.

This catalog records source attribution and paths but does not claim ownership or a license to the artwork. Public deployment should display an unofficial/no-affiliation notice, retain applicable ownership notices, and obtain legal review if its asset distribution model changes. Attribution alone is not permission.
