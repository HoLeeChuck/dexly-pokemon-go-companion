import source from '../catalog/catalog.v1.json';
import genders from '../catalog/genders.v1.json';
import ledger from '../catalog/releases.v1.json';
import formArtwork from '../catalog/form-artwork.v1.json';
import { reviewedForms } from './catalog-review';
import { applyLedger, ledgerSources, ledgerUpdatedAt } from './releases.js';

/** Newest release-ledger entry, or null while the ledger is empty. */
export const ledgerDate = ledgerUpdatedAt(ledger);
export const catalogVersion =
  source.catalogVersion + '-review.20260924' + (ledgerDate ? `-ledger.${ledgerDate}` : '');
export const catalogDate = source.releaseMetadataAsOf;
export const catalogSources = [...source.sourceInputs, ...ledgerSources(ledger)];

const onlyMale = new Set(genders.male);
const onlyFemale = new Set(genders.female);
const genderless = new Set(genders.none);
/** Gender follows Normal availability, limited by which genders the species can be. */
function genderRules(p) {
  if (!p.isDefault) return { male: 'ineligible', female: 'ineligible' };
  const normal = p.rules.normal;
  const can = (gender) =>
    normal !== 'released'
      ? normal
      : genderless.has(p.dex) ||
          (gender === 'male' && onlyFemale.has(p.dex)) ||
          (gender === 'female' && onlyMale.has(p.dex))
        ? 'ineligible'
        : 'released';
  return { male: can('male'), female: can('female') };
}

const ARTWORK_DIR = '/artwork/pokemon-home/';
export const fullCatalog = applyLedger(reviewedForms(source.forms), ledger).map((p) => {
  // Forms with their own HOME artwork (catalog/form-artwork.v1.json) stop using the species art.
  const own = formArtwork.forms[p.formId];
  const spriteUrl = own ? ARTWORK_DIR + own.normal : '/' + p.assets.normal.upstreamPath;
  return {
    ...p,
    rules: { ...p.rules, ...genderRules(p) },
    id: p.formId,
    dexNumber: p.dex,
    isTradeable: p.tradeable,
    artworkIsFallback: own ? false : p.artworkIsFallback,
    spriteUrl,
    shinySpriteUrl: own?.shiny
      ? ARTWORK_DIR + own.shiny
      : '/' + (p.assets.shiny?.upstreamPath || p.assets.normal.upstreamPath),
  };
});
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
    speciesName: p.name,
    art: p.spriteUrl,
    shiny: p.shinySpriteUrl,
  }));
