import source from '../../catalog/catalog.v1.json';
import { reviewedForms } from './catalog-review';
export const catalogVersion = source.catalogVersion + '-review.20260924';
export const catalogDate = source.releaseMetadataAsOf;
export const fullCatalog = reviewedForms(source.forms).map((p) => ({
  ...p,
  id: p.formId,
  dexNumber: p.dex,
  isTradeable: p.tradeable,
  spriteUrl: '/' + p.assets.normal.upstreamPath,
  shinySpriteUrl: '/' + (p.assets.shiny?.upstreamPath || p.assets.normal.upstreamPath),
}));
export const catalog = fullCatalog
  .filter((p) => p.variantKind !== 'costume' && !p.retiredAt)
  .map((p) => ({
    ...p,
    rules: p.isDefault
      ? p.rules
      : Object.fromEntries(
          Object.entries(p.rules).map(([k, v]) => [
            k,
            ['normal', 'shiny'].includes(k) ? v : 'ineligible',
          ]),
        ),
    n: p.dex,
    name: p.formName || p.name,
    art: p.spriteUrl,
    shiny: p.shinySpriteUrl,
  }));
