import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  compressDexNumbers,
  deriveCollectionState,
  generateMissingSearchStrings,
  generatePersonalSizeCatchSearchStrings,
  generateWantedTradeSearchStrings,
  isMissingSearchSupported,
  isTradeSearchSupported,
  planSparseCollectionUpdate,
  progressForCategory,
} from '../../shared/domain';
import { TRADE_OFFER_TRAIT_IDS, TRADE_REQUEST_TRAIT_IDS } from '../../shared/types';
import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  RuleState,
  TradeOfferTrait,
  TradeRequestTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';

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
    ['normal', '!traded&1-3'],
    ['shiny', '!traded&shiny&1-3'],
    ['xxl', '!traded&xxl&1-3'],
    ['xxs', '!traded&xxs&1-3'],
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
    expect(result.strings).toEqual(['!traded&shiny&2']);
    expect(result.quality).toBe('exact');
  });

  it('splits without exceeding the requested length', () => {
    const catalog = [1, 3, 5, 7, 9, 11].map((dexNumber) =>
      catalogItem(String(dexNumber), dexNumber, { shiny: 'released' }),
    );

    const result = generateMissingSearchStrings(catalog, [], 'shiny', {
      maxLength: 18,
    });

    expect(result.strings.length).toBeGreaterThan(1);
    expect(result.strings.every((value) => value.length <= 18)).toBe(true);
    expect(result.strings.every((value) => value.startsWith('!traded&shiny&'))).toBe(true);
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
    expect(result.strings).toEqual(['!traded&shiny&25']);
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
    const catalog = [catalogItem('one', 999, { xxl: 'released' })];
    expect(() => generateMissingSearchStrings(catalog, [], 'xxl', { maxLength: 5 })).toThrow(
      RangeError,
    );
  });

  it.each(['lucky', 'hundo', 'shadow', 'purified'] as const)(
    'does not generate a trade-oriented missing string for %s',
    (categoryId) => {
      const catalog = [catalogItem('one', 1, { [categoryId]: 'released' })];
      const result = generateMissingSearchStrings(catalog, [], categoryId);

      expect(result.strings).toEqual([]);
      expect(result.dexNumbers).toEqual([]);
      expect(result.explanation).toContain('not supported');
    },
  );
});

describe('trade and sparse-update rules', () => {
  it.each(['hundo', 'lucky', 'shadow', 'purified'] as const)(
    'does not promise %s through a trade search',
    (categoryId) => {
      expect(isTradeSearchSupported(categoryId)).toBe(false);
      expect(isMissingSearchSupported(categoryId)).toBe(false);
    },
  );

  it.each(['normal', 'shiny', 'xxl', 'xxs'] as const)(
    'allows %s as a trade-search narrowing category',
    (categoryId) => {
      expect(isTradeSearchSupported(categoryId)).toBe(true);
      expect(isMissingSearchSupported(categoryId)).toBe(true);
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

describe('trade trait allowlists', () => {
  it('keeps request and offer traits distinct and strongly typed', () => {
    expect(TRADE_REQUEST_TRAIT_IDS).toEqual(['normal', 'shiny', 'xxl', 'xxs', 'costume']);
    expect(TRADE_OFFER_TRAIT_IDS).toEqual(['shiny', 'xxl', 'xxs', 'costume']);

    expectTypeOf<(typeof TRADE_REQUEST_TRAIT_IDS)[number]>().toEqualTypeOf<TradeRequestTrait>();
    expectTypeOf<(typeof TRADE_OFFER_TRAIT_IDS)[number]>().toEqualTypeOf<TradeOfferTrait>();
    expectTypeOf<NonNullable<WantedEntry['categoryId']>>().toEqualTypeOf<TradeRequestTrait>();
    expectTypeOf<TradeSpecimen['traits'][number]>().toEqualTypeOf<TradeOfferTrait>();
  });
});

describe('generatePersonalSizeCatchSearchStrings', () => {
  const bulbasaurFamily = [
    catalogItem('bulbasaur', 1, { xxl: 'released', xxs: 'released' }),
    catalogItem('ivysaur', 2, { xxl: 'released', xxs: 'released' }),
    catalogItem('venusaur', 3, { xxl: 'released', xxs: 'released' }),
  ];

  it('keeps an already-collected earlier stage when an evolution is still missing', () => {
    const result = generatePersonalSizeCatchSearchStrings(
      bulbasaurFamily,
      [entry('bulbasaur', 'xxs')],
      'xxs',
      {
        evolutionFamilies: {
          1: [1, 2, 3],
          2: [1, 2, 3],
          3: [1, 2, 3],
        },
      },
    );

    expect(result.missingDexNumbers).toEqual([2, 3]);
    expect(result.dexNumbers).toEqual([1, 2, 3]);
    expect(result.strings).toEqual(['!traded&xxs&1-3']);
    expect(result.quality).toBe('candidate');
    expect(result.explanation).toContain('evolution-family catches');
  });

  it('supports ReadonlyMap family data', () => {
    const result = generatePersonalSizeCatchSearchStrings(
      bulbasaurFamily,
      [entry('bulbasaur', 'xxl'), entry('ivysaur', 'xxl')],
      'xxl',
      {
        evolutionFamilies: new Map([[3, [1, 2, 3]]]),
      },
    );

    expect(result.missingDexNumbers).toEqual([3]);
    expect(result.strings).toEqual(['!traded&xxl&1-3']);
  });

  it('falls back to actual missing species when no family metadata exists', () => {
    const result = generatePersonalSizeCatchSearchStrings(
      bulbasaurFamily,
      [entry('bulbasaur', 'xxl'), entry('venusaur', 'xxl')],
      'xxl',
    );

    expect(result.missingDexNumbers).toEqual([2]);
    expect(result.dexNumbers).toEqual([2]);
    expect(result.strings).toEqual(['!traded&xxl&2']);
    expect(result.quality).toBe('exact');
  });

  it('ignores invalid, unknown, and ineligible family candidates without hiding the target', () => {
    const catalog = [...bulbasaurFamily, catalogItem('unreleased', 4, { xxs: 'unreleased' })];
    const result = generatePersonalSizeCatchSearchStrings(
      catalog,
      [entry('bulbasaur', 'xxs'), entry('ivysaur', 'xxs')],
      'xxs',
      {
        evolutionFamilies: { 3: [0, 1.5, 4, 999] },
      },
    );

    expect(result.missingDexNumbers).toEqual([3]);
    expect(result.dexNumbers).toEqual([3]);
    expect(result.strings).toEqual(['!traded&xxs&3']);
  });

  it('preserves prefixed max-length chunking for family catch candidates', () => {
    const catalog = [1, 3, 5, 7, 9, 11].map((dexNumber) =>
      catalogItem(String(dexNumber), dexNumber, { xxl: 'released' }),
    );
    const result = generatePersonalSizeCatchSearchStrings(catalog, [], 'xxl', {
      maxLength: 16,
      evolutionFamilies: { 11: [1, 3, 5, 7, 9, 11] },
    });

    expect(result.strings.length).toBeGreaterThan(1);
    expect(result.strings.every((value) => value.length <= 16)).toBe(true);
    expect(result.strings.every((value) => value.startsWith('!traded&xxl&'))).toBe(true);
  });
});

describe('generateWantedTradeSearchStrings', () => {
  const catalog = [
    catalogItem('bulbasaur', 1, { normal: 'released', shiny: 'released' }),
    catalogItem('ivysaur', 2, { normal: 'released', shiny: 'released' }),
  ];

  it.each([
    ['normal', '!traded&2'],
    ['shiny', '!traded&shiny&2'],
    ['xxl', '!traded&xxl&2'],
    ['xxs', '!traded&xxs&2'],
    ['costume', '!traded&costume&2'],
  ] as const)('generates an untraded search for a requested %s', (traitId, expected) => {
    const result = generateWantedTradeSearchStrings(
      catalog,
      [{ formId: 'ivysaur', categoryId: traitId, wanted: true }],
      traitId,
    );

    expect(result.strings).toEqual([expected]);
    expect(result.dexNumbers).toEqual([2]);
  });

  it('uses only explicit active goals for the selected trait', () => {
    const result = generateWantedTradeSearchStrings(
      catalog,
      [
        { formId: 'bulbasaur', categoryId: 'normal', wanted: true },
        { formId: 'bulbasaur', categoryId: 'shiny', wanted: false },
        { formId: 'ivysaur', categoryId: 'shiny', wanted: true },
        { formId: 'missing-form', categoryId: 'shiny', wanted: true },
      ],
      'shiny',
    );

    expect(result.strings).toEqual(['!traded&shiny&2']);
    expect(result.dexNumbers).toEqual([2]);
  });

  it('labels costume requests as candidates', () => {
    const result = generateWantedTradeSearchStrings(
      catalog,
      [{ formId: 'bulbasaur', categoryId: 'costume', wanted: true }],
      'costume',
    );
    expect(result.strings).toEqual(['!traded&costume&1']);
    expect(result.quality).toBe('candidate');
  });

  it('preserves the untraded prefix on every max-length chunk', () => {
    const largerCatalog = [1, 3, 5, 7, 9, 11].map((dexNumber) =>
      catalogItem(String(dexNumber), dexNumber, { shiny: 'released' }),
    );
    const wantedEntries: WantedEntry[] = largerCatalog.map((item) => ({
      formId: item.id,
      categoryId: 'shiny',
      wanted: true,
    }));
    const result = generateWantedTradeSearchStrings(largerCatalog, wantedEntries, 'shiny', {
      maxLength: 18,
    });

    expect(result.strings.length).toBeGreaterThan(1);
    expect(result.strings.every((value) => value.length <= 18)).toBe(true);
    expect(result.strings.every((value) => value.startsWith('!traded&shiny&'))).toBe(true);
  });

  it('rejects a later single term that cannot fit the maximum length', () => {
    const splitCatalog = [
      catalogItem('one', 1, { normal: 'released' }),
      catalogItem('large', 999, { normal: 'released' }),
    ];
    const wantedEntries: WantedEntry[] = splitCatalog.map((item) => ({
      formId: item.id,
      categoryId: 'normal',
      wanted: true,
    }));

    expect(() =>
      generateWantedTradeSearchStrings(splitCatalog, wantedEntries, 'normal', { maxLength: 9 }),
    ).toThrow(RangeError);
  });
});
