import type { CatalogItem, CategoryId, CollectionEntry, CollectionState, RuleState } from './types';

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

const TRADE_UNSUPPORTED_CATEGORIES = new Set<CategoryId>(['hundo', 'lucky', 'shadow']);

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

function withCategoryKeyword(categoryId: CategoryId, body: string): string {
  const keyword = CATEGORY_SEARCH_KEYWORDS[categoryId];
  return keyword === null ? body : `${keyword}&${body}`;
}

function chunkDexNumbers(
  numbers: readonly number[],
  categoryId: CategoryId,
  maxLength: number,
): string[] {
  const chunks: string[] = [];
  let current: number[] = [];

  for (const dexNumber of numbers) {
    const candidate = [...current, dexNumber];
    const candidateString = withCategoryKeyword(categoryId, compressDexNumbers(candidate));

    if (candidateString.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current.length === 0) {
      throw new RangeError(`maxLength ${maxLength} cannot contain Pokedex number ${dexNumber}`);
    }

    chunks.push(withCategoryKeyword(categoryId, compressDexNumbers(current)));
    current = [dexNumber];

    const single = withCategoryKeyword(categoryId, compressDexNumbers(current));
    if (single.length > maxLength) {
      throw new RangeError(`maxLength ${maxLength} cannot contain Pokedex number ${dexNumber}`);
    }
  }

  if (current.length > 0) {
    chunks.push(withCategoryKeyword(categoryId, compressDexNumbers(current)));
  }

  return chunks;
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

export function isTradeSearchSupported(categoryId: CategoryId): boolean {
  return !TRADE_UNSUPPORTED_CATEGORIES.has(categoryId);
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
