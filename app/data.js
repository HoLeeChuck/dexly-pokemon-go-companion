import {
  loadLocalProfileResult,
  saveLocalProfileSafely,
  listLocalProfileSnapshots,
  restoreLocalProfileSnapshot,
  updateLocalProfileSettings,
} from '../src/lib/localProfile';
import { profileRestoreSummary } from '../src/lib/profileBackup';
import {
  createPortableProfileBackupJson,
  parsePortableProfileBackup,
  restorePortableProfileBackup,
} from '../src/lib/profileBackup';
import {
  exportCollectionCsv,
  previewCanonicalWideCsv,
  applyCsvRuleValidation,
} from '../shared/csv';
import { applyLocalCsvImport } from '../src/lib/localProfile';
import { fullCatalog, catalog, catalogVersion } from './catalog';
import { interpretSheets } from './sheet.js';

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
    [field]: had
      ? rest
      : [...rest, { formId, categoryId, collected: true, updatedAt: new Date().toISOString() }],
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
/**
 * Review a community spreadsheet (workbook tabs or pasted rows). Adds only: nothing already
 * registered is removed, so importing never loses data.
 */
export function reviewSheetImport(sheets) {
  const { entries, summary } = interpretSheets(sheets, catalog);
  if (!summary.rows)
    throw new Error(
      'No Pokémon rows found. Rows need a Dex number and a name, like the shared spreadsheet.',
    );
  const owned = collectionKeys();
  const adds = entries.filter((e) => !owned.has(`${e.formId}:${e.categoryId}`));
  return {
    kind: 'sheet',
    revision: currentProfile().revision,
    adds,
    summary,
    count: adds.length,
    already: entries.length - adds.length,
  };
}
export function commitImport(review) {
  if (currentProfile().revision !== review.revision)
    throw new Error('The collection changed after preview. Choose the import file again.');
  if (review.kind === 'sheet')
    return setMany(
      review.adds.map((e) => ({ ...e, collected: true })),
      'Before a spreadsheet import',
    ).owned;
  const result =
    review.kind === 'json'
      ? restorePortableProfileBackup(review.text)
      : applyLocalCsvImport(currentProfile(), review.preview, fullCatalog, 'Prism CSV import');
  if (!result.ok) throw result.error;
  return collectionKeys();
}

/** Every collected entry with its optional collection date, for recaps and sharing. */
export function collectedEntries() {
  return entries(currentProfile()).filter((e) => e.collected);
}

/**
 * Apply several collection changes in one durable save (paint mode, region setup).
 * Ineligible targets are skipped rather than failing the whole batch.
 */
export function setMany(changes, reason = 'Before a bulk collection update') {
  const p = currentProfile();
  const byId = new Map(fullCatalog.map((item) => [item.id, item]));
  const next = {
    collectionEntries: [...p.collectionEntries],
    formCollectionEntries: [...p.formCollectionEntries],
  };
  const at = new Date().toISOString();
  let changed = 0;
  for (const { formId, categoryId, collected } of changes) {
    const item = byId.get(formId);
    if (item?.rules[categoryId] !== 'released') continue;
    if (!item.isDefault && !['normal', 'shiny'].includes(categoryId)) continue;
    const field = item.isDefault ? 'collectionEntries' : 'formCollectionEntries';
    const had = next[field].some(
      (e) => e.formId === formId && e.categoryId === categoryId && e.collected,
    );
    if (had === collected) continue;
    next[field] = next[field].filter((e) => e.formId !== formId || e.categoryId !== categoryId);
    if (collected) next[field].push({ formId, categoryId, collected: true, updatedAt: at });
    changed += 1;
  }
  if (!changed) return { owned: collectionKeys(), changed };
  const result = saveLocalProfileSafely(
    { ...p, ...next, revision: p.revision + 1, catalogVersion },
    { forceSnapshot: true, snapshotReason: reason },
  );
  if (!result.ok) throw result.error;
  return { owned: collectionKeys(), changed };
}

export function recoverySnapshots() {
  return listLocalProfileSnapshots().map((snapshot) => ({
    id: snapshot.id,
    summary: profileRestoreSummary(snapshot.profile, {
      sourceName: snapshot.reason,
      createdAt: snapshot.createdAt,
      catalogVersion: snapshot.catalogVersion,
      currentCatalogVersion: catalogVersion,
    }),
  }));
}

export function restoreSnapshot(id) {
  const result = restoreLocalProfileSnapshot(id);
  if (!result.ok) throw result.error;
  return collectionKeys();
}

export function profileSettings() {
  try {
    return currentProfile().settings;
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  const result = updateLocalProfileSettings(currentProfile(), settings, { createSnapshot: false });
  if (!result.ok) throw result.error;
}
