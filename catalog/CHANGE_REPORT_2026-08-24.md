# CatchGrid catalog, forms, regions, and artwork update — 2026-08-24.1

## Outcome

- Stable default IDs retained: 1025
- Collector forms: 244
- Regional availability records: 40
- Repository-local HOME thumbnails: 1915 (89.9 MiB)
- Runtime hotlinks: 0

## Artwork policy

Pokémon HOME artwork is downloaded at build time from Bulbagarden Archives and pinned in `catalog/home-artwork-manifest.v1.json` with source file pages, timestamps, Archives SHA-1 values, local SHA-256 values, and byte sizes. Bulbagarden Archives does not grant blanket unrestricted rights to this material, so the Archives copyright/fair-use notice remains in product notices. Alternate and event forms without HOME-specific art explicitly use representative species artwork; Pokémon GO event costumes cannot transfer to HOME.

## Costume inventory audit

The Bulbapedia Event Pokémon (GO) page is a useful secondary inventory and availability chronology, but it is not an official release source and its page currently includes entries dated after this catalog cutoff. CatchGrid retains every existing costume ID. Its 10 reviewed costume records use explicit representative-art fallbacks. Full page coverage remains a documented gap pending row-by-row official release corroboration and a suitable locally reusable event-art source; inventory presence alone does not create collection rows.

## Corrected reports

- Gossifleur and Eldegoss remain Shiny-unreleased; the submitted Shiny report was not corroborated.
- Arrokuda and Barraskewda are released from August 18, 2026; their Shinies remain unreleased.
- Hisuian Sliggoo and Hisuian Goodra remain unreleased because no independent Pokémon GO release evidence was found.
- Bloodmoon Ursaluna is tracked separately as unreleased; standard Ursaluna remains Shiny-released.

## Provenance

- **pogoapi-released-pokemon** (secondary, 2026-08-19): https://pogoapi.net/api/v1/released_pokemon.json — SHA-256 `740d9a03ed6853023e89912cc31b2c3fa513582b091ee301cdf31a35794cc58d`
- **pogoapi-shiny-pokemon** (secondary, 2026-08-19): https://pogoapi.net/api/v1/shiny_pokemon.json — SHA-256 `6697d100d4f941c1ddf542f2c3468d94a801ee93b2af621ca37a59a415fa62d4`
- **pogoapi-shadow-pokemon** (secondary, 2026-08-19): https://pogoapi.net/api/v1/shadow_pokemon.json — SHA-256 `5e8f7aa3c731678fd03c20a2f08b60b77e592f19891c4dabe2e59446b1523b8d`
- **pogoapi-pokemon-rarity** (secondary, 2026-08-19): https://pogoapi.net/api/v1/pokemon_rarity.json — SHA-256 `257f0f9e27b0d763bf85bf91c864df86fa37e1ebd3000e92713c7398bb99a874`
- **pogoapi-pokemon-types** (secondary, 2026-08-19): https://pogoapi.net/api/v1/pokemon_types.json — SHA-256 `298d1f24fb162e496bfadad97e3cd0713bc1400f2606ce64e42a91ccb2ddc54a`
- **pogoapi-pokemon-forms** (secondary, 2026-08-19): https://pogoapi.net/api/v1/pokemon_forms.json — SHA-256 `3813b468dc6e5122096911f577152824c8019e4d15864648fb1dfa3a726dea11`
- **pogoapi-pokemon-evolutions** (secondary, 2026-08-19): https://pogoapi.net/api/v1/pokemon_evolutions.json — SHA-256 `2ae1757dd611ff7140fd62308cc3a8f0244004e6be68cc956e559c3250aab78d`
- **pogoapi-pokemon-names** (secondary, 2026-08-19): https://pogoapi.net/api/v1/pokemon_names.json — SHA-256 `0db52f1125a7493ceb4a89d08cf049b98637939d7cf4ae25feb091fe57f5bd7b`
- **historical-shadow-pokemon-db** (secondary, 2026-08-19): https://pokemondb.net/go/shadow — SHA-256 `222b00af94b7f5c5e1de11603b79ac12a429510e74889f6bc98420bf58cc6bbb`
- **catchgrid-reviewed-overrides** (manual, 2026-08-19): catalog/catalog-overrides.v1.json — SHA-256 `4892daddda4d5eebc61bcf1bbe49cbe2a0f21d770319ab53bc4a0013e8d3ee7d`
- **review-record-official-mega-raichu** (official, 2026-07-18): https://pokemongo.com/news/raichu-super-mega-raid-day-2026 — SHA-256 `e4d9e1176ca1cf06eb8722f180e44b19092fa5d25cc2ee5cbc8b944680f592dd`
- **review-record-official-shadow-seel** (official, 2026-06-25): https://pokemongo.com/news/flying-taxi-taken-over-2026 — SHA-256 `a0b324b1cb0e46e078a2d8f3087817679b348fb56ed70732b52ef7c79c684ed0`
- **review-record-historical-shadow-database** (secondary, 2026-08-19): https://pokemondb.net/go/shadow — SHA-256 `d79513575204310c8bb9f46737dcbff8fb7659e78507fb3262a7a83806457de1`
- **review-record-official-medal-model** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/101-how-do-i-level-up-and-earn-medals/ — SHA-256 `2513d9b7f7d4d461194d6a01d7a986e67dad842ffd48857c90edbbbe19c88d6c`
- **review-record-official-shiny-forms** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2678-what-are-shiny-pokemon/ — SHA-256 `d63e3e52cbc02ef2e21dc23a40841ce6aa62cba748742b1e06fa1ebe390962a7`
- **review-record-official-mega-2026** (official, 2026-03-01): https://pokemongo.com/en/news/mega-evolution-2026-update?game_client=android — SHA-256 `5a8ec5a35e821d72250468ef5eaa0b9257fc51c5391f9a8baf063cd6a240ff4c`
- **review-record-official-mega-kalos** (official, 2026-03-01): https://pokemongo.com/gotour/global — SHA-256 `b53ed576b152d9ec85b6d9c15e64edd8f674790110d0de4ee39bc3e7fa796ffc`
- **review-record-official-mega-mewtwo** (official, 2026-07-12): https://pokemongo.com/news/mega-mewtwo-gofest-2026?hl=en_us — SHA-256 `7d19d00c36a2c47614ab9151db2e36b0ad0b69df019a091ffd0f53e0e4aeccbd`
- **review-record-official-mega-falinks** (official, 2026-05-23): https://pokemongo.com/news/falinks-super-mega-raid-day-2026?hl=en — SHA-256 `87054b8dcf74fd993f21e4b18f9bce195325dcfb01a713d44911da1bd18815cd`
- **review-record-official-gmax-rillaboom** (official, 2026-08-01): https://pokemongo.com/en/news/gigantamax-rillaboom-max-battle-day-2026 — SHA-256 `8a3a25290a5c202b920763e1b01e5b110b3ac94b191b930f554ca7d1cad651ef`
- **review-record-official-max-mechanics** (official, 2026-08-13): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/4792-collecting-max-particles-and-dynamaxing-or-gigantamaxing-pokemon/ — SHA-256 `f0b7a0129c5ef7623cebfc1881ae1ee8b919898480a74a8f2bb8084f1a6ae48b`
- **review-record-official-go-fest-2026** (official, 2026-07-12): https://pokemongo.com/en/news/go-fest-2026-global-final-details — SHA-256 `03bbade063a6667a725223286cdd1ce532198ac5a5dd49e9ce99269c01361077`
- **review-record-official-nickit-schedule** (official, 2026-08-16T14:00:00): https://pokemongo.com/en/news/communityday-august-2026-nickit — SHA-256 `2d5218acbadca6f25072f70d2ed3c5648e2a396de8e754d709aea7aabfb9174a`
- **review-record-reviewed-go-form-inventory** (secondary, 2026-08-13): https://pogoapi.net/api/v1/pokemon_types.json — SHA-256 `327efe8a6e8550fed186a092c86c810895e6bcb549db5a1e697ea9158817247e`
- **review-record-reviewed-unown-history** (secondary, 2026-07-25): https://raids.fyi/unown.html — SHA-256 `8117348ce3fe47f7d35d4813a530659b0330f9ed769cf4d25252372fbb1388c5`
- **review-record-official-news-index** (official, 2026-08-13): https://pokemongo.com/news — SHA-256 `2ed1abfee323771b508c2686a50086dc210e7f24d6a8c66725c33fb6a7b57f32`
- **catchgrid-base-catalog-2026-08-19** (manual, 2026-08-19): catalog/catalog-base-2026-08-19.v1.json — SHA-256 `98528c9ff8a742271e4d3403d60ca5c89ebac0a7795000fe39b554a6dbaf228f`
- **bulbagarden-home-artwork-manifest** (asset, 2026-08-24): catalog/home-artwork-manifest.v1.json — SHA-256 `e36275fc2c435afc77ea3986b6fa6d92bddef1a1aab2d3722164e5b77865b32a`
- **review-record-official-water-festival-2026** (official, 2026-08-18): https://pokemongo.com/en/news/water-festival-2026 — SHA-256 `318a1fb867032454112d84720c8ba751a8b2b27d8a1759be2961c4fb481e482a`
- **review-record-official-spring-2025** (official, 2025-04-09): https://pokemongo.com/en/post/spring-into-spring-2025 — SHA-256 `53d8a59a8d755ce864e1226a454dd558700c0a41a886b8b0da972ae53d22c646`
- **review-record-official-teddiursa-community-day** (official, 2022-11-12): https://pokemongo.com/post/community-day-november-2022-teddiursa — SHA-256 `a5affa333ac4bf86ed1e36500ffabdfd75fb9c9c113848f30ae14b71246f1d2e`
- **review-record-secondary-current-shadow-feed** (secondary, 2026-08-24): https://pogoapi.net/api/v1/shadow_pokemon.json — SHA-256 `f3a1b03ec6f41116055ea92b42bc49a3bcdc4efd34e6066b035526de06ec0a5e`
- **review-record-official-news-cutoff-review** (official, 2026-08-24): https://pokemongo.com/news — SHA-256 `13374a9ce290c924d6197e78288b9cc49c17b9283d4c1d5e90cda640a5a164e5`
- **review-record-official-sustainability-2026** (official, 2026-04-14): https://pokemongo.com/pl/news/sustainability-week-2026 — SHA-256 `c90a24a6eb72bf973cd335647dd12ffb3fed013db099e476be544dc3843fa5af`
- **review-record-official-steeled-resolve-2026** (official, 2026-04-30): https://pokemongo.com/news/steeled-resolve-taken-over-2026 — SHA-256 `ff608da22d135b685381c0f714fa2544f1030c6d546687c6b3016e79e20bfa6b`
- **review-record-official-scorbunny-community-day** (official, 2026-03-14): https://pokemongo.com/news/communityday-march-2026-scorbunny — SHA-256 `27ee75c676abb4f17682082b550d66c4b171db32345d58417631d82168fd7b27`
- **review-record-official-sobble-community-day** (official, 2026-07-18): https://pokemongo.com/en/news/communityday-july-2026-sobble — SHA-256 `82d87e13b7ac7a5ec984aa9a6bab3b53760838a38749c59fe803e2bc14dc3b7d`
- **review-record-official-bug-out-2026** (official, 2026-03-17): https://pokemongo.com/news/bug-out-2026 — SHA-256 `a18b26db9850c4027c274de545b222467f4a98280f477b55ecf652e4933a3426`
- **review-record-official-halloween-2025** (official, 2025-10-21): https://pokemongo.com/en/news/halloween-part-1-2025 — SHA-256 `e5e3a6c0c2d7a13678fd4de2351ad9fed1a47b7544f3d5077ad00c21b9f5df9c`
- **review-record-official-summer-marathon-2026** (official, 2026-08-04): https://pokemongo.com/news/summer-marathon-2026 — SHA-256 `40ccdc3d5852ef9069ab1c64964e0fbcb73987c1a581817d5825dfa24e3bb098`
- **review-record-secondary-lunala-raids-2026** (secondary, 2026-08-19): https://leekduck.com/events/lunala-in-5-star-raid-battles-august-2026/ — SHA-256 `c2d64ea821e2ff177cd6ec4275da55ef0b435533328b6c2b450064490bb7d532`
- **review-record-official-go-tour-kalos** (official, 2026-03-01): https://pokemongo.com/gotour/global — SHA-256 `1130184acd79716c7de51e07599ce1defc64bb294e1856686b3d7eaf9d2c128c`
- **review-record-official-oricorio-2026** (official, 2026-05-09): https://pokemongo.com/news/catch-mastery-oricorio-2026 — SHA-256 `ce357468cbd5620d80693b3eb93589364508e7315b0d84028399c2cf07e50fae`
- **review-record-official-vivillon** (official, 2022-12-15): https://pokemongo.com/en/post/vivillon-launch-postcard-feature — SHA-256 `b16462cdec68a73c38fc8342a4ed4021189d009a76c6d03e31e771deedcbd3d4`
- **review-record-official-flabebe-community-day** (official, 2025-09-14): https://pokemongo.com/en/post/communityday-september-2025-flabebe — SHA-256 `641ca6d1795032c033766528ed8354befbbdc6c512ac42a2b385cda7f6536a9a`
- **review-record-official-furfrou** (official, 2021-09-21): https://pokemongo.com/post/fashion-week-2021 — SHA-256 `d334f2d516ba2ff8109c67510c761bf4269a0e0d538b21e2f35a2d95fbc1a473`
- **review-record-official-tatsugiri** (official, 2025-07-15): https://pokemongo.com/post/water-festival-2025 — SHA-256 `ac16690eef9b93b227bd5d1179475664f0e2391f603e03565c9c46691c4083b6`
- **review-record-official-crowned-heroes** (official, 2025-06-29): https://pokemongo.com/post/crowned-energy-resource-zacian-zamazenta — SHA-256 `21f8403f8f39d625e8529a308515e2b658573475497443f014eb7b2c2b9065da`
- **review-record-official-urshifu** (official, 2025-05-21): https://pokemongo.com/post/final-strike-2025 — SHA-256 `06f2c011cececb7671c070df65b4fa927af57f9d66a9e6197929100538b6312a`
- **review-record-official-enamorus-therian** (official, 2026-02-14): https://pokemongo.com/en/news/enamorus-therian-raid-day-2026 — SHA-256 `22c3373b543bcdace8db95c9b0e8a788251528c83adda02ad7f95835880f55a3`
- **review-record-official-hoopa** (official, 2021-11-26): https://pokemongo.com/post/mischief-unbound-2021 — SHA-256 `ebdf443411178324f854ffbeaafa108e550dacbe45b0704e5caad1898aed9217`
- **review-record-official-pumpkaboo** (official, 2021-10-15): https://pokemongo.com/en/post/halloween-2021 — SHA-256 `ca2deaa8b1ae2fde2ee3c70c0ed71ef5c0a1becfbc0e60c9d109fabbbfa41380`
- **review-record-official-lycanroc-dusk** (official, 2024-01-06): https://pokemongo.com/es_mx/post/lustrous-odyssey-2024 — SHA-256 `71f95215dcecd8675fcb84ebb4e1a4f73ee7d3a05993d4374fa309a55653bc00`
- **review-record-official-toxtricity** (official, 2025-11-15): https://pokemongo.com/news/into-the-wild-2025 — SHA-256 `d8657731aaeff00c4b2154da89ceb44990024fde73c948e0c8a8edc30dbef6c5`
- **review-record-official-polteageist-forms** (official, 2026-08-24): https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/4847-appraising-your-pokemon/ — SHA-256 `82d82299a4d0bcddb6b9bedb388c82904b923116a5064191fe9b8f7d5209c76c`
- **review-record-secondary-form-reference** (secondary, 2026-08-24): https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_with_form_differences — SHA-256 `c2f0bd036bc61e444bc00912631da06b1f8d8729f0a4fce2b89150b6e13cf6a9`
- **review-record-archives-home-artwork** (asset, 2026-08-24): https://archives.bulbagarden.net/wiki/Category:HOME_artwork — SHA-256 `d1a009a253b9433766012a6e91cdbb692e5d5f9960a336d8881fe15926fa98d5`
- **review-record-archives-copyrights** (asset, 2026-08-24): https://archives.bulbagarden.net/wiki/Archives:Copyrights — SHA-256 `9d44704abc55e70298f9ba289df746e826bd5f09831f36e2b50f567b14a22309`
- **review-record-secondary-event-pokemon-inventory** (secondary, 2026-08-24): https://bulbapedia.bulbagarden.net/wiki/Event_Pok%C3%A9mon_(GO) — SHA-256 `19d6407ab45600fc6f06e142f1ce5113acdd850e55362c5711134f40ade59ba4`
