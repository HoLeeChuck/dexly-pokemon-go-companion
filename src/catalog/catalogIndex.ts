import type { CatalogItem } from '../../shared/types';

export interface CatalogIndex {
  defaultForms: readonly CatalogItem[];
  regions: readonly string[];
  formsByRegion: ReadonlyMap<string, readonly CatalogItem[]>;
  formsByVariant: ReadonlyMap<string, readonly CatalogItem[]>;
  formsBySpecies: ReadonlyMap<string, readonly CatalogItem[]>;
  formsById: ReadonlyMap<string, CatalogItem>;
}

function append(map: Map<string, CatalogItem[]>, key: string, item: CatalogItem) {
  const values = map.get(key);
  if (values) values.push(item);
  else map.set(key, [item]);
}

export function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

export function createCatalogIndex(catalog: readonly CatalogItem[]): CatalogIndex {
  const defaultForms: CatalogItem[] = [];
  const formsByRegion = new Map<string, CatalogItem[]>();
  const formsByVariant = new Map<string, CatalogItem[]>();
  const formsBySpecies = new Map<string, CatalogItem[]>();
  const formsById = new Map<string, CatalogItem>();

  for (const item of catalog) {
    if (item.isDefault) defaultForms.push(item);
    append(formsByRegion, titleCase(item.region), item);
    append(formsByVariant, item.variantKind, item);
    append(formsBySpecies, item.speciesId, item);
    formsById.set(item.id, item);
  }

  for (const forms of formsBySpecies.values()) {
    forms.sort(
      (left, right) => left.formSortOrder - right.formSortOrder || left.id.localeCompare(right.id),
    );
  }

  return {
    defaultForms,
    regions: [...new Set(defaultForms.map((item) => titleCase(item.region)))],
    formsByRegion,
    formsByVariant,
    formsBySpecies,
    formsById,
  };
}
