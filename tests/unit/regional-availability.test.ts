import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../shared/types';
import {
  coarseRegionFromCoordinates,
  recommendedForRegion,
} from '../../src/catalog/regionalAvailability';

function regionalForm(zones: readonly string[]): CatalogItem {
  return {
    id: 'form-0741-pom-pom',
    speciesId: 'species-0741',
    dexNumber: 741,
    name: 'Oricorio',
    formName: 'Pom-Pom Style Oricorio',
    formKey: 'pom-pom',
    generation: 7,
    region: 'alola',
    types: ['electric', 'flying'],
    isDefault: false,
    variantKind: 'alternate',
    collectorGroupId: 'forms-other',
    isReleased: true,
    isTradeable: true,
    formSortOrder: 700,
    searchExact: false,
    availability: { mode: 'regional', zones },
    rules: { normal: 'released', shiny: 'released' },
  };
}

describe('regional availability preferences', () => {
  it('recommends US Pom-Pom Oricorio without hiding it for other regions', () => {
    const pomPom = regionalForm(['united-states', 'americas']);
    expect(recommendedForRegion(pomPom, 'united-states')).toBe(true);
    expect(recommendedForRegion(pomPom, 'europe')).toBe(false);
    expect(recommendedForRegion(pomPom, 'no-preference')).toBe(false);
  });

  it('classifies one-time coordinates into coarse regions only', () => {
    expect(coarseRegionFromCoordinates(44.98, -93.27)).toBe('united-states');
    expect(coarseRegionFromCoordinates(35.68, 139.76)).toBe('japan');
    expect(coarseRegionFromCoordinates(48.86, 2.35)).toBe('europe');
    expect(coarseRegionFromCoordinates(-33.86, 151.21)).toBe('asia-pacific');
  });
});
