import { describe, expect, it } from 'vitest';
import type { CatalogItem, CollectionEntry } from '../../shared/types';
import { createCatalogIndex } from '../../src/catalog/catalogIndex';
import { medalTier, regionMedalProgress } from '../../src/catalog/regionMedals';

function item(id: string, region: string, isDefault = true): CatalogItem {
  return {
    id,
    speciesId: `species-${id}`,
    dexNumber: Number(id.replace(/\D/g, '')) || 1,
    name: id,
    formKey: 'standard',
    generation: 1,
    region,
    types: ['normal'],
    isDefault,
    variantKind: isDefault ? 'standard' : 'mega',
    collectorGroupId: `group-${id}`,
    isReleased: true,
    isTradeable: true,
    formSortOrder: isDefault ? 0 : 1,
    searchExact: true,
    rules: { normal: 'released', shiny: 'released' },
  };
}

describe('catalog index', () => {
  it('indexes defaults, regions, variants, species, and ids once', () => {
    const base = item('1', 'kanto');
    const mega = { ...item('1-mega', 'kanto', false), speciesId: base.speciesId };
    const index = createCatalogIndex([mega, base, item('152', 'johto')]);
    expect(index.defaultForms.map((entry) => entry.id)).toEqual(['1', '152']);
    expect(index.regions).toEqual(['Kanto', 'Johto']);
    expect(index.formsByVariant.get('mega')).toEqual([mega]);
    expect(index.formsBySpecies.get(base.speciesId)?.map((entry) => entry.id)).toEqual([
      '1',
      '1-mega',
    ]);
    expect(index.formsById.get('152')?.region).toBe('johto');
  });
});

describe('region medals', () => {
  it.each([
    [0, 'none'],
    [20, 'bronze'],
    [50, 'silver'],
    [100, 'gold'],
    [151, 'platinum'],
  ] as const)('maps Kanto count %i to %s', (count, tier) => {
    expect(medalTier(count, { bronze: 20, silver: 50, gold: 100, platinum: 151 })).toBe(tier);
  });

  it('uses the full category denominator while reporting current availability', () => {
    const catalog = [
      item('1', 'kanto'),
      { ...item('2', 'kanto'), rules: { normal: 'unreleased' as const } },
    ];
    const index = createCatalogIndex(catalog);
    const entries: CollectionEntry[] = [{ formId: '1', categoryId: 'normal', collected: true }];
    const progress = regionMedalProgress(index, entries, 'Kanto', 'normal');
    expect(progress).toMatchObject({ collected: 1, available: 1, total: 151, tier: 'none' });
  });

  it('uses category-specific thresholds', () => {
    const index = createCatalogIndex([item('1', 'kanto')]);
    const progress = regionMedalProgress(index, [], 'Kanto', 'shiny');
    expect(progress.total).toBe(151);
  });
});
