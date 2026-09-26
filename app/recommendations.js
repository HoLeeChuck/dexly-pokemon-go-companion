// Cody's saved searches and Discord output, ported from the retired /advanced/ Search Lab.
// Strings, order and wording are preserved exactly; only the presentation moved.
import {
  formatMissingSearchString,
  generateMissingSearchStrings,
  generatePersonalSizeCatchSearchStrings,
} from '../shared/domain';
import {
  buildDiscordMessages,
  NITRO_DISCORD_MESSAGE_LIMIT,
  STANDARD_DISCORD_MESSAGE_LIMIT,
} from '../src/lib/discordShare';
import evolutions from '../catalog/evolution-families.v1.json';

export const DISCORD_CATEGORIES = [
  ['normal', 'Normal'],
  ['shiny', 'Shiny'],
  ['xxl', 'XXL'],
  ['xxs', 'XXS'],
];

const sizeSearch = (species, entries, category) =>
  generatePersonalSizeCatchSearchStrings(species, entries, category, {
    maxLength: 4_500,
    evolutionFamilies: evolutions.families,
  });

/** The eight recommendations, in the required order: Trade, Megas, Tag, Evolve, Special Moves, Untagged, XXL, XXS. */
export function recommendations(species, entries) {
  const xxl = sizeSearch(species, entries, 'xxl');
  const xxs = sizeSearch(species, entries, 'xxs');
  return [
    {
      id: 'trade',
      name: 'Trade',
      description:
        'Quickly open Pokémon you have tagged for trading. The trailing & lets you immediately append another Pokémon GO search term, for example #trade&pikachu.',
      help: '“trade” is Cody’s tag name, not a requirement. Replace it with any trade-storage tag you use, such as “adoption”.',
      values: ['#trade&'],
    },
    {
      id: 'megas',
      name: 'Megas',
      description:
        'Show Mega Level 2–3 Pokémon you deliberately keep in your active Mega rotation. Newer Super Mega Raid catches may already have Mega Level 1 unlocked, so the #max tag keeps those extra results from cluttering the rotation.',
      help: '“max” is Cody’s tag name and can be replaced. Avoid naming the custom tag “mega” because Pokémon GO already uses mega in its built-in search syntax.',
      values: ['#max&mega2-3&'],
    },
    {
      id: 'tag',
      name: 'Tag',
      description:
        'Review untagged Pokémon that may be valuable or unusual: 4-star, shiny, costume, background, 20 km buddy-distance, Dynamax, Gigantamax, or lucky.',
      help: 'Use this as an organization pass; the trailing & leaves room for another condition.',
      values: ['!#&4*,shiny,costume,background,candykm20,dynamax,gigantamax,lucky&'],
    },
    {
      id: 'evolve',
      name: 'Evolve',
      description:
        'Find untagged Pokémon that can evolve into a Pokédex entry you have not registered yet.',
      values: ['!#&evolvenew&'],
    },
    {
      id: 'special-moves',
      name: 'Special Moves',
      description:
        'Find untagged Pokémon with Frustration, Return, or special/legacy move results worth reviewing before transferring or organizing.',
      values: ['!#&@frustration,@return,@special&'],
    },
    {
      id: 'untagged',
      name: 'Untagged',
      description:
        'Find Pokémon with no tag assigned. The trailing & lets you add another filter, for example !#&kanto.',
      values: ['!#&'],
    },
    {
      id: 'xxl',
      name: 'XXL',
      description:
        'Find untagged XXL Pokémon that could fill missing XXL collection entries, including useful earlier stages that can evolve into a missing entry.',
      help: `${xxl.missingDexNumbers.length} released XXL collection entries are currently missing. This search updates with your CatchGrid collection.`,
      values: xxl.strings.map((value) => formatMissingSearchString(value, 'personal')),
      emptyMessage: 'No released XXL collection entries are currently missing.',
    },
    {
      id: 'xxs',
      name: 'XXS',
      description:
        'Find untagged XXS Pokémon that could fill missing XXS collection entries, including useful earlier stages that can evolve into a missing entry.',
      help: `${xxs.missingDexNumbers.length} released XXS collection entries are currently missing. This search updates with your CatchGrid collection.`,
      values: xxs.strings.map((value) => formatMissingSearchString(value, 'personal')),
      emptyMessage: 'No released XXS collection entries are currently missing.',
    },
  ];
}

/** Discord-ready messages, split safely for standard (2,000) or Nitro (4,000) limits. */
export function discordMessages(
  species,
  entries,
  { nitro = false, categories, evolveSizes = false },
) {
  const limit = nitro ? NITRO_DISCORD_MESSAGE_LIMIT : STANDARD_DISCORD_MESSAGE_LIMIT;
  const maxLength = limit - 500;
  const sections = DISCORD_CATEGORIES.filter(([id]) => categories.has(id)).map(([id, label]) => {
    const size = id === 'xxl' || id === 'xxs';
    const result =
      evolveSizes && size
        ? generatePersonalSizeCatchSearchStrings(species, entries, id, {
            maxLength,
            evolutionFamilies: evolutions.families,
          })
        : generateMissingSearchStrings(species, entries, id, { maxLength });
    return { label, strings: result.strings };
  });
  return buildDiscordMessages(sections, { maxLength: limit });
}
