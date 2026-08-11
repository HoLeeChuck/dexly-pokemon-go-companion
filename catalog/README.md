# Versioned Pokémon catalog

`catalog.v1.json` contains the 949 National Pokédex species released in Pokémon GO as of 2026-08-11, represented by one stable standard collection form per species. All app-facing IDs are owned by this project; PokeMiners filenames are isolated inside each form's `assets` mapping.

## Data contract

- `speciesId` identifies a National Pokédex species. It may be shared by multiple forms later.
- `formId` is the stable collection-record key. Never derive it from an upstream filename.
- `formKey` is a stable, human-readable key within a species, such as `standard`, `alola`, or `female`.
- `normalizedName` is the lowercase, diacritic-free search key generated from `name`.
- `release` records audited Pokémon GO release facts. `null` means “not asserted by this seed,” not `false`.
- `eligibility` distinguishes a valid category combination from an ineligible one. Again, `null` means the catalog has not asserted a rule yet.
- `tradeable` describes the form itself. A trade specimen can still be blocked by traits or game rules; for example, Shadow Pokémon cannot be traded.
- `assets.*.upstreamPath` is a relative PokeMiners path. The commit-pinned `source.rawBaseUrl` turns it into a deterministic URL.

Normal releases, Shiny releases, Shadow eligibility, types, and names are generated from a hash-pinned PoGoAPI snapshot. Twelve recent 2026 debuts that its release file currently omits are maintained as an explicit reviewed delta based on the dated Pokémon GO availability chronology. Purified eligibility follows Shadow eligibility. Normal, Lucky, Hundo, XXL, and XXS are enabled for every released species. A mined sprite is evidence that an asset exists, not proof that a form or Shiny is released in Pokémon GO.

This version intentionally models the main National Dex checklist, not every costume, regional appearance, battle transformation, or letter/pattern form. Those variants require separate stable form IDs and release audits and can be added without changing these species IDs.

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

Run `pnpm catalog:sync` to refresh the generated manifest and additive migration, then treat the result as a reviewed data migration:

1. Resolve a specific PokeMiners commit and enumerate `Images/Pokemon - 256x256/Addressable Assets` through GitHub's tree API.
2. Diff the upstream filenames against the previous manifest. Never infer or rename `speciesId`, `formId`, or `formKey` automatically.
3. Map new or changed files to stable internal forms explicitly. Preserve retired mappings when collection history may reference them.
4. Audit the explicit recent-release delta and release, eligibility, and trade rules from an appropriate gameplay-data source. Do not derive those facts from sprite presence.
5. Update `source.commit`, `source.rawBaseUrl`, `catalogVersion`, and `releaseMetadataAsOf` together.
6. Run both verifier modes and review the manifest diff before merging.

## Copyright and project notice

The PokeMiners repository does **not** contain an open-source `LICENSE` file. Its README describes the repository as educational-use-only and states that the assets belong to The Pokémon Company and Niantic; PokeMiners says it did not create or modify the images and sounds. The repository's disclaimer does not grant redistribution rights.

This catalog therefore records source attribution and paths but does not claim ownership or a license to the artwork. Any public deployment should display a clear unofficial fan-project/no-affiliation notice, credit PokeMiners as the asset source, retain applicable Pokémon and Pokémon GO ownership notices, and obtain legal review if the distribution model changes. Attribution alone is not a substitute for permission.
