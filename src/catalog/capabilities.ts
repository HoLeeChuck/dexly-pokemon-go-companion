import type { CatalogItem, Category, CategoryId } from '../../shared/types';

export const BASE_COLLECTION_ORDER = [
  'normal',
  'shiny',
  'hundo',
  'lucky',
  'xxl',
  'xxs',
] as const satisfies readonly CategoryId[];

export const ROCKET_COLLECTION_ORDER = [
  'shadow',
  'purified',
] as const satisfies readonly CategoryId[];

const TRANSFORMATION_KINDS = new Set<CatalogItem['variantKind']>(['mega', 'primal', 'gigantamax']);

export function collectionCategoryLabel(category: Pick<Category, 'id' | 'label'>): string {
  return category.id === 'hundo' ? '★ 100%' : category.label;
}

export function canTrackShiny(form: CatalogItem): boolean {
  return form.rules.shiny === 'released';
}

export function canTrackShadow(form: CatalogItem): boolean {
  return form.rules.shadow === 'released';
}

export function canTrackPurified(form: CatalogItem): boolean {
  return form.rules.purified === 'released';
}

export function getTransformations(
  catalog: readonly CatalogItem[],
  item: Pick<CatalogItem, 'speciesId'>,
): CatalogItem[] {
  return catalog
    .filter(
      (candidate) =>
        candidate.speciesId === item.speciesId && TRANSFORMATION_KINDS.has(candidate.variantKind),
    )
    .sort(compareForms);
}

export function getCostumes(
  catalog: readonly CatalogItem[],
  item: Pick<CatalogItem, 'speciesId'>,
): CatalogItem[] {
  return catalog
    .filter(
      (candidate) => candidate.speciesId === item.speciesId && candidate.variantKind === 'costume',
    )
    .sort(compareForms);
}

export function getAlternateForms(
  catalog: readonly CatalogItem[],
  item: CatalogItem,
): CatalogItem[] {
  return catalog
    .filter(
      (candidate) =>
        candidate.speciesId === item.speciesId &&
        candidate.id !== item.id &&
        candidate.variantKind !== 'costume' &&
        !TRANSFORMATION_KINDS.has(candidate.variantKind),
    )
    .sort(compareForms);
}

export function getCollectionCapabilities(item: CatalogItem) {
  return {
    shiny: canTrackShiny(item),
    shadow: canTrackShadow(item),
    purified: canTrackPurified(item),
    categories: [...BASE_COLLECTION_ORDER, ...ROCKET_COLLECTION_ORDER].filter(
      (categoryId) => item.rules[categoryId] !== undefined,
    ),
  };
}

function compareForms(left: CatalogItem, right: CatalogItem): number {
  return (
    left.formSortOrder - right.formSortOrder ||
    (left.formName ?? left.name).localeCompare(right.formName ?? right.name)
  );
}
