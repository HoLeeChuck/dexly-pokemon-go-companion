import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../shared/types';
import { collectorFormsForSpecies } from '../../src/catalog/collectorForms';

function item(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    id: 'form-0201-standard',
    speciesId: 'species-0201',
    formKey: 'standard',
    dexNumber: 201,
    name: 'Unown',
    generation: 2,
    region: 'Johto',
    types: ['Psychic'],
    isDefault: true,
    variantKind: 'standard',
    collectorGroupId: 'species-0201',
    isReleased: true,
    isTradeable: true,
    formSortOrder: 0,
    searchExact: true,
    spriteUrl: '',
    shinySpriteUrl: '',
    rules: {
      normal: 'released',
      shiny: 'released',
      lucky: 'released',
      hundo: 'released',
      xxl: 'released',
      xxs: 'released',
      shadow: 'ineligible',
      purified: 'ineligible',
    },
    ...overrides,
  };
}

describe('collectorFormsForSpecies', () => {
  it('uses the default Unown as canonical A and omits a duplicate Unown A', () => {
    const base = item({});
    const duplicateA = item({
      id: 'form-0201-a',
      formKey: 'a',
      formName: 'Unown A',
      isDefault: false,
      variantKind: 'alternate',
      formSortOrder: 1,
    });
    const formB = item({
      id: 'form-0201-b',
      formKey: 'b',
      formName: 'Unown B',
      isDefault: false,
      variantKind: 'alternate',
      formSortOrder: 2,
    });
    expect(
      collectorFormsForSpecies([base, duplicateA, formB], base).map((form) => form.formName),
    ).toEqual(['Unown B']);
  });
});
