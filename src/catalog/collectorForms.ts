import type { CatalogItem } from '../../shared/types';

export function collectorFormsForSpecies(
  catalog: readonly CatalogItem[],
  item: CatalogItem,
): CatalogItem[] {
  return catalog
    .filter(
      (candidate) =>
        candidate.speciesId === item.speciesId &&
        candidate.id !== item.id &&
        !(
          item.dexNumber === 201 &&
          (/unown a$/i.test(candidate.formName ?? '') || candidate.formKey === 'a')
        ),
    )
    .sort(
      (left, right) =>
        left.formSortOrder - right.formSortOrder ||
        (left.formName ?? left.name).localeCompare(right.formName ?? right.name),
    );
}
