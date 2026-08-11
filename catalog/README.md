# Versioned Pokémon catalog

`catalog.v1.json` is a deliberately small seed catalog for the first collection vertical slice. It contains 23 standard forms spanning Kanto through Alola. All app-facing IDs are owned by this project; PokeMiners filenames are isolated inside each form's `assets` mapping.

## Data contract

- `speciesId` identifies a National Pokédex species. It may be shared by multiple forms later.
- `formId` is the stable collection-record key. Never derive it from an upstream filename.
- `formKey` is a stable, human-readable key within a species, such as `standard`, `alola`, or `female`.
- `normalizedName` is the lowercase, diacritic-free search key generated from `name`.
- `release` records audited Pokémon GO release facts. `null` means “not asserted by this seed,” not `false`.
- `eligibility` distinguishes a valid category combination from an ineligible one. Again, `null` means the catalog has not asserted a rule yet.
- `tradeable` describes the form itself. A trade specimen can still be blocked by traits or game rules; for example, Shadow Pokémon cannot be traded.
- `assets.*.upstreamPath` is a relative PokeMiners path. The commit-pinned `source.rawBaseUrl` turns it into a deterministic URL.

The current seed conservatively marks Normal and Shiny release for species whose releases are long established. It asserts common Normal, Shiny, Lucky, Hundo, XXL, and XXS eligibility. The three Kanto starters also carry audited Shadow and Purified release state so the vertical slice can exercise those categories; other Shadow and Purified values remain `null` until a separate, versioned gameplay-rules source is added. A mined sprite is evidence that an asset exists, not proof that a form or Shiny is released in Pokémon GO.

## Sprite source and URL convention

Sprites come from the semantic addressable-assets directory in [PokeMiners/pogo_assets](https://github.com/PokeMiners/pogo_assets/tree/master/Images/Pokemon%20-%20256x256/Addressable%20Assets):

```text
https://raw.githubusercontent.com/PokeMiners/pogo_assets/{commit}/Images/Pokemon%20-%20256x256/Addressable%20Assets/{upstreamPath}
```

The manifest pins commit `1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90`. Do not replace it with `master` in runtime URLs. PokeMiners form tokens are useful import data but are not stable application identifiers. Some observed forms use `.fFORM`, `.cCOSTUME`, or `.g2`, while `.s` denotes a Shiny asset. These conventions are not consistent enough to construct every filename safely, so the application should consume explicit mappings from the manifest.

## Verification

Offline validation needs only Node and does not install packages:

```powershell
node scripts/verify-sprites.mjs
```

Opt into HTTP `HEAD` requests for every referenced sprite:

```powershell
node scripts/verify-sprites.mjs --network
```

An alternate manifest can be checked with `--manifest path/to/catalog.json`. Offline validation checks the schema version, required fields, identifier and Dex/form uniqueness, normalized names, types, release and eligibility values, pinned source URL, safe relative asset paths, and required Normal/Shiny mappings. Network validation is intentionally opt-in so normal builds remain deterministic and do not depend on GitHub availability.

## Catalog synchronization

Treat an upstream refresh as a reviewed data migration:

1. Resolve a specific PokeMiners commit and enumerate `Images/Pokemon - 256x256/Addressable Assets` through GitHub's tree API.
2. Diff the upstream filenames against the previous manifest. Never infer or rename `speciesId`, `formId`, or `formKey` automatically.
3. Map new or changed files to stable internal forms explicitly. Preserve retired mappings when collection history may reference them.
4. Audit release, eligibility, and trade rules from an appropriate gameplay-data source. Do not derive those facts from sprite presence.
5. Update `source.commit`, `source.rawBaseUrl`, `catalogVersion`, and `releaseMetadataAsOf` together.
6. Run both verifier modes and review the manifest diff before merging.

## Copyright and project notice

The PokeMiners repository does **not** contain an open-source `LICENSE` file. Its README describes the repository as educational-use-only and states that the assets belong to The Pokémon Company and Niantic; PokeMiners says it did not create or modify the images and sounds. The repository's disclaimer does not grant redistribution rights.

This catalog therefore records source attribution and paths but does not claim ownership or a license to the artwork. Any public deployment should display a clear unofficial fan-project/no-affiliation notice, credit PokeMiners as the asset source, retain applicable Pokémon and Pokémon GO ownership notices, and obtain legal review if the distribution model changes. Attribution alone is not a substitute for permission.
