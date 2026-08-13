export const SEARCH_RESOURCE_VERSION = '2026-08-13.1';
export const SEARCH_RESOURCE_UPDATED_AT = '2026-08-13';
export const SEARCH_RESOURCE_SOURCE =
  'https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/1486-searching-filtering-your-pokemon-inventory/';

export type SearchQuality = 'exact' | 'compressed' | 'candidate';
export type SearchJoin = 'and' | 'or';
export type SearchValueKind = 'none' | 'text' | 'number-or-range' | 'choice';

export interface SearchTermDefinition {
  id: string;
  label: string;
  group: 'Pokemon' | 'Collection' | 'Appraisal' | 'Time' | 'Evolution' | 'Tags';
  token: string;
  valueKind: SearchValueKind;
  placeholder?: string;
  choices?: readonly { label: string; value: string }[];
  description: string;
  quality: SearchQuality;
}

export interface SearchClause {
  id: string;
  termId: string;
  value: string;
  excluded: boolean;
}

export interface BuiltSearch {
  query: string;
  interpretation: string;
  quality: SearchQuality;
  valid: boolean;
  warnings: readonly string[];
}

export const SEARCH_TERMS: readonly SearchTermDefinition[] = [
  {
    id: 'species',
    label: 'Species or Dex range',
    group: 'Pokemon',
    token: '',
    valueKind: 'number-or-range',
    placeholder: '25 or 1-151',
    description: 'Matches a National Pokédex number or inclusive range.',
    quality: 'exact',
  },
  {
    id: 'type',
    label: 'Pokémon type',
    group: 'Pokemon',
    token: '',
    valueKind: 'text',
    placeholder: 'grass',
    description: 'Matches Pokémon with the entered type.',
    quality: 'exact',
  },
  {
    id: 'category',
    label: 'Collection category',
    group: 'Collection',
    token: '',
    valueKind: 'choice',
    choices: [
      { label: 'Shiny', value: 'shiny' },
      { label: 'Lucky', value: 'lucky' },
      { label: 'Shadow', value: 'shadow' },
      { label: 'Purified', value: 'purified' },
      { label: 'Costume', value: 'costume' },
      { label: 'Dynamax', value: 'dynamax' },
      { label: 'Gigantamax', value: 'gigantamax' },
      { label: 'Fusion', value: 'fusion' },
      { label: 'Legendary', value: 'legendary' },
      { label: 'Mythical', value: 'mythical' },
    ],
    description: 'Matches a supported Pokémon GO collection status.',
    quality: 'exact',
  },
  {
    id: 'size',
    label: 'Size',
    group: 'Collection',
    token: '',
    valueKind: 'choice',
    choices: [
      { label: 'XXL', value: 'xxl' },
      { label: 'XL', value: 'xl' },
      { label: 'XXS', value: 'xxs' },
      { label: 'XS', value: 'xs' },
    ],
    description: 'Matches Pokémon in the selected size category.',
    quality: 'exact',
  },
  {
    id: 'appraisal',
    label: 'Appraisal',
    group: 'Appraisal',
    token: '',
    valueKind: 'choice',
    choices: [
      { label: '0★', value: '0*' },
      { label: '1★', value: '1*' },
      { label: '2★', value: '2*' },
      { label: '3★', value: '3*' },
      { label: '4★ / perfect', value: '4*' },
    ],
    description: 'Matches the selected appraisal band.',
    quality: 'exact',
  },
  {
    id: 'age',
    label: 'Age in days',
    group: 'Time',
    token: 'age',
    valueKind: 'number-or-range',
    placeholder: '0 or 0-7',
    description: 'Matches Pokémon caught during the entered age window.',
    quality: 'exact',
  },
  {
    id: 'year',
    label: 'Caught year',
    group: 'Time',
    token: 'year',
    valueKind: 'number-or-range',
    placeholder: '2026',
    description: 'Matches Pokémon acquired in the entered year.',
    quality: 'exact',
  },
  {
    id: 'evolution',
    label: 'Evolution status',
    group: 'Evolution',
    token: '',
    valueKind: 'choice',
    choices: [
      { label: 'Can evolve now', value: 'evolve' },
      { label: 'New Dex evolution', value: 'evolvenew' },
      { label: 'Item evolution', value: 'item' },
      { label: 'Quest evolution', value: 'evolvequest' },
      { label: 'Trade evolution', value: 'tradeevolve' },
      { label: 'Mega/Primal eligible now', value: 'megaevolve' },
    ],
    description: 'Matches the selected evolution state.',
    quality: 'candidate',
  },
  {
    id: 'family',
    label: 'Evolution family',
    group: 'Evolution',
    token: '+',
    valueKind: 'text',
    placeholder: 'Pikachu',
    description: 'Matches an evolution family when that family has been caught before.',
    quality: 'candidate',
  },
  {
    id: 'tag',
    label: 'Tag',
    group: 'Tags',
    token: '#',
    valueKind: 'text',
    placeholder: 'great-league',
    description: 'Matches the exact Pokémon GO tag name.',
    quality: 'exact',
  },
] as const;

const RANGE_PATTERN = /^\d+(?:-\d*)?$/;
const YEAR_PATTERN = /^20\d{2}(?:-20\d{2})?$/;
const SAFE_TEXT_PATTERN = /^[\p{L}\p{N} .'-]+$/u;

function qualityRank(value: SearchQuality): number {
  return value === 'candidate' ? 2 : value === 'compressed' ? 1 : 0;
}

function termById(id: string): SearchTermDefinition | undefined {
  return SEARCH_TERMS.find((term) => term.id === id);
}

function renderClause(clause: SearchClause): { token?: string; warning?: string } {
  const definition = termById(clause.termId);
  if (!definition) return { warning: 'Choose a supported search term.' };
  const raw = clause.value.trim();
  if (definition.valueKind !== 'none' && !raw) {
    return { warning: `${definition.label} needs a value.` };
  }
  if (
    definition.valueKind === 'choice' &&
    !definition.choices?.some(({ value }) => value === raw)
  ) {
    return { warning: `Choose a valid ${definition.label.toLowerCase()} value.` };
  }
  if (definition.valueKind === 'number-or-range') {
    const pattern = definition.id === 'year' ? YEAR_PATTERN : RANGE_PATTERN;
    if (!pattern.test(raw)) return { warning: `${definition.label} must be a number or range.` };
  }
  if (definition.valueKind === 'text' && !SAFE_TEXT_PATTERN.test(raw)) {
    return { warning: `${definition.label} contains unsupported punctuation.` };
  }
  const token = `${definition.token}${raw}`;
  return { token: clause.excluded ? `!${token}` : token };
}

export function buildPokemonGoSearch(
  clauses: readonly SearchClause[],
  join: SearchJoin,
): BuiltSearch {
  const rendered = clauses.map(renderClause);
  const warnings = rendered.flatMap((entry) => (entry.warning ? [entry.warning] : []));
  const terms = rendered.flatMap((entry) => (entry.token ? [entry.token] : []));
  const definitions = clauses
    .map((clause) => termById(clause.termId))
    .filter((value): value is SearchTermDefinition => Boolean(value));
  const quality = definitions.reduce<SearchQuality>(
    (highest, definition) =>
      qualityRank(definition.quality) > qualityRank(highest) ? definition.quality : highest,
    'exact',
  );
  const separator = join === 'and' ? '&' : ',!traded&';
  const query = terms.length ? `!traded&${terms.join(separator)}` : '!traded&';
  const phrases = clauses.flatMap((clause, index) => {
    const definition = termById(clause.termId);
    const renderedClause = rendered[index];
    if (!definition || !renderedClause?.token) return [];
    return [
      `${clause.excluded ? 'exclude' : 'include'} ${definition.label.toLowerCase()} “${clause.value.trim()}”`,
    ];
  });
  return {
    query,
    interpretation: phrases.length
      ? `Show untraded Pokémon that ${phrases.join(join === 'and' ? ' and ' : ' or ')}.`
      : 'Add at least one condition to build a search.',
    quality,
    valid: warnings.length === 0 && terms.length > 0,
    warnings,
  };
}
