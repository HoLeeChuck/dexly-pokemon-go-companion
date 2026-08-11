import { describe, expect, it } from 'vitest';

import {
  compressDexNumbers,
  deriveCollectionState,
  generateMissingSearchStrings,
  isTradeSearchSupported,
  planSparseCollectionUpdate,
  progressForCategory,
} from '../../shared/domain';
import type { CatalogItem, CategoryId, CollectionEntry, RuleState } from '../../shared/types';

function catalogItem(
  id: string,
  dexNumber: number,
  rules: Partial<Record<CategoryId, RuleState>>,
  overrides: Partial<CatalogItem> = {},
): CatalogItem {
  return {
    id,
    speciesId: `species:${dexNumber}`,
    dexNumber,
    name: `Pokemon ${dexNumber}`,
    formKey: 'standard',
    generation: 1,
    region: 'kanto',
    types: ['normal'],
    isDefault: true,
    searchExact: true,
    rules,
    ...overrides,
  };
}

function entry(formId: string, categoryId: CategoryId): CollectionEntry {
  return { formId, categoryId, collected: true };
}

describe('deriveCollectionState', () => {
  it.each([
    ['released', false, 'missing'],
    ['released', true, 'collected'],
    ['unreleased', false, 'unreleased'],
    ['unreleased', true, 'unreleased'],
    ['ineligible', false, 'ineligible'],
    ['ineligible', true, 'ineligible'],
    ['unknown', false, 'unknown'],
    ['unknown', true, 'unknown'],
  ] as const)('derives %s + %s as %s', (rule, collected, expected) => {
    expect(deriveCollectionState(rule, collected)).toBe(expected);
  });
});

describe('progressForCategory', () => {
  it('counts only released rules in the completion denominator', () => {
    const catalog = [
      catalogItem('one', 1, { shiny: 'released' }),
      catalogItem('two', 2, { shiny: 'released' }),
      catalogItem('three', 3, { shiny: 'unreleased' }),
      catalogItem('four', 4, { shiny: 'ineligible' }),
      catalogItem('five', 5, {}),
    ];

    expect(progressForCategory(catalog, [entry('one', 'shiny')], 'shiny')).toEqual({
      categoryId: 'shiny',
      collected: 1,
      missing: 1,
      total: 2,
      unreleased: 1,
      ineligible: 1,
      unknown: 1,
      percentage: 50,
    });
  });

  it('ignores false and wrong-category entries', () => {
    const catalog = [catalogItem('one', 1, { normal: 'released' })];
    const entries: CollectionEntry[] = [
      { formId: 'one', categoryId: 'normal', collected: false },
      entry('one', 'shiny'),
    ];

    expect(progressForCategory(catalog, entries, 'normal').collected).toBe(0);
  });
});

describe('compressDexNumbers', () => {
  it('sorts, deduplicates, and compresses consecutive values', () => {
    expect(compressDexNumbers([10, 2, 1, 3, 6, 5, 2])).toBe('1-3,5-6,10');
  });

  it('handles empty and singleton input', () => {
    expect(compressDexNumbers([])).toBe('');
    expect(compressDexNumbers([25])).toBe('25');
  });

  it('rejects invalid Pokedex numbers', () => {
    expect(() => compressDexNumbers([0])).toThrow(RangeError);
    expect(() => compressDexNumbers([1.5])).toThrow(RangeError);
  });
});

describe('generateMissingSearchStrings', () => {
  it.each([
    ['normal', '1-3'],
    ['shiny', 'shiny&1-3'],
    ['lucky', 'lucky&1-3'],
    ['hundo', '4*&1-3'],
    ['xxl', 'xxl&1-3'],
    ['xxs', 'xxs&1-3'],
    ['shadow', 'shadow&1-3'],
    ['purified', 'purified&1-3'],
  ] as const)('uses the Pokemon GO keyword for %s', (categoryId, expected) => {
    const catalog = [1, 2, 3].map((dexNumber) =>
      catalogItem(String(dexNumber), dexNumber, {
        [categoryId]: 'released',
      }),
    );

    expect(generateMissingSearchStrings(catalog, [], categoryId).strings).toEqual([expected]);
  });

  it('excludes collected, unreleased, ineligible, and unknown records', () => {
    const catalog = [
      catalogItem('one', 1, { shiny: 'released' }),
      catalogItem('two', 2, { shiny: 'released' }),
      catalogItem('three', 3, { shiny: 'unreleased' }),
      catalogItem('four', 4, { shiny: 'ineligible' }),
      catalogItem('five', 5, {}),
    ];

    const result = generateMissingSearchStrings(catalog, [entry('one', 'shiny')], 'shiny');

    expect(result.dexNumbers).toEqual([2]);
    expect(result.strings).toEqual(['shiny&2']);
    expect(result.quality).toBe('exact');
  });

  it('splits without exceeding the requested length', () => {
    const catalog = [1, 3, 5, 7, 9, 11].map((dexNumber) =>
      catalogItem(String(dexNumber), dexNumber, { shiny: 'released' }),
    );

    const result = generateMissingSearchStrings(catalog, [], 'shiny', {
      maxLength: 11,
    });

    expect(result.strings.length).toBeGreaterThan(1);
    expect(result.strings.every((value) => value.length <= 11)).toBe(true);
    expect(result.strings.every((value) => value.startsWith('shiny&'))).toBe(true);
  });

  it('labels form-limited and duplicate-dex searches as candidates', () => {
    const catalog = [
      catalogItem('standard', 25, { shiny: 'released' }),
      catalogItem(
        'costume',
        25,
        { shiny: 'released' },
        { formKey: 'costume', isDefault: false, searchExact: false },
      ),
    ];

    const result = generateMissingSearchStrings(catalog, [], 'shiny');
    expect(result.strings).toEqual(['shiny&25']);
    expect(result.quality).toBe('candidate');
    expect(result.explanation).toContain('cannot distinguish');
  });

  it('returns no strings when nothing trackable is missing', () => {
    const catalog = [catalogItem('one', 1, { shiny: 'released' })];
    const result = generateMissingSearchStrings(catalog, [entry('one', 'shiny')], 'shiny');

    expect(result.strings).toEqual([]);
    expect(result.explanation).toContain('No released');
  });

  it('rejects a maximum too small for one term', () => {
    const catalog = [catalogItem('one', 999, { purified: 'released' })];
    expect(() => generateMissingSearchStrings(catalog, [], 'purified', { maxLength: 5 })).toThrow(
      RangeError,
    );
  });
});

describe('trade and sparse-update rules', () => {
  it.each(['hundo', 'lucky', 'shadow'] as const)(
    'does not promise %s through a trade search',
    (categoryId) => {
      expect(isTradeSearchSupported(categoryId)).toBe(false);
    },
  );

  it.each(['normal', 'shiny', 'xxl', 'xxs', 'purified'] as const)(
    'allows %s as a trade-search narrowing category',
    (categoryId) => {
      expect(isTradeSearchSupported(categoryId)).toBe(true);
    },
  );

  it('plans insert, delete, and no-op sparse writes', () => {
    expect(planSparseCollectionUpdate(undefined, true)).toEqual({
      action: 'insert',
      before: false,
      after: true,
    });
    expect(planSparseCollectionUpdate(true, false)).toEqual({
      action: 'delete',
      before: true,
      after: false,
    });
    expect(planSparseCollectionUpdate(false, false).action).toBe('noop');
  });
});
