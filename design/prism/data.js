import { loadLocalProfileResult, saveLocalProfileSafely } from '../../src/lib/localProfile';
import {
  createPortableProfileBackupJson,
  parsePortableProfileBackup,
  restorePortableProfileBackup,
} from '../../src/lib/profileBackup';
import {
  exportCollectionCsv,
  previewCanonicalWideCsv,
  applyCsvRuleValidation,
} from '../../shared/csv';
import { applyLocalCsvImport } from '../../src/lib/localProfile';
import { fullCatalog, catalogVersion } from './catalog';

// Same audited data contract as the existing app. Never seed demonstration ownership.
export function currentProfile() {
  const result = loadLocalProfileResult();
  if (['corrupt', 'unavailable'].includes(result.status))
    throw new Error(result.warnings.join(' '));
  return result.profile;
}
function entries(profile) {
  return [...profile.collectionEntries, ...profile.formCollectionEntries];
}
export function collectionKeys() {
  return new Set(
    entries(currentProfile())
      .filter((e) => e.collected)
      .map((e) => `${e.formId}:${e.categoryId}`),
  );
}
export function toggleCollection(formId, categoryId) {
  const item = fullCatalog.find((p) => p.id === formId);
  if (item?.rules[categoryId] !== 'released')
    throw new Error('This category is not released or eligible.');
  const p = currentProfile();
  if (!item.isDefault && !['normal', 'shiny'].includes(categoryId))
    throw new Error('Alternate forms track Normal and Shiny.');
  const field = item.isDefault ? 'collectionEntries' : 'formCollectionEntries';
  const had = p[field].some(
    (e) => e.formId === formId && e.categoryId === categoryId && e.collected,
  );
  const rest = p[field].filter((e) => e.formId !== formId || e.categoryId !== categoryId);
  const result = saveLocalProfileSafely({
    ...p,
    revision: p.revision + 1,
    catalogVersion,
    [field]: had ? rest : [...rest, { formId, categoryId, collected: true }],
  });
  if (!result.ok) throw result.error;
  return collectionKeys();
}
export function exportBackup() {
  return createPortableProfileBackupJson(currentProfile(), catalogVersion);
}
export function exportCsv() {
  return '\uFEFF' + exportCollectionCsv(fullCatalog, entries(currentProfile()));
}
export function reviewImport(text, kind) {
  if (kind === 'json') {
    const backup = parsePortableProfileBackup(text);
    return {
      kind,
      revision: currentProfile().revision,
      text,
      count: entries(backup.profile).filter((e) => e.collected).length,
      description:
        'Replace this browser collection and settings with the backup. A recovery snapshot is saved first.',
    };
  }
  const preview = applyCsvRuleValidation(
    previewCanonicalWideCsv(text, fullCatalog, entries(currentProfile()), 'merge'),
    fullCatalog,
  );
  const errors = preview.issues.filter((i) => i.severity === 'error');
  if (errors.length) throw new Error(errors.map((i) => i.message).join(' '));
  return {
    kind,
    revision: currentProfile().revision,
    text,
    preview,
    count: preview.changes.filter((c) => c.disposition === 'add').length,
    description: 'Merge collected entries from CSV. Existing collected entries are kept.',
  };
}
export function commitImport(review) {
  if (currentProfile().revision !== review.revision)
    throw new Error('The collection changed after preview. Choose the import file again.');
  const result =
    review.kind === 'json'
      ? restorePortableProfileBackup(review.text)
      : applyLocalCsvImport(currentProfile(), review.preview, fullCatalog, 'Prism CSV import');
  if (!result.ok) throw result.error;
  return collectionKeys();
}
