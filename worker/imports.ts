import {
  applyCsvRuleValidation,
  previewCanonicalWideCsv,
  type CsvPreviewChange,
  type CsvImportPolicy,
  type CsvImportPreview,
} from '../shared/csv';
import { ApiError } from './http';
import { getBootstrap, getCollectionRevision } from './repository';

interface StoredPreview {
  changes: CsvPreviewChange[];
}

interface ImportJobRow {
  id: string;
  status: string;
  source_name: string;
  base_revision: number;
  catalog_version: string;
  preview_json: string;
  expires_at: string;
}

export interface ImportPreviewResponse {
  jobId: string | null;
  preview: CsvImportPreview;
  expiresAt: string | null;
}

export interface ImportApplyResponse {
  jobId: string;
  backupId: string;
  batchId: string | null;
  revision: number;
  added: number;
  removed: number;
}

const MAX_IMPORT_BYTES = 512_000;
const MAX_IMPORT_ROWS = 2_500;
const MAX_IMPORT_CHANGES = 10_000;
const MAX_STORED_PREVIEW_BYTES = 1_750_000;
const MAX_BACKUP_BYTES = 1_750_000;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashText(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function actionableChanges(preview: CsvImportPreview): CsvPreviewChange[] {
  return preview.changes.filter(
    (change) => change.disposition === 'add' || change.disposition === 'remove',
  );
}

function parseStoredPreview(value: string): StoredPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ApiError(
      500,
      'IMPORT_PREVIEW_CORRUPT',
      'The stored import preview could not be read.',
    );
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { changes?: unknown }).changes)
  ) {
    throw new ApiError(
      500,
      'IMPORT_PREVIEW_CORRUPT',
      'The stored import preview could not be read.',
    );
  }

  const changes = (parsed as { changes: unknown[] }).changes;
  if (
    changes.length > MAX_IMPORT_CHANGES ||
    changes.some(
      (change) =>
        !change ||
        typeof change !== 'object' ||
        typeof (change as CsvPreviewChange).formId !== 'string' ||
        typeof (change as CsvPreviewChange).categoryId !== 'string' ||
        typeof (change as CsvPreviewChange).before !== 'boolean' ||
        typeof (change as CsvPreviewChange).after !== 'boolean' ||
        !['add', 'remove'].includes((change as CsvPreviewChange).disposition),
    )
  ) {
    throw new ApiError(
      500,
      'IMPORT_PREVIEW_CORRUPT',
      'The stored import preview contains invalid changes.',
    );
  }
  return { changes: changes as CsvPreviewChange[] };
}

export async function previewImport(
  db: D1Database,
  profileId: string,
  input: { csv: string; sourceName: string; policy: CsvImportPolicy },
): Promise<ImportPreviewResponse> {
  if (new TextEncoder().encode(input.csv).byteLength > MAX_IMPORT_BYTES) {
    throw new ApiError(413, 'CSV_TOO_LARGE', 'CSV imports are limited to 512 KB.');
  }
  if (input.csv.includes('\0'))
    throw new ApiError(400, 'INVALID_CSV', 'CSV files cannot contain NUL bytes.');

  const lineCount = input.csv.split(/\r\n|\r|\n/).length;
  if (lineCount > MAX_IMPORT_ROWS + 1)
    throw new ApiError(
      413,
      'CSV_TOO_MANY_ROWS',
      `CSV imports are limited to ${MAX_IMPORT_ROWS.toLocaleString('en-US')} data rows.`,
    );

  const bootstrap = await getBootstrap(db, profileId);
  let preview: CsvImportPreview;
  try {
    preview = previewCanonicalWideCsv(
      input.csv,
      bootstrap.catalog,
      bootstrap.collectionEntries,
      input.policy,
    );
  } catch (error) {
    throw new ApiError(
      400,
      'CSV_PARSE_ERROR',
      error instanceof Error ? error.message : 'The CSV could not be parsed.',
    );
  }
  preview = applyCsvRuleValidation(preview, bootstrap.catalog);

  if (preview.summary.rejected > 0) {
    return { jobId: null, preview, expiresAt: null };
  }

  const changes = actionableChanges(preview);
  if (changes.length > MAX_IMPORT_CHANGES) {
    throw new ApiError(
      413,
      'IMPORT_CHANGE_LIMIT',
      `A single import can apply at most ${MAX_IMPORT_CHANGES.toLocaleString('en-US')} changed cells.`,
    );
  }

  const id = `import:${crypto.randomUUID()}`;
  const revision = await getCollectionRevision(db, profileId);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const sourceHash = await hashText(input.csv);
  const storedJson = JSON.stringify({ changes } satisfies StoredPreview);
  if (new TextEncoder().encode(storedJson).byteLength > MAX_STORED_PREVIEW_BYTES) {
    throw new ApiError(
      413,
      'IMPORT_PREVIEW_TOO_LARGE',
      'The validated import plan is too large to store safely. Split the CSV and try again.',
    );
  }
  await db
    .prepare(
      `INSERT INTO import_jobs
         (id, profile_id, status, source_name, source_hash, format, policy, base_revision,
          catalog_version, summary_json, preview_json, expires_at)
       VALUES (?, ?, 'previewed', ?, ?, 'wide', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      profileId,
      input.sourceName,
      sourceHash,
      input.policy,
      revision,
      bootstrap.catalogVersion,
      JSON.stringify(preview.summary),
      storedJson,
      expiresAt,
    )
    .run();

  return { jobId: id, preview, expiresAt };
}

export async function applyImport(
  db: D1Database,
  profileId: string,
  jobId: string,
): Promise<ImportApplyResponse> {
  const job = await db
    .prepare(
      `SELECT id, status, source_name, base_revision, catalog_version,
              preview_json, expires_at
       FROM import_jobs
       WHERE id = ? AND profile_id = ?`,
    )
    .bind(jobId, profileId)
    .first<ImportJobRow>();
  if (!job) throw new ApiError(404, 'IMPORT_NOT_FOUND', 'That import preview was not found.');
  if (job.status !== 'previewed')
    throw new ApiError(
      409,
      'IMPORT_ALREADY_USED',
      'That import preview was already applied or closed.',
    );
  if (new Date(job.expires_at).getTime() < Date.now())
    throw new ApiError(
      410,
      'IMPORT_EXPIRED',
      'That import preview expired. Preview the CSV again.',
    );

  const currentRevision = await getCollectionRevision(db, profileId);
  const bootstrap = await getBootstrap(db, profileId);
  if (job.base_revision !== currentRevision || job.catalog_version !== bootstrap.catalogVersion) {
    throw new ApiError(
      409,
      'IMPORT_STALE',
      'The collection or catalog changed after preview. Preview the CSV again.',
    );
  }

  const stored = parseStoredPreview(job.preview_json);
  const catalogById = new Map(bootstrap.catalog.map((item) => [item.id, item]));
  const collectedKeys = new Set(
    bootstrap.collectionEntries.map((entry) => `${entry.formId}\u0000${entry.categoryId}`),
  );
  const invalidChange = stored.changes.find((change) => {
    const rule = catalogById.get(change.formId)?.rules[change.categoryId] ?? 'unknown';
    const currentlyCollected = collectedKeys.has(`${change.formId}\u0000${change.categoryId}`);
    return (
      (change.after && rule !== 'released') ||
      currentlyCollected !== change.before ||
      change.before === change.after
    );
  });
  if (invalidChange) {
    throw new ApiError(
      409,
      'IMPORT_REVALIDATION_FAILED',
      'The stored import plan no longer matches the authoritative catalog and collection.',
    );
  }
  const changes = stored.changes;

  const backupData = {
    schemaVersion: 1,
    catalogVersion: bootstrap.catalogVersion,
    revision: currentRevision,
    collectionEntries: bootstrap.collectionEntries,
    wantedEntries: bootstrap.wantedEntries,
    tradeSpecimens: bootstrap.tradeSpecimens,
  };
  const backupId = `backup:${crypto.randomUUID()}`;
  const batchId = changes.length ? `mutation:${crypto.randomUUID()}` : null;
  const revision = changes.length ? currentRevision + 1 : currentRevision;
  const changesJson = JSON.stringify(changes);
  const backupJson = JSON.stringify(backupData);
  if (new TextEncoder().encode(backupJson).byteLength > MAX_BACKUP_BYTES) {
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'The pre-import backup is too large for this storage version. Export the collection before retrying.',
    );
  }
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO backup_snapshots
           (id, profile_id, reason, catalog_version, snapshot_json)
         SELECT ?, ?, ?, ?, ?
         FROM import_jobs AS job
         JOIN trainer_profiles AS profile
           ON profile.id = job.profile_id AND profile.collection_revision = ?
         WHERE job.id = ? AND job.profile_id = ? AND job.status = 'previewed'`,
      )
      .bind(
        backupId,
        profileId,
        `Before CSV import: ${job.source_name}`,
        bootstrap.catalogVersion,
        backupJson,
        currentRevision,
        job.id,
        profileId,
      ),
  ];

  if (batchId) {
    statements.push(
      db
        .prepare(
          `INSERT INTO mutation_batches
             (id, profile_id, client_operation_id, kind, base_revision, result_revision, metadata_json)
           SELECT ?, ?, ?, 'import', ?, ?, json_object('importJobId', ?)
           FROM trainer_profiles WHERE id = ? AND collection_revision = ?`,
        )
        .bind(
          batchId,
          profileId,
          `import:${job.id}`,
          currentRevision,
          revision,
          job.id,
          profileId,
          currentRevision,
        ),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO mutation_items
             (batch_id, form_id, category_id, before_value, after_value)
           SELECT ?,
                  json_extract(value, '$.formId'),
                  json_extract(value, '$.categoryId'),
                  json_extract(value, '$.before'),
                  json_extract(value, '$.after')
           FROM json_each(?)`,
        )
        .bind(batchId, changesJson),
      db
        .prepare(
          `INSERT INTO collection_entries (profile_id, form_id, category_id)
           SELECT ?, json_extract(value, '$.formId'), json_extract(value, '$.categoryId')
           FROM json_each(?)
           WHERE json_extract(value, '$.after') = 1
           ON CONFLICT (profile_id, form_id, category_id)
           DO UPDATE SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(profileId, changesJson),
      db
        .prepare(
          `DELETE FROM collection_entries
           WHERE profile_id = ?
             AND EXISTS (
               SELECT 1
               FROM json_each(?) AS changed
               WHERE json_extract(changed.value, '$.after') = 0
                 AND json_extract(changed.value, '$.formId') = collection_entries.form_id
                 AND json_extract(changed.value, '$.categoryId') = collection_entries.category_id
             )`,
        )
        .bind(profileId, changesJson),
    );
    statements.push(
      db
        .prepare(
          `UPDATE trainer_profiles
           SET collection_revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ? AND collection_revision = ?`,
        )
        .bind(revision, profileId, currentRevision),
    );
  }
  statements.push(
    db
      .prepare(
        `UPDATE import_jobs
         SET status = 'applied', backup_id = ?, applied_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND status = 'previewed'`,
      )
      .bind(backupId, job.id),
  );

  try {
    await db.batch(statements);
  } catch (error) {
    console.warn('CSV import transaction rejected', { jobId: job.id, profileId, error });
    throw new ApiError(
      409,
      'IMPORT_CONFLICT',
      'The import could not be applied atomically. No changes were saved.',
    );
  }

  const applied = await db
    .prepare('SELECT status, backup_id FROM import_jobs WHERE id = ? AND profile_id = ?')
    .bind(job.id, profileId)
    .first<{ status: string; backup_id: string | null }>();
  if (applied?.status !== 'applied' || applied.backup_id !== backupId) {
    throw new ApiError(
      409,
      'IMPORT_CONFLICT',
      'The import preview was applied by another request. No duplicate changes were saved.',
    );
  }

  return {
    jobId: job.id,
    backupId,
    batchId,
    revision,
    added: changes.filter((change) => change.after).length,
    removed: changes.filter((change) => !change.after).length,
  };
}
