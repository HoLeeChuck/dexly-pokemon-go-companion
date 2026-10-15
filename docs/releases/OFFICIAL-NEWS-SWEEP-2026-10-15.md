# Official news sweep, October 15, 2026

## Scope and method

Availability interval: **September 29 through October 15, 2026**, inclusive. September 29 is the newest entry in `catalog/releases.v1.json` on `prism-forward` (`e1eedf0`), not the October 4 deployment date. The existing Bramblin branch already reaches October 13; October 13-15 was checked too. Future-dated and undated items in every relevant section of `docs/codex-questions.md` were revisited.

Read the 30 articles on the [official news index](https://pokemongo.com/news), the two Harvest articles, the Horizons article, and the season page. Older evolution announcements were read only to substantiate the October catch-ups. Official search results supplemented the index for Brambleghast, Shiny Bramblin, the undated Dynamax species, and October Community Day Classic. Negative search results do not prove that a release never happened.

All links below were checked October 15. Dates in the tables are **obtainable/event dates**, not invented publication dates. The retrieved index and most articles expose no publication timestamp. Raw HTTP responses and SHA-256 records are retained locally in `archive/release-work/2026-10-15-prep/official/`; `official-source-manifest.json` records the reviewed URLs and retrieval times.

## Released changes and the candidate decision

| Available date | Official evidence | Disposition |
| --- | --- | --- |
| Sep 29 | [Harvest Festival](https://pokemongo.com/news/harvest-festival-2026): Shiny Applin | Existing ledger entries already cover Applin, Flapple, Appletun, Dipplin and Hydrapple with sourced evolution relationships. Preserve. |
| Oct 2 | [Harvest Festival: Taken Over](https://pokemongo.com/news/harvest-festival-tgr-2026): Shiny Shroodle; Shadow Zekrom, Wimpod, Fomantis, Sandygast | Preserve all five prepared entries and paired Purified availability. No Shiny Shadow claim is inferred from a detached shiny footnote. |
| Oct 2 | Same takeover plus the official evolution sources below | Add Shiny Grafaiai and Shadow/Purified Golisopod and Palossand. These are supported evolution inferences under the existing ledger policy, not direct evolved-species announcements. |
| Oct 3, 14:00 local | [Gigantamax Cinderace Max Battle Day](https://pokemongo.com/news/gigantamax-cinderace-max-battle-day-2026) | Add dated Shiny provenance for `form-0815-gigantamax`. The base catalog already marks it released, so this does not change its availability. |
| Oct 13, 10:00 local | [Buddy Trek](https://pokemongo.com/news/fall-marathon-buddy-trek-2026) | Preserve Bramblin Normal/Lucky/100%/XXL/XXS. No Shiny Bramblin or Brambleghast GO evolution was established. |

The existing six-entry release should ship **with these four additional ledger records**. Ten records differ from `prism-forward`: nine change availability and one supplies provenance. The newest obtainable date remains **2026-10-13**, so the UI must not claim `Catalog updated 2026-10-15` merely because this sweep ran today.

Evolution evidence:

- [Fashion Week takeover, January 15, 2025](https://pokemongo.com/news/fashion-week-taken-over-by-TGR) explicitly gives Shroodle → Grafaiai with 50 Candy.
- [TCG crossover, June 16, 2022](https://pokemongo.com/news/Pokemon-TCG-Crossover-Event) explicitly gives Wimpod → Golisopod with 400 Candy.
- [Water Festival, June 6, 2023](https://pokemongo.com/news/water-festival-2023) explicitly gives Sandygast → Palossand with 50 Candy.
- [Official Shadow/Purified help](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2396-shadow-pokemon-purified-pokemon/) documents purification and evolving Purified Pokémon. The project already pairs Purified with sourced Shadow availability.
- [Lush Jungle](https://pokemongo.com/news/lush-jungle-event) establishes Fomantis and Lurantis debuts, but its retrieved text does not establish the GO evolution relationship. Shadow/Purified Lurantis stays unavailable pending that source. Main-series relationships and artwork are insufficient.

## Costumes, backgrounds, event rewards and moves

These are recorded as findings. The current public model filters costumes and has no background, avatar-inventory, or Dynamax category; this preparation does not expand those models.

| Date/window | Source and finding | Action |
| --- | --- | --- |
| Sep 16-22, prior to interval | [Horizons](https://pokemongo.com/news/pokemon-horizons-celebration-event-2026): Friede-goggles Charmander, Charmeleon and Charizard, including explicit costume evolution | Rechecked Q6 context. Costume/background exclusion preserved. |
| Sep 25-Jan 15 | [adidas collaboration](https://pokemongo.com/news/pokemon-x-adidas-2026): avatar jacket, cap and shoes; Lucario research | Event-exclusive avatar rewards, no new tracked Pokémon availability. |
| Sep 27-Oct 20 | [TCG 30th celebration](https://pokemongo.com/news/tcg-30th-celebration-event): Mega Gengar raids, research and Gengar Knit Cap gift-card reward (redemption through Oct 31) | Existing Pokémon; avatar reward outside catalog. |
| Sep 28-Oct 1 | [IIT-Delhi Rendezvous](https://pokemongo.com/news/pokemongo-iitdelhi-2026) | Existing encounters and item rewards; no new tracked release found. |
| Sep 28 research; Oct 2 event | [Patterns of the Wild](https://pokemongo.com/news/patterns-of-the-wild-2026): batik-shirt Pikachu with a new Special Background | Background/costume finding only. Distinguish the earlier research window from the Oct 2 event. |
| Oct 1 onward | [APAC mall exploration](https://pokemongo.com/news/apac-mall-exploration-2026): party-hat Pikachu and mall research; later locations have separate dates | Returning costume, no new default species. |
| Oct 4-10 | [World Space Week](https://pokemongo.com/news/world-space-week-2026): new Astronaut Pikachu, including shiny | Q6 future deferral is now a past event. Remains outside the supported public costume model. |
| Oct 4-Apr 30, 2027 | [ESA partnership](https://pokemongo.com/news/european-space-agency-event): Astronaut Pikachu and museum Location Backgrounds | Record separately from the global event; no new tracked form. |
| Oct 6-Nov 3 | [GO Pass October](https://pokemongo.com/news/go-pass-october-2026): Kyogre and returning Lucky Trinket; trinket expires Nov 8 | No Pokémon eligibility change. Item not modeled. |
| Oct 10 | [Zorua Community Day](https://pokemongo.com/news/communityday-october-2026-zorua): Zorua background and Zoroark Sucker Punch through 21:00 local | Existing `legacy-moves.v1.json` window matches. No shiny debut inferred from boosted odds. |
| Oct 13-19 | [Buddy Trek](https://pokemongo.com/news/fall-marathon-buddy-trek-2026): marathon-visor Pikachu research; Mega Manectric Super Max and Discharge+ | Costume and move/level findings do not create a new form or a legacy evolution window. |

## Future and unresolved findings, including all deferred items

| Date | Official source / finding | Decision |
| --- | --- | --- |
| Oct 17, 11:00 local | [Sandile Hatch Day](https://pokemongo.com/news/sandile-hatch-day-2026): boosted existing shiny; Incubator/Star Piece research rewards | No debut or ledger change. |
| Oct 19, 17:00 local | [Minior showers](https://pokemongo.com/news/minior-meteor-showers-2026) | Keep scheduled default-species release. The post says colors debut across different showers; it does **not** establish all seven as available on Oct 19 or identify the first color. Correct the old runbook's overly broad claim that colors are merely battle states. Do not invent color identities. |
| Oct 24, 14:00 local | [Lake trio Max Battle Day](https://pokemongo.com/news/dynamax-uxie-mesprit-azelf-max-battle-day-2026) | Q5 now has a specific date for Dynamax Uxie/Mesprit/Azelf, including shiny encounters. Future and outside Dynamax model. |
| Oct 24-25 | [Boston reschedule](https://pokemongo.com/news/city-safari-boston-rescheduled) | Supersedes [postponement](https://pokemongo.com/news/city-safari-boston-update) and the [old visitor guide](https://pokemongo.com/news/boston-city-safari-know-before-you-go). Existing encounters; explorer-hat Eevee/Boston backgrounds, no stamp rally. No default-species debut. |
| Oct 24 broadcast, 19:30 PDT | [Pokémon Night Out](https://pokemongo.com/news/pokemon-night-out-twitch-drops2026) | Exclusive avatar baseball jersey; not a Pokémon catalog entry. |
| Oct 27, 10:00 local | [Halloween Part I](https://pokemongo.com/news/halloween-part-1-2026) | New hat-and-capelet Pikachu, top-hat Zubat and bow Sinistea, all shiny-capable; gothic avatar items. Future, costume/avatar scope excluded. |
| Oct 31, 14:00 local | [Chandelure Super Mega Raid Day](https://pokemongo.com/news/chandelure-super-mega-raid-day-2026) | Q5's undated Mega Chandelure now has a date, Normal/Shiny and Ominous Wind+. **New future follow-up:** verify form identity/types and prepare a separately approved release on/after Oct 31. Do not add a future entry to today's candidate. Reconcile this before the Nov 1 freshness claim. |
| Nov 1, 10:00 local | [Halloween Part II](https://pokemongo.com/news/halloween-part-2-2026) | Keep scheduled Shiny Greavard; returning Rowlet/Gengar costumes and Mega Sableye Super Max/Night Shade+ do not add supported forms. |
| Nov 1 research; Nov 6-8 event | [Festival of Lights](https://pokemongo.com/news/festival-of-lights-2026) | Returning saree/kurta Pikachu with shiny/background opportunities; no tracked debut. |
| Nov 7-8; stamp described as already live | [Singapore PokéXciting](https://pokemongo.com/news/event-singapore-30th-anniversary-2026) | Blue PokéXciting Pikachu/background. The article mixes a future event with an already-live stamp without an exact stamp start date. Record uncertainty; do not manufacture an obtainable date. |
| Nov 9, 10:00 local | [Into the Wild](https://pokemongo.com/news/into-the-wild-2026) | Dynamax Regidrago and Meltan (shiny-capable), new backgrounds and Silver Bottle Cap reward. Future, unsupported categories/items. |
| Still undated | [Twilight Trails](https://pokemongo.com/seasons/twilight-trails): Dynamax Rhyhorn, Sneasel, Sizzlipede | Rechecked Q5. No exact date or Sneasel regional identity established; no ledger entry. |
| Not established | October Community Day Classic | Rechecked Q7 against [season dates](https://pokemongo.com/news/save-the-date-s24) and news. October 10 ordinary Community Day is listed, not an October Classic. |

The scheduled Greavard branch retains its previously approved single-species scope. Research found an [official 2023 Greavard → Houndstone evolution](https://pokemongo.com/news/halloween-part-1-2023), so the older statement that no official evolution source exists is obsolete. The on-day worker should review adding Shiny Houndstone using the same sourced-evolution policy, explicitly update its test/checklist if the scope is expanded, and never claim it was included in this preparation.

Other index items reviewed: [gameplay/QoL update](https://pokemongo.com/news/pgo-gameplay-update-oct-2026) changes game UX, not availability; [GO Tour 2027 dates](https://pokemongo.com/news/save-the-date-go-tour-2027) and [Sendai ticket update](https://pokemongo.com/news/gowildarea-sendai-ticket-update) are scheduling/ticketing; [Brisbane](https://pokemongo.com/news/city-safari-brisbane-know-before-you-go), [European City Safaris](https://pokemongo.com/news/city-safaris-europe-2026), and [Choose Your Path](https://pokemongo.com/news/choose-your-path-twilight-trails-2026) ended before the interval and reveal no missing in-interval default-species release. Their URLs are included in the manifest.

## Evidence limits

This is a dated official-news review, not a live-game verification or a claim that all past catalog gaps are resolved. Q1's other unverified species, Q2's disputed older Shadows, Q3's earliest Shiny Mr. Rime date and Q4's Toxel regional chronology were not silently approved. Existing species/form IDs, migrations, collection storage and category schema remain unchanged.
