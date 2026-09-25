import type { CatalogItem, CategoryId, CollectionEntry } from '../../shared/types';

export interface RegionProgress {
  region: string;
  total: number;
  collected: number;
  missing: CatalogItem[];
  percentage: number;
}

function collectedFormIds(
  entries: readonly CollectionEntry[],
  categoryId: CategoryId,
): Set<string> {
  return new Set(
    entries
      .filter((entry) => entry.categoryId === categoryId && entry.collected)
      .map((entry) => entry.formId),
  );
}

function releasedDefaultCatalog(catalog: readonly CatalogItem[], categoryId: CategoryId) {
  return catalog.filter((item) => item.isDefault && item.rules[categoryId] === 'released');
}

export function regionProgresses(
  catalog: readonly CatalogItem[],
  entries: readonly CollectionEntry[],
  categoryId: CategoryId = 'normal',
): RegionProgress[] {
  const owned = collectedFormIds(entries, categoryId);
  const released = releasedDefaultCatalog(catalog, categoryId);
  const regions = [...new Set(released.map((item) => item.region))];
  return regions
    .map((region) => {
      const scoped = released.filter((item) => item.region === region);
      const missing = scoped.filter((item) => !owned.has(item.id));
      const collected = scoped.length - missing.length;
      return {
        region,
        total: scoped.length,
        collected,
        missing,
        percentage: scoped.length ? Math.round((collected / scoped.length) * 100) : 0,
      };
    })
    .sort((left, right) => left.region.localeCompare(right.region));
}

export function closestIncompleteRegion(regions: readonly RegionProgress[]): RegionProgress | null {
  return (
    regions
      .filter((region) => region.missing.length > 0)
      .sort(
        (left, right) =>
          left.missing.length - right.missing.length || right.percentage - left.percentage,
      )[0] ?? null
  );
}
