import {
  LOCAL_PROFILE_SCHEMA_VERSION,
  loadLocalProfileResult,
  saveLocalProfileSafely,
  validateLocalProfile,
} from './localProfile';
import type { LocalProfile, LocalProfileSaveResult, LocalStorageLike } from './localProfile';

export const PORTABLE_BACKUP_FORMAT = 'catchgrid.profile-backup' as const;
export const PORTABLE_BACKUP_SCHEMA_VERSION = 1 as const;
export const MAX_PORTABLE_BACKUP_BYTES = 5_000_000;

export interface PortableProfileBackup {
  format: typeof PORTABLE_BACKUP_FORMAT;
  schemaVersion: typeof PORTABLE_BACKUP_SCHEMA_VERSION;
  createdAt: string;
  catalogVersion: string;
  profileSchemaVersion: typeof LOCAL_PROFILE_SCHEMA_VERSION;
  profile: LocalProfile;
}

export class ProfileBackupError extends Error {
  readonly code:
    | 'backup_too_large'
    | 'invalid_json'
    | 'invalid_backup'
    | 'unsupported_backup'
    | 'restore_failed';
  readonly issues: readonly string[];

  constructor(code: ProfileBackupError['code'], message: string, issues: readonly string[] = []) {
    super(message);
    this.name = 'ProfileBackupError';
    this.code = code;
    this.issues = issues;
  }
}

export interface RestorePortableBackupSuccess {
  ok: true;
  profile: LocalProfile;
  preRestoreSnapshotId?: string;
}

export interface RestorePortableBackupFailure {
  ok: false;
  error: ProfileBackupError;
}

export type RestorePortableBackupResult =
  RestorePortableBackupSuccess | RestorePortableBackupFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeyErrors(value: Record<string, unknown>): string[] {
  const allowed = new Set([
    'format',
    'schemaVersion',
    'createdAt',
    'catalogVersion',
    'profileSchemaVersion',
    'profile',
  ]);
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `backup.${key} is not part of this schema.`);
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isVersionString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= 128 &&
    !hasControlCharacters(value)
  );
}

function textBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function createPortableProfileBackup(
  profile: LocalProfile,
  catalogVersion: string,
  now: () => Date = () => new Date(),
): PortableProfileBackup {
  const validation = validateLocalProfile(profile);
  if (!validation.ok || !validation.profile) {
    throw new ProfileBackupError(
      'invalid_backup',
      'The current profile is invalid and cannot be exported safely.',
      validation.errors,
    );
  }
  if (!isVersionString(catalogVersion)) {
    throw new ProfileBackupError('invalid_backup', 'A valid catalog version is required.');
  }
  const normalizedProfile: LocalProfile = {
    ...validation.profile,
    catalogVersion,
  };
  return {
    format: PORTABLE_BACKUP_FORMAT,
    schemaVersion: PORTABLE_BACKUP_SCHEMA_VERSION,
    createdAt: now().toISOString(),
    catalogVersion,
    profileSchemaVersion: LOCAL_PROFILE_SCHEMA_VERSION,
    profile: normalizedProfile,
  };
}

export function serializePortableProfileBackup(backup: PortableProfileBackup): string {
  const validated = validatePortableProfileBackup(backup);
  if (!validated.ok || !validated.backup) {
    throw new ProfileBackupError(
      'invalid_backup',
      'The backup could not be serialized because it is invalid.',
      validated.errors,
    );
  }
  const output = JSON.stringify(validated.backup, null, 2);
  if (textBytes(output) > MAX_PORTABLE_BACKUP_BYTES) {
    throw new ProfileBackupError(
      'backup_too_large',
      'The portable backup is larger than 5 MB and was not created.',
    );
  }
  return output;
}

export function createPortableProfileBackupJson(
  profile: LocalProfile,
  catalogVersion: string,
  now: () => Date = () => new Date(),
): string {
  return serializePortableProfileBackup(createPortableProfileBackup(profile, catalogVersion, now));
}

export function validatePortableProfileBackup(value: unknown): {
  ok: boolean;
  errors: readonly string[];
  backup?: PortableProfileBackup;
} {
  if (!isRecord(value)) return { ok: false, errors: ['backup must be an object.'] };
  const errors = unknownKeyErrors(value);
  if (value.format !== PORTABLE_BACKUP_FORMAT) errors.push('backup.format is not CatchGrid.');
  if (value.schemaVersion !== PORTABLE_BACKUP_SCHEMA_VERSION) {
    errors.push('backup.schemaVersion is not supported.');
  }
  if (!isDateString(value.createdAt)) errors.push('backup.createdAt must be a valid date.');
  if (!isVersionString(value.catalogVersion)) errors.push('backup.catalogVersion is invalid.');
  if (value.profileSchemaVersion !== LOCAL_PROFILE_SCHEMA_VERSION) {
    errors.push('backup.profileSchemaVersion is not supported.');
  }
  const profileValidation = validateLocalProfile(value.profile);
  errors.push(...profileValidation.errors.map((error) => `backup ${error}`));
  if (
    profileValidation.profile?.catalogVersion !== undefined &&
    profileValidation.profile.catalogVersion !== value.catalogVersion
  ) {
    errors.push('backup catalog versions do not match.');
  }
  return errors.length === 0
    ? { ok: true, errors, backup: value as unknown as PortableProfileBackup }
    : { ok: false, errors };
}

export function parsePortableProfileBackup(input: string): PortableProfileBackup {
  if (textBytes(input) > MAX_PORTABLE_BACKUP_BYTES) {
    throw new ProfileBackupError('backup_too_large', 'Portable backups are limited to 5 MB.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    throw new ProfileBackupError(
      'invalid_json',
      error instanceof Error ? `The backup is not valid JSON: ${error.message}` : 'Invalid JSON.',
    );
  }
  const validation = validatePortableProfileBackup(parsed);
  if (!validation.ok || !validation.backup) {
    const unsupported =
      isRecord(parsed) &&
      (parsed.format !== PORTABLE_BACKUP_FORMAT ||
        parsed.schemaVersion !== PORTABLE_BACKUP_SCHEMA_VERSION);
    throw new ProfileBackupError(
      unsupported ? 'unsupported_backup' : 'invalid_backup',
      unsupported
        ? 'This is not a supported CatchGrid backup.'
        : 'The backup failed integrity validation.',
      validation.errors,
    );
  }
  return validation.backup;
}

function failedRestore(
  result: Extract<LocalProfileSaveResult, { ok: false }>,
): RestorePortableBackupFailure {
  return {
    ok: false,
    error: new ProfileBackupError('restore_failed', result.error.message, [result.error.code]),
  };
}

/**
 * Restores a complete portable profile. The current valid profile is snapshotted
 * first. A corrupt primary may be replaced only through this explicit API; its
 * raw payload has already been preserved by loadLocalProfileResult.
 */
export function restorePortableProfileBackup(
  backupInput: string | PortableProfileBackup,
  storage?: LocalStorageLike,
  now: () => Date = () => new Date(),
): RestorePortableBackupResult {
  let backup: PortableProfileBackup;
  try {
    backup =
      typeof backupInput === 'string'
        ? parsePortableProfileBackup(backupInput)
        : (() => {
            const validation = validatePortableProfileBackup(backupInput);
            if (!validation.ok || !validation.backup) {
              throw new ProfileBackupError(
                'invalid_backup',
                'The backup failed integrity validation.',
                validation.errors,
              );
            }
            return validation.backup;
          })();
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ProfileBackupError
          ? error
          : new ProfileBackupError('invalid_backup', 'The backup could not be read.'),
    };
  }

  const loaded = loadLocalProfileResult(storage, now);
  const restoredAt = now().toISOString();
  const profile: LocalProfile = {
    ...backup.profile,
    catalogVersion: backup.catalogVersion,
    revision: Math.max(backup.profile.revision, loaded.profile.revision) + 1,
    migrationMetadata: {
      ...backup.profile.migrationMetadata,
      lastRestoredAt: restoredAt,
    },
  };
  const saved = saveLocalProfileSafely(profile, {
    storage,
    now,
    createSnapshot: loaded.status !== 'empty' && loaded.status !== 'unavailable',
    forceSnapshot: true,
    snapshotReason: 'Before restoring a portable backup',
    allowCorruptOverwrite: true,
  });
  if (!saved.ok) return failedRestore(saved);
  return {
    ok: true,
    profile: saved.profile,
    preRestoreSnapshotId: saved.snapshotId,
  };
}
