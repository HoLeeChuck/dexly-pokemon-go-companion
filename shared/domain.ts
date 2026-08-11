import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  CollectionState,
  RuleState,
  TradeRequestTrait,
  WantedEntry,
} from './types';

export interface CategoryProgress {
  categoryId: CategoryId;
  collected: number;
  missing: number;
  total: number;
  unreleased: number;
  ineligible: number;
  unknown: number;
  percentage: number;
}

export type SearchQuality = 'exact' | 'candidate';

export interface GeneratedSearchStrings {
  strings: readonly string[];
  dexNumbers: readonly number[];
  quality: SearchQuality;
  explanation: string;
}

export interface MissingSearchOptions {
  maxLength?: number;
}

const TRADE_REQUEST_SEARCH_KEYWORDS: Readonly<Record<TradeRequestTrait, string | null>> = {
  normal: null,
  shiny: 'shiny',
  xxl: 'xxl',
  xxs: 'xxs',
  costume: 'costume',
};

const UNTRADED_SEARCH_TERM = '!traded';

export const MISSING_SEARCH_CATEGORY_IDS = ['normal', 'shiny', 'xxl', 'xxs'] as const;

export type MissingSearchCategoryId = (typeof MISSING_SEARCH_CATEGORY_IDS)[number];
export type SizeCategoryId = Extract<MissingSearchCategoryId, 'xxl' | 'xxs'>;

/**
 * Maps a Pokedex number to catch candidates that can satisfy that size goal after evolution.
 * Dexly's bundled mapping contains the target and its earlier stages. Missing or empty entries
 * deliberately fall back to the requested Pokemon itself.
 */
export type EvolutionFamilyMap =
  ReadonlyMap<number, readonly number[]> | Readonly<Record<number, readonly number[]>>;

export interface PersonalSizeSearchOptions extends MissingSearchOptions {
  evolutionFamilies?: EvolutionFamilyMap;
}

export interface GeneratedPersonalSizeSearchStrings extends GeneratedSearchStrings {
  /** The actual collection gaps, before catch candidates from an evolution family are added. */
  missingDexNumbers: readonly number[];
}

export type SparseCollectionAction = 'insert' | 'delete' | 'noop';

export interface SparseCollectionUpdatePlan {
  action: SparseCollectionAction;
  before: boolean;
  after: boolean;
}

const CATEGORY_SEARCH_KEYWORDS: Readonly<Record<CategoryId, string | null>> = {
  normal: null,
  shiny: 'shiny',
  lucky: 'lucky',
  hundo: '4*',
  xxl: 'xxl',
  xxs: 'xxs',
  shadow: 'shadow',
  purified: 'purified',
};

const MISSING_SEARCH_CATEGORIES = new Set<CategoryId>(MISSING_SEARCH_CATEGORY_IDS);

function collectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}\u0000${categoryId}`;
}

function collectedEntryKeys(entries: readonly CollectionEntry[]): Set<string> {
  return new Set(
    entries
      .filter((entry) => entry.collected)
      .map((entry) => collectionKey(entry.formId, entry.categoryId)),
  );
}

export function deriveCollectionState(rule: RuleState, collected: boolean): CollectionState {
  if (rule !== 'released') {
    return rule;
  }

  return collected ? 'collected' : 'missing';
}

export function progressForCategory(
  catalog: readonly CatalogItem[],
  entries: readonly CollectionEntry[],
  categoryId: CategoryId,
): CategoryProgress {
  const collectedKeys = collectedEntryKeys(entries);
  const progress: CategoryProgress = {
    categoryId,
    collected: 0,
    missing: 0,
    total: 0,
    unreleased: 0,
    ineligible: 0,
    unknown: 0,
    percentage: 0,
  };

  for (const item of catalog) {
    const rule = item.rules[categoryId] ?? 'unknown';
    const state = deriveCollectionState(
      rule,
      collectedKeys.has(collectionKey(item.id, categoryId)),
    );

    if (state === 'collected' || state === 'missing') {
      progress.total += 1;
      progress[state] += 1;
    } else {
      progress[state] += 1;
    }
  }

  progress.percentage =
    progress.total === 0 ? 0 : Math.round((progress.collected / progress.total) * 100);

  return progress;
}

function sortedUniqueDexNumbers(numbers: readonly number[]): number[] {
  const unique = new Set<number>();

  for (const value of numbers) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`Invalid Pokedex number: ${String(value)}`);
    }
    unique.add(value);
  }

  return [...unique].sort((left, right) => left - right);
}

export function compressDexNumbers(numbers: readonly number[]): string {
  const sorted = sortedUniqueDexNumbers(numbers);
  const ranges: string[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    if (start === undefined) {
      continue;
    }

    let end = start;
    while (sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index] ?? end;
    }

    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }

  return ranges.join(',');
}

function searchPrefix(keyword: string | null): string {
  return keyword === null ? `${UNTRADED_SEARCH_TERM}&` : `${UNTRADED_SEARCH_TERM}&${keyword}&`;
}

function chunkDexNumbersWithPrefix(
  numbers: readonly number[],
  prefix: string,
  maxLength: number,
): string[] {
  const chunks: string[] = [];
  let current: number[] = [];

  for (const dexNumber of numbers) {
    const candidate = [...current, dexNumber];
    const candidateString = `${prefix}${compressDexNumbers(candidate)}`;

    if (candidateString.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current.length === 0) {
      throw new RangeError(`maxLength ${maxLength} cannot contain Pokedex number ${dexNumber}`);
    }

    chunks.push(`${prefix}${compressDexNumbers(current)}`);
    current = [dexNumber];

    const single = `${prefix}${compressDexNumbers(current)}`;
    if (single.length > maxLength) {
      throw new RangeError(`maxLength ${maxLength} cannot contain Pokedex number ${dexNumber}`);
    }
  }

  if (current.length > 0) {
    chunks.push(`${prefix}${compressDexNumbers(current)}`);
  }

  return chunks;
}

function chunkDexNumbers(
  numbers: readonly number[],
  categoryId: CategoryId,
  maxLength: number,
): string[] {
  return chunkDexNumbersWithPrefix(
    numbers,
    searchPrefix(CATEGORY_SEARCH_KEYWORDS[categoryId]),
    maxLength,
  );
}

export function generateWantedTradeSearchStrings(
  catalog: readonly CatalogItem[],
  wantedEntries: readonly WantedEntry[],
  traitId: TradeRequestTrait,
  options: MissingSearchOptions = {},
): GeneratedSearchStrings {
  const maxLength = options.maxLength ?? 250;
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    throw new RangeError('maxLength must be a positive integer');
  }

  const wantedIds = new Set(
    wantedEntries
      .filter((entry) => entry.wanted && entry.categoryId === traitId)
      .map((entry) => entry.formId),
  );
  const targets = catalog.filter((item) => wantedIds.has(item.id));
  const dexNumbers = sortedUniqueDexNumbers(targets.map((item) => item.dexNumber));
  const keyword = TRADE_REQUEST_SEARCH_KEYWORDS[traitId];
  const prefix = searchPrefix(keyword);
  const quality: SearchQuality =
    traitId === 'costume' ||
    targets.some((item) => !item.searchExact) ||
    dexNumbers.length < targets.length
      ? 'candidate'
      : 'exact';

  return {
    strings: chunkDexNumbersWithPrefix(dexNumbers, prefix, maxLength),
    dexNumbers,
    quality,
    explanation:
      traitId === 'costume'
        ? 'Finds costume candidates for requested species; review the exact costume visually.'
        : `Matches the ${traitId} species on your active trade wanted list.`,
  };
}

export function generateMissingSearchStrings(
  catalog: readonly CatalogItem[],
  entries: readonly CollectionEntry[],
  categoryId: CategoryId,
  options: MissingSearchOptions = {},
): GeneratedSearchStrings {
  const maxLength = options.maxLength ?? 250;
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    throw new RangeError('maxLength must be a positive integer');
  }

  if (!isMissingSearchSupported(categoryId)) {
    return {
      strings: [],
      dexNumbers: [],
      quality: 'exact',
      explanation: `${categoryId} is not supported by trade-oriented missing searches. Choose normal, shiny, XXL, or XXS.`,
    };
  }

  const collectedKeys = collectedEntryKeys(entries);
  const missingItems = catalog.filter(
    (item) =>
      (item.rules[categoryId] ?? 'unknown') === 'released' &&
      !collectedKeys.has(collectionKey(item.id, categoryId)),
  );
  const dexNumbers = sortedUniqueDexNumbers(missingItems.map((item) => item.dexNumber));
  const hasDuplicateDexTargets =
    dexNumbers.length < missingItems.map((item) => item.dexNumber).length;
  const quality: SearchQuality =
    missingItems.some((item) => !item.searchExact) || hasDuplicateDexTargets
      ? 'candidate'
      : 'exact';

  if (dexNumbers.length === 0) {
    return {
      strings: [],
      dexNumbers,
      quality: 'exact',
      explanation: `No released, eligible ${categoryId} entries are currently missing.`,
    };
  }

  const strings = chunkDexNumbers(dexNumbers, categoryId, maxLength);
  const explanation =
    quality === 'exact'
      ? `Matches the released ${categoryId} Pokedex entries currently marked missing.`
      : `Narrows results to candidate ${categoryId} Pokemon; Pokemon GO search cannot distinguish every requested form or costume exactly.`;

  return { strings, dexNumbers, quality, explanation };
}

export function isMissingSearchSupported(
  categoryId: CategoryId,
): categoryId is MissingSearchCategoryId {
  return MISSING_SEARCH_CATEGORIES.has(categoryId);
}

export function isTradeSearchSupported(
  categoryId: CategoryId,
): categoryId is MissingSearchCategoryId {
  return isMissingSearchSupported(categoryId);
}

function evolutionFamilyForDexNumber(
  evolutionFamilies: EvolutionFamilyMap | undefined,
  dexNumber: number,
): readonly number[] | undefined {
  if (evolutionFamilies === undefined) {
    return undefined;
  }

  if ('get' in evolutionFamilies && typeof evolutionFamilies.get === 'function') {
    return evolutionFamilies.get(dexNumber);
  }

  return (evolutionFamilies as Readonly<Record<number, readonly number[]>>)[dexNumber];
}

export function generatePersonalSizeCatchSearchStrings(
  catalog: readonly CatalogItem[],
  entries: readonly CollectionEntry[],
  categoryId: SizeCategoryId,
  options: PersonalSizeSearchOptions = {},
): GeneratedPersonalSizeSearchStrings {
  const base = generateMissingSearchStrings(catalog, entries, categoryId, options);
  const missingDexNumbers = base.dexNumbers;

  if (missingDexNumbers.length === 0) {
    return { ...base, missingDexNumbers };
  }

  const eligibleDexNumbers = new Set(
    catalog
      .filter((item) => (item.rules[categoryId] ?? 'unknown') === 'released')
      .map((item) => item.dexNumber),
  );
  const catchCandidates = new Set<number>();

  for (const missingDexNumber of missingDexNumbers) {
    // Always retain the real missing target. A partial or stale mapping must not hide it.
    catchCandidates.add(missingDexNumber);

    const family = evolutionFamilyForDexNumber(options.evolutionFamilies, missingDexNumber);
    if (family === undefined || family.length === 0) {
      continue;
    }

    for (const familyDexNumber of family) {
      if (Number.isSafeInteger(familyDexNumber) && eligibleDexNumbers.has(familyDexNumber)) {
        catchCandidates.add(familyDexNumber);
      }
    }
  }

  const dexNumbers = sortedUniqueDexNumbers([...catchCandidates]);
  const includesFamilyCatchCandidates = dexNumbers.some(
    (dexNumber) => !missingDexNumbers.includes(dexNumber),
  );
  const quality: SearchQuality =
    base.quality === 'candidate' || includesFamilyCatchCandidates ? 'candidate' : 'exact';
  const maxLength = options.maxLength ?? 250;
  const strings = chunkDexNumbers(dexNumbers, categoryId, maxLength);
  const explanation = includesFamilyCatchCandidates
    ? `Includes earlier evolution-family catches that can evolve into a later stage still missing in ${categoryId.toUpperCase()}.`
    : base.explanation;

  return { strings, dexNumbers, missingDexNumbers, quality, explanation };
}

export function planSparseCollectionUpdate(
  current: CollectionEntry | boolean | null | undefined,
  desiredCollected: boolean,
): SparseCollectionUpdatePlan {
  const before = typeof current === 'boolean' ? current : Boolean(current?.collected);

  if (before === desiredCollected) {
    return { action: 'noop', before, after: desiredCollected };
  }

  return {
    action: desiredCollected ? 'insert' : 'delete',
    before,
    after: desiredCollected,
  };
}
