import regionMedalPolicy from '../../catalog/region-medals.v1.json';
import type { CatalogItem, CategoryId, CollectionEntry } from '../../shared/types';
import type { CatalogIndex } from './catalogIndex';
import { titleCase } from './catalogIndex';

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export interface MedalThresholds {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}
export interface RegionMedalProgress {
  region: string;
  collected: number;
  available: number;
  total: number;
  tier: MedalTier;
  mark: string;
}

const policyByRegion = new Map(regionMedalPolicy.regions.map((region) => [region.label, region]));

export function medalTier(count: number, thresholds: MedalThresholds): MedalTier {
  if (count >= thresholds.platinum) return 'platinum';
  if (count >= thresholds.gold) return 'gold';
  if (count >= thresholds.silver) return 'silver';
  if (count >= thresholds.bronze) return 'bronze';
  return 'none';
}

export function regionMedalProgress(
  index: CatalogIndex,
  entries: readonly CollectionEntry[],
  region: string,
  categoryId: CategoryId,
): RegionMedalProgress {
  const normalizedRegion = titleCase(region);
  const items = (index.formsByRegion.get(normalizedRegion) ?? []).filter((item) => item.isDefault);
  const policy = policyByRegion.get(normalizedRegion);
  const thresholds = policy?.categoryThresholds[categoryId] ?? {
    bronze: Number.POSITIVE_INFINITY,
    silver: Number.POSITIVE_INFINITY,
    gold: Number.POSITIVE_INFINITY,
    platinum: items.length,
  };
  const ids = new Set(items.map((item) => item.id));
  const collected = new Set(
    entries
      .filter(
        (entry) => entry.collected && entry.categoryId === categoryId && ids.has(entry.formId),
      )
      .map((entry) => entry.formId),
  ).size;
  const available = items.filter((item) => item.rules[categoryId] === 'released').length;
  return {
    region: normalizedRegion,
    collected,
    available,
    total: thresholds.platinum,
    tier: medalTier(collected, thresholds),
    mark: policy?.mark ?? normalizedRegion.slice(0, 1),
  };
}

export function regionMedalProgresses(
  index: CatalogIndex,
  entries: readonly CollectionEntry[],
  categoryId: CategoryId,
): ReadonlyMap<string, RegionMedalProgress> {
  return new Map(
    index.regions.map((region) => [
      region,
      regionMedalProgress(index, entries, region, categoryId),
    ]),
  );
}

export function defaultRegionCatalog(index: CatalogIndex, region: string): readonly CatalogItem[] {
  return (index.formsByRegion.get(titleCase(region)) ?? []).filter((item) => item.isDefault);
}
