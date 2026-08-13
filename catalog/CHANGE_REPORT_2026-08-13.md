# Catalog change report — 2026-08-13.1

Generated from the versioned CatchGrid override file, hash-pinned PoGoAPI snapshots, and an exact commit-pinned PokeMiners filename tree. Sprite presence is treated only as asset evidence; release states come from metadata or an explicit reviewed source record.

## Coverage

- National Dex placeholders: 1025 (contiguous #0001–#1025)
- Released representative species: 949
- Reviewed collector forms: 177
- All default IDs remain `form-NNNN-standard`; form IDs use `form-NNNN-kebab-key`.

- alternate: 33
- costume: 10
- fusion: 4
- gender: 2
- gigantamax: 17
- mega: 52
- primal: 2
- regional: 57

## Explicit current-release decisions

- Nickit Community Day is scheduled for August 16, 2026, so Nickit remains non-Shiny in this August 13 snapshot.
- The reviewed 2026 release delta contains 12 species not yet present in the pinned PoGoAPI released feed.
- Mega, Primal, Gigantamax, fusion, regional, gender, Rotom, Unown, and selected costume families are separate collector forms and do not inflate National Dex species progress.
- Collector forms expose only Normal and Shiny tracking; Lucky, Hundo, XXL, XXS, Shadow, and Purified are ineligible on those form rows.

## Provenance

- **pogoapi-released-pokemon** (secondary, 2026-08-13): https://pogoapi.net/api/v1/released_pokemon.json — SHA-256 `740d9a03ed6853023e89912cc31b2c3fa513582b091ee301cdf31a35794cc58d`
- **pogoapi-shiny-pokemon** (secondary, 2026-08-13): https://pogoapi.net/api/v1/shiny_pokemon.json — SHA-256 `6697d100d4f941c1ddf542f2c3468d94a801ee93b2af621ca37a59a415fa62d4`
- **pogoapi-shadow-pokemon** (secondary, 2026-08-13): https://pogoapi.net/api/v1/shadow_pokemon.json — SHA-256 `5e8f7aa3c731678fd03c20a2f08b60b77e592f19891c4dabe2e59446b1523b8d`
- **pogoapi-pokemon-rarity** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_rarity.json — SHA-256 `257f0f9e27b0d763bf85bf91c864df86fa37e1ebd3000e92713c7398bb99a874`
- **pogoapi-pokemon-types** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_types.json — SHA-256 `298d1f24fb162e496bfadad97e3cd0713bc1400f2606ce64e42a91ccb2ddc54a`
- **pogoapi-pokemon-forms** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_forms.json — SHA-256 `3813b468dc6e5122096911f577152824c8019e4d15864648fb1dfa3a726dea11`
- **pogoapi-pokemon-evolutions** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_evolutions.json — SHA-256 `2ae1757dd611ff7140fd62308cc3a8f0244004e6be68cc956e559c3250aab78d`
- **pogoapi-pokemon-names** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_names.json — SHA-256 `0db52f1125a7493ceb4a89d08cf049b98637939d7cf4ae25feb091fe57f5bd7b`
- **pokeminers-asset-tree** (asset, 2026-08-13): https://github.com/PokeMiners/pogo_assets/tree/1a4ad1fc6c39f361ea85d53fc3040ce482ee9d90/Images/Pokemon%20-%20256x256/Addressable%20Assets — SHA-256 `8c352abf85a1628f119a1cba4ed4656593a533e3add1c88b9d368ac5c477a533`
- **catchgrid-reviewed-overrides** (manual, 2026-08-13): catalog/catalog-overrides.v1.json — SHA-256 `a3b7931e0d017e6774ba6a0f5f655da6ab3299b73837a78e4625a7f6323ed505`
- **review-record-official-medal-model** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/101-how-do-i-level-up-and-earn-medals/ — SHA-256 `2513d9b7f7d4d461194d6a01d7a986e67dad842ffd48857c90edbbbe19c88d6c`
- **review-record-official-shiny-forms** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2678-what-are-shiny-pokemon/ — SHA-256 `d63e3e52cbc02ef2e21dc23a40841ce6aa62cba748742b1e06fa1ebe390962a7`
- **review-record-official-mega-2026** (official, 2026-03-01): https://pokemongo.com/en/news/mega-evolution-2026-update?game_client=android — SHA-256 `5a8ec5a35e821d72250468ef5eaa0b9257fc51c5391f9a8baf063cd6a240ff4c`
- **review-record-official-mega-kalos** (official, 2026-03-01): https://pokemongo.com/gotour/global — SHA-256 `b53ed576b152d9ec85b6d9c15e64edd8f674790110d0de4ee39bc3e7fa796ffc`
- **review-record-official-mega-mewtwo** (official, 2026-07-12): https://pokemongo.com/news/mega-mewtwo-gofest-2026?hl=en_us — SHA-256 `7d19d00c36a2c47614ab9151db2e36b0ad0b69df019a091ffd0f53e0e4aeccbd`
- **review-record-official-mega-falinks** (official, 2026-05-23): https://pokemongo.com/news/falinks-super-mega-raid-day-2026?hl=en — SHA-256 `87054b8dcf74fd993f21e4b18f9bce195325dcfb01a713d44911da1bd18815cd`
- **review-record-official-gmax-rillaboom** (official, 2026-08-01): https://pokemongo.com/en/news/gigantamax-rillaboom-max-battle-day-2026 — SHA-256 `8a3a25290a5c202b920763e1b01e5b110b3ac94b191b930f554ca7d1cad651ef`
- **review-record-official-max-mechanics** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/4792-collecting-max-particles-and-dynamaxing-or-gigantamaxing-pokemon/ — SHA-256 `f0b7a0129c5ef7623cebfc1881ae1ee8b919898480a74a8f2bb8084f1a6ae48b`
- **review-record-official-go-fest-2026** (official, 2026-07-12): https://pokemongo.com/en/news/go-fest-2026-global-final-details — SHA-256 `03bbade063a6667a725223286cdd1ce532198ac5a5dd49e9ce99269c01361077`
- **review-record-official-nickit-schedule** (official, 2026-08-16T14:00:00): https://pokemongo.com/en/news/communityday-august-2026-nickit — SHA-256 `f939e72a328b43c76ccd9c37a37928a85659964529cb6ad1373867872cc4108f`
- **review-record-reviewed-go-form-inventory** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_types.json — SHA-256 `327efe8a6e8550fed186a092c86c810895e6bcb549db5a1e697ea9158817247e`
- **review-record-reviewed-unown-history** (secondary, 2026-07-25): https://raids.fyi/unown.html — SHA-256 `8117348ce3fe47f7d35d4813a530659b0330f9ed769cf4d25252372fbb1388c5`
- **review-record-official-news-index** (official, 2026-08-13): https://pokemongo.com/news — SHA-256 `2ed1abfee323771b508c2686a50086dc210e7f24d6a8c66725c33fb6a7b57f32`

## Known launch blocker

The PokeMiners sprite repository remains an asset mapping source, not proof of Pokémon GO release status. Its repository does not provide a clear redistribution license for a public production bundle; legal/provenance approval remains an external launch blocker.
