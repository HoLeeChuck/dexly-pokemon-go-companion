import { describe, expect, it } from 'vitest';
import manifestJson from '../../catalog/catalog.v1.json';
import type { CatalogItem, Category } from '../../shared/types';
import {
  BASE_COLLECTION_ORDER,
  collectionCategoryLabel,
  getAlternateForms,
  getCostumes,
  getTransformations,
  ROCKET_COLLECTION_ORDER,
} from '../../src/catalog/capabilities';

const catalog = manifestJson.forms.map(
  (form) =>
    ({
      ...form,
      id: form.formId,
      dexNumber: form.dex,
      spriteUrl: form.assets.normal?.upstreamPath,
      shinySpriteUrl: form.assets.shiny?.upstreamPath,
      isTradeable: form.tradeable,
    }) as CatalogItem,
);

describe('collection capabilities', () => {
  it('keeps the stable hundo key while presenting the required black star label', () => {
    const category = { id: 'hundo', label: 'Hundo' } as Category;
    expect(collectionCategoryLabel(category)).toBe('★ 100%');
    expect(collectionCategoryLabel(category)).not.toContain('⭐');
    expect([...BASE_COLLECTION_ORDER, ...ROCKET_COLLECTION_ORDER]).toEqual([
      'normal',
      'shiny',
      'hundo',
      'lucky',
      'xxl',
      'xxs',
      'shadow',
      'purified',
    ]);
  });

  it('separates Pikachu costumes, alternates, and G-Max', () => {
    const pikachu = catalog.find((form) => form.id === 'form-0025-standard')!;
    expect(getCostumes(catalog, pikachu).length).toBeGreaterThan(0);
    expect(
      getAlternateForms(catalog, pikachu).every((form) => form.variantKind !== 'costume'),
    ).toBe(true);
    expect(getTransformations(catalog, pikachu).map((form) => form.formName)).toContain(
      'Gigantamax Pikachu',
    );
  });

  it('returns both Mega Raichu variants independently', () => {
    const raichu = catalog.find((form) => form.id === 'form-0026-standard')!;
    expect(getTransformations(catalog, raichu).map((form) => form.formName)).toEqual([
      'Mega Raichu X',
      'Mega Raichu Y',
    ]);
  });
});
