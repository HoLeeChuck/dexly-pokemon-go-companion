import type { CatalogItem } from '../../shared/types';
import { getAlternateForms } from './capabilities';

export function collectorFormsForSpecies(
  catalog: readonly CatalogItem[],
  item: CatalogItem,
): CatalogItem[] {
  return getAlternateForms(catalog, item);
}
