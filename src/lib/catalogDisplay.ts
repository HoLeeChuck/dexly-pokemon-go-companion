import type { CatalogItem } from '../../shared/types';

export function catalogDisplayName(item: CatalogItem): string {
  return item.formName?.trim() || item.name;
}
