import { CATEGORY_IDS, TRADE_OFFER_TRAIT_IDS, TRADE_REQUEST_TRAIT_IDS } from '../../shared/types';
import type {
  CatalogItem,
  CategoryId,
  CollectionEntry,
  TradeOfferTrait,
  TradeSpecimen,
  WantedEntry,
} from '../../shared/types';
import type { CsvImportPreview } from '../../shared/csv';
import { validateSavedSearch } from './savedSearches';
import type { SavedSearch } from './savedSearches';
import { ACCENT_THEMES, type AccentTheme } from './theme';

export const LOCAL_PROFILE_SCHEMA_VERSION = 2 as const;
export const LEGACY_LOCAL_PROFILE_STORAGE_KEY = 'dexly:local-profile:v1';
export const LOCAL_PROFILE_STORAGE_KEY = 'catchgrid:local-profile:v2';
export const LOCAL_PROFILE_SNAPSHOT_PREFIX = 'catchgrid:local-profile:snapshot:v2:';
export const LOCAL_PROFILE_CORRUPT_PREFIX = 'catchgrid:local-profile:corrupt:';
export const MAX_LOCAL_PROFILE_SNAPSHOTS = 5;

const LEGACY_THEME_STORAGE_KEY = 'dexly:theme';
const LEGACY_ACCENT_STORAGE_KEY = 'dexly:accent-theme';
const LEGACY_ACTIVE_CATEGORY_STORAGE_KEY = 'dexly:active-category';

const SNAPSHOT_SCHEMA_VERSION = 1 as const;
const AUTOMATIC_SNAPSHOT_INTERVAL_MS = 60_000;
const CATEGORY_ID_SET = new Set<string>(CATEGORY_IDS);
const TRADE_REQUEST_TRAIT_SET = new Set<string>(TRADE_REQUEST_TRAIT_IDS);
const TRADE_OFFER_TRAIT_SET = new Set<string>(TRADE_OFFER_TRAIT_IDS);
const FORM_COLLECTION_CATEGORY_SET = new Set<string>(['normal', 'shiny']);
export type FormCollectionCategoryId = 'normal' | 'shiny';
export type AppearanceTheme = 'light' | 'dark';

export interface FormCollectionEntry {
  formId: string;
  categoryId: FormCollectionCategoryId;
  collected: boolean;
  updatedAt?: string;
}

export interface LocalProfileSettings {
  theme?: AppearanceTheme;
  accentTheme?: AccentTheme;
  activeCategory?: CategoryId;
}

export interface LocalProfileMigrationEvent {
  fromVersion: number;
  toVersion: typeof LOCAL_PROFILE_SCHEMA_VERSION;
  at: string;
  sourceKey?: string;
}

export interface LocalProfileMigrationMetadata {
  createdAt: string;
  migratedAt?: string;
  migratedFrom?: string;
  lastRestoredAt?: string;
  history: readonly LocalProfileMigrationEvent[];
}

export interface LocalProfile {
  version: typeof LOCAL_PROFILE_SCHEMA_VERSION;
  revision: number;
  catalogVersion?: string;
  collectionEntries: CollectionEntry[];
  formCollectionEntries: FormCollectionEntry[];
  savedSearches: SavedSearch[];
  settings: LocalProfileSettings;
  migrationMetadata: LocalProfileMigrationMetadata;
  /** Retained during the v1 migration so an upgrade never deletes user data. */
  wantedEntries: WantedEntry[];
  /** Retained during the v1 migration so an upgrade never deletes user data. */
  tradeSpecimens: TradeSpecimen[];
}

export interface LegacyLocalProfile {
  version: 1;
  revision: number;
  collectionEntries: CollectionEntry[];
  wantedEntries: WantedEntry[];
  tradeSpecimens: TradeSpecimen[];
}

export interface LocalStorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export type LocalProfileLoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'unavailable';

export interface LocalProfileRecoveryPayload {
  sourceKey: string;
  rawPayload: string;
  preservedKey?: string;
  reason: string;
}

export interface LocalProfileLoadResult {
  status: LocalProfileLoadStatus;
  profile: LocalProfile;
  sourceKey?: string;
  recovery?: LocalProfileRecoveryPayload;
  warnings: readonly string[];
}

export type LocalProfileStorageErrorCode =
  | 'storage_unavailable'
  | 'quota_exceeded'
  | 'serialization_failed'
  | 'validation_failed'
  | 'snapshot_failed'
  | 'corrupt_existing_profile';

export class LocalProfileStorageError extends Error {
  readonly code: LocalProfileStorageErrorCode;
  readonly causeValue?: unknown;

  constructor(code: LocalProfileStorageErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'LocalProfileStorageError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export interface LocalProfileSaveSuccess {
  ok: true;
  profile: LocalProfile;
  snapshotId?: string;
}

export interface LocalProfileSaveFailure {
  ok: false;
  error: LocalProfileStorageError;
}

export type LocalProfileSaveResult = LocalProfileSaveSuccess | LocalProfileSaveFailure;

export interface LocalProfileSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  reason: string;
  catalogVersion?: string;
  profile: LocalProfile;
}

export interface LocalProfileValidationResult {
  ok: boolean;
  errors: readonly string[];
  profile?: LocalProfile;
}

export interface LocalProfileSaveOptions {
  storage?: LocalStorageLike;
  now?: () => Date;
  createSnapshot?: boolean;
  forceSnapshot?: boolean;
  snapshotReason?: string;
  /** Only use after the caller has shown and preserved the corrupt raw payload. */
  allowCorruptOverwrite?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeyErrors(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): string[] {
  const allowedKeys = new Set(allowed);
  return Object.keys(value)
    .filter((key) => !allowedKeys.has(key))
    .map((key) => `${path}.${key} is not part of this schema.`);
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function isSafeId(value: unknown, maximum = 256): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !hasControlCharacters(value)
  );
}

function isOptionalString(value: unknown, maximum: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maximum);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function isNonNegativeRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function uniqueId(prefix: string, date: Date): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}${date.getTime().toString(36)}-${random}`;
}

export function emptyLocalProfile(now: () => Date = () => new Date()): LocalProfile {
  return {
    version: LOCAL_PROFILE_SCHEMA_VERSION,
    revision: 0,
    collectionEntries: [],
    formCollectionEntries: [],
    savedSearches: [],
    settings: {},
    migrationMetadata: {
      createdAt: nowIso(now),
      history: [],
    },
    wantedEntries: [],
    tradeSpecimens: [],
  };
}

function validateCollectionEntries(
  value: unknown,
  path: string,
  allowedCategories: ReadonlySet<string>,
  allowProfileId = true,
): string[] {
  if (!Array.isArray(value)) return [`${path} must be an array.`];
  const errors: string[] = [];
  const keys = new Set<string>();
  value.forEach((candidate, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${itemPath} must be an object.`);
      return;
    }
    errors.push(
      ...unknownKeyErrors(
        candidate,
        allowProfileId
          ? ['profileId', 'formId', 'categoryId', 'collected', 'updatedAt']
          : ['formId', 'categoryId', 'collected', 'updatedAt'],
        itemPath,
      ),
    );
    if (!isSafeId(candidate.formId)) errors.push(`${itemPath}.formId is invalid.`);
    if (!allowedCategories.has(String(candidate.categoryId))) {
      errors.push(`${itemPath}.categoryId is not supported.`);
    }
    if (typeof candidate.collected !== 'boolean') {
      errors.push(`${itemPath}.collected must be a boolean.`);
    }
    if (candidate.updatedAt !== undefined && !isDateString(candidate.updatedAt)) {
      errors.push(`${itemPath}.updatedAt must be a valid date.`);
    }
    if (candidate.profileId !== undefined && !isSafeId(candidate.profileId)) {
      errors.push(`${itemPath}.profileId is invalid.`);
    }
    if (isSafeId(candidate.formId) && typeof candidate.categoryId === 'string') {
      const key = localCollectionKey(candidate.formId, candidate.categoryId);
      if (keys.has(key)) errors.push(`${itemPath} duplicates ${candidate.formId}.`);
      keys.add(key);
    }
  });
  return errors;
}

function validateWantedEntries(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) return [`${path} must be an array.`];
  const errors: string[] = [];
  value.forEach((candidate, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${itemPath} must be an object.`);
      return;
    }
    errors.push(
      ...unknownKeyErrors(
        candidate,
        ['id', 'profileId', 'formId', 'categoryId', 'wanted', 'notes', 'updatedAt'],
        itemPath,
      ),
    );
    if (!isSafeId(candidate.formId)) errors.push(`${itemPath}.formId is invalid.`);
    if (
      candidate.categoryId !== undefined &&
      !TRADE_REQUEST_TRAIT_SET.has(String(candidate.categoryId))
    ) {
      errors.push(`${itemPath}.categoryId is not supported.`);
    }
    if (typeof candidate.wanted !== 'boolean') errors.push(`${itemPath}.wanted must be a boolean.`);
    if (candidate.id !== undefined && !isSafeId(candidate.id))
      errors.push(`${itemPath}.id is invalid.`);
    if (candidate.profileId !== undefined && !isSafeId(candidate.profileId)) {
      errors.push(`${itemPath}.profileId is invalid.`);
    }
    if (!isOptionalString(candidate.notes, 5_000)) errors.push(`${itemPath}.notes is too long.`);
    if (candidate.updatedAt !== undefined && !isDateString(candidate.updatedAt)) {
      errors.push(`${itemPath}.updatedAt must be a valid date.`);
    }
  });
  return errors;
}

function validateTradeSpecimens(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) return [`${path} must be an array.`];
  const errors: string[] = [];
  const ids = new Set<string>();
  value.forEach((candidate, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${itemPath} must be an object.`);
      return;
    }
    errors.push(
      ...unknownKeyErrors(
        candidate,
        ['id', 'profileId', 'formId', 'traits', 'quantity', 'notes', 'verifiedAt'],
        itemPath,
      ),
    );
    if (!isSafeId(candidate.id)) {
      errors.push(`${itemPath}.id is invalid.`);
    } else if (ids.has(candidate.id)) {
      errors.push(`${itemPath}.id is duplicated.`);
    } else {
      ids.add(candidate.id);
    }
    if (!isSafeId(candidate.formId)) errors.push(`${itemPath}.formId is invalid.`);
    if (!Array.isArray(candidate.traits)) {
      errors.push(`${itemPath}.traits must be an array.`);
    } else if (
      candidate.traits.some((trait) => !TRADE_OFFER_TRAIT_SET.has(String(trait))) ||
      new Set(candidate.traits).size !== candidate.traits.length
    ) {
      errors.push(`${itemPath}.traits contains unsupported or duplicate values.`);
    }
    if (!Number.isSafeInteger(candidate.quantity) || (candidate.quantity as number) < 1) {
      errors.push(`${itemPath}.quantity must be a positive integer.`);
    }
    if (candidate.profileId !== undefined && !isSafeId(candidate.profileId)) {
      errors.push(`${itemPath}.profileId is invalid.`);
    }
    if (!isOptionalString(candidate.notes, 5_000)) errors.push(`${itemPath}.notes is too long.`);
    if (candidate.verifiedAt !== undefined && !isDateString(candidate.verifiedAt)) {
      errors.push(`${itemPath}.verifiedAt must be a valid date.`);
    }
  });
  return errors;
}

function validateSettings(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors = unknownKeyErrors(value, ['theme', 'accentTheme', 'activeCategory'], path);
  if (value.theme !== undefined && !['light', 'dark'].includes(String(value.theme))) {
    errors.push(`${path}.theme is not supported.`);
  }
  if (
    value.accentTheme !== undefined &&
    !ACCENT_THEMES.includes(value.accentTheme as AccentTheme)
  ) {
    errors.push(`${path}.accentTheme is not supported.`);
  }
  if (value.activeCategory !== undefined && !CATEGORY_ID_SET.has(String(value.activeCategory))) {
    errors.push(`${path}.activeCategory is not supported.`);
  }
  return errors;
}

function validateMigrationMetadata(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors = unknownKeyErrors(
    value,
    ['createdAt', 'migratedAt', 'migratedFrom', 'lastRestoredAt', 'history'],
    path,
  );
  if (!isDateString(value.createdAt)) errors.push(`${path}.createdAt must be a valid date.`);
  if (value.migratedAt !== undefined && !isDateString(value.migratedAt)) {
    errors.push(`${path}.migratedAt must be a valid date.`);
  }
  if (value.lastRestoredAt !== undefined && !isDateString(value.lastRestoredAt)) {
    errors.push(`${path}.lastRestoredAt must be a valid date.`);
  }
  if (!isOptionalString(value.migratedFrom, 256)) {
    errors.push(`${path}.migratedFrom is invalid.`);
  }
  if (!Array.isArray(value.history) || value.history.length > 100) {
    errors.push(`${path}.history must contain at most 100 migration events.`);
  } else {
    value.history.forEach((event, index) => {
      const eventPath = `${path}.history[${index}]`;
      if (!isRecord(event)) {
        errors.push(`${eventPath} must be an object.`);
        return;
      }
      errors.push(
        ...unknownKeyErrors(event, ['fromVersion', 'toVersion', 'at', 'sourceKey'], eventPath),
      );
      if (!Number.isSafeInteger(event.fromVersion) || (event.fromVersion as number) < 0) {
        errors.push(`${eventPath}.fromVersion is invalid.`);
      }
      if (event.toVersion !== LOCAL_PROFILE_SCHEMA_VERSION) {
        errors.push(`${eventPath}.toVersion is not supported.`);
      }
      if (!isDateString(event.at)) errors.push(`${eventPath}.at must be a valid date.`);
      if (!isOptionalString(event.sourceKey, 256))
        errors.push(`${eventPath}.sourceKey is invalid.`);
    });
  }
  return errors;
}

export function validateLocalProfile(value: unknown): LocalProfileValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ['profile must be an object.'] };
  const errors = unknownKeyErrors(
    value,
    [
      'version',
      'revision',
      'catalogVersion',
      'collectionEntries',
      'formCollectionEntries',
      'savedSearches',
      'settings',
      'migrationMetadata',
      'wantedEntries',
      'tradeSpecimens',
    ],
    'profile',
  );
  if (value.version !== LOCAL_PROFILE_SCHEMA_VERSION) {
    errors.push(`profile.version must be ${LOCAL_PROFILE_SCHEMA_VERSION}.`);
  }
  if (!isNonNegativeRevision(value.revision)) {
    errors.push('profile.revision must be a non-negative safe integer.');
  }
  if (!isOptionalString(value.catalogVersion, 128)) {
    errors.push('profile.catalogVersion is invalid.');
  }
  errors.push(
    ...validateCollectionEntries(
      value.collectionEntries,
      'profile.collectionEntries',
      CATEGORY_ID_SET,
    ),
  );
  errors.push(
    ...validateCollectionEntries(
      value.formCollectionEntries,
      'profile.formCollectionEntries',
      FORM_COLLECTION_CATEGORY_SET,
      false,
    ),
  );
  if (!Array.isArray(value.savedSearches)) {
    errors.push('profile.savedSearches must be an array.');
  } else {
    const ids = new Set<string>();
    value.savedSearches.forEach((search, index) => {
      errors.push(...validateSavedSearch(search, `profile.savedSearches[${index}]`));
      if (isRecord(search) && typeof search.id === 'string') {
        if (ids.has(search.id)) errors.push(`profile.savedSearches[${index}].id is duplicated.`);
        ids.add(search.id);
      }
    });
  }
  errors.push(...validateSettings(value.settings, 'profile.settings'));
  errors.push(...validateMigrationMetadata(value.migrationMetadata, 'profile.migrationMetadata'));
  errors.push(...validateWantedEntries(value.wantedEntries, 'profile.wantedEntries'));
  errors.push(...validateTradeSpecimens(value.tradeSpecimens, 'profile.tradeSpecimens'));

  return errors.length === 0
    ? { ok: true, errors, profile: value as unknown as LocalProfile }
    : { ok: false, errors };
}

function validateLegacyProfile(value: unknown): {
  ok: boolean;
  errors: string[];
  profile?: LegacyLocalProfile;
} {
  if (!isRecord(value)) return { ok: false, errors: ['legacy profile must be an object.'] };
  const errors = unknownKeyErrors(
    value,
    ['version', 'revision', 'collectionEntries', 'wantedEntries', 'tradeSpecimens'],
    'legacy',
  );
  if (value.version !== 1) errors.push('legacy profile.version must be 1.');
  if (!isNonNegativeRevision(value.revision)) {
    errors.push('legacy profile.revision must be a non-negative safe integer.');
  }
  errors.push(
    ...validateCollectionEntries(
      value.collectionEntries,
      'legacy.collectionEntries',
      CATEGORY_ID_SET,
    ),
  );
  errors.push(...validateWantedEntries(value.wantedEntries, 'legacy.wantedEntries'));
  errors.push(...validateTradeSpecimens(value.tradeSpecimens, 'legacy.tradeSpecimens'));
  return errors.length === 0
    ? { ok: true, errors, profile: value as unknown as LegacyLocalProfile }
    : { ok: false, errors };
}

export function migrateLegacyLocalProfile(
  legacy: LegacyLocalProfile,
  now: () => Date = () => new Date(),
  settings: LocalProfileSettings = {},
): LocalProfile {
  const at = nowIso(now);
  return {
    version: LOCAL_PROFILE_SCHEMA_VERSION,
    revision: legacy.revision,
    collectionEntries: [...legacy.collectionEntries],
    formCollectionEntries: [],
    savedSearches: [],
    settings,
    migrationMetadata: {
      createdAt: at,
      migratedAt: at,
      migratedFrom: LEGACY_LOCAL_PROFILE_STORAGE_KEY,
      history: [
        {
          fromVersion: 1,
          toVersion: LOCAL_PROFILE_SCHEMA_VERSION,
          at,
          sourceKey: LEGACY_LOCAL_PROFILE_STORAGE_KEY,
        },
      ],
    },
    wantedEntries: [...legacy.wantedEntries],
    tradeSpecimens: [...legacy.tradeSpecimens],
  };
}

function resolveStorage(storage?: LocalStorageLike): LocalStorageLike | undefined {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function storageError(
  error: unknown,
  fallback: LocalProfileStorageErrorCode,
): LocalProfileStorageError {
  const name = isRecord(error) && typeof error.name === 'string' ? error.name : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new LocalProfileStorageError(
      'quota_exceeded',
      'Browser storage is full. Export a backup before clearing space and trying again.',
      error,
    );
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return new LocalProfileStorageError(
      'storage_unavailable',
      'Browser storage is disabled or unavailable in this browsing mode.',
      error,
    );
  }
  return new LocalProfileStorageError(
    fallback,
    fallback === 'serialization_failed'
      ? 'The profile could not be serialized safely.'
      : 'The browser could not save the collection.',
    error,
  );
}

function storageKeys(storage: LocalStorageLike): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

function preserveCorruptPayload(
  storage: LocalStorageLike,
  sourceKey: string,
  rawPayload: string,
  reason: string,
  now: () => Date,
): LocalProfileRecoveryPayload {
  const recovery: LocalProfileRecoveryPayload = { sourceKey, rawPayload, reason };
  const date = now();
  const key = `${LOCAL_PROFILE_CORRUPT_PREFIX}${date.getTime().toString(36)}`;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 1,
        sourceKey,
        preservedAt: date.toISOString(),
        reason,
        rawPayload,
      }),
    );
    recovery.preservedKey = key;
  } catch {
    // The original key remains untouched and rawPayload is returned for immediate download.
  }
  return recovery;
}

function parseJson(raw: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(raw) as unknown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

function readLegacySettings(storage: LocalStorageLike): LocalProfileSettings {
  try {
    const theme = storage.getItem(LEGACY_THEME_STORAGE_KEY);
    const accentTheme = storage.getItem(LEGACY_ACCENT_STORAGE_KEY);
    const activeCategory = storage.getItem(LEGACY_ACTIVE_CATEGORY_STORAGE_KEY);
    return {
      ...(theme === 'light' || theme === 'dark' ? { theme } : {}),
      ...(ACCENT_THEMES.includes(accentTheme as AccentTheme)
        ? { accentTheme: accentTheme as AccentTheme }
        : {}),
      ...(CATEGORY_ID_SET.has(activeCategory ?? '')
        ? { activeCategory: activeCategory as CategoryId }
        : {}),
    };
  } catch {
    return {};
  }
}

export function loadLocalProfileResult(
  storageInput?: LocalStorageLike,
  now: () => Date = () => new Date(),
): LocalProfileLoadResult {
  const storage = resolveStorage(storageInput);
  if (!storage) {
    return {
      status: 'unavailable',
      profile: emptyLocalProfile(now),
      warnings: ['Browser storage is not available. Changes cannot be persisted.'],
    };
  }

  let currentRaw: string | null;
  try {
    currentRaw = storage.getItem(LOCAL_PROFILE_STORAGE_KEY);
  } catch (error) {
    return {
      status: 'unavailable',
      profile: emptyLocalProfile(now),
      warnings: [storageError(error, 'storage_unavailable').message],
    };
  }

  if (currentRaw !== null) {
    const parsed = parseJson(currentRaw);
    const validation = parsed.error ? undefined : validateLocalProfile(parsed.value);
    if (validation?.ok && validation.profile) {
      return {
        status: 'ok',
        profile: validation.profile,
        sourceKey: LOCAL_PROFILE_STORAGE_KEY,
        warnings: [],
      };
    }
    const reason = parsed.error ?? validation?.errors.join(' ') ?? 'The profile is invalid.';
    return {
      status: 'corrupt',
      profile: emptyLocalProfile(now),
      sourceKey: LOCAL_PROFILE_STORAGE_KEY,
      recovery: preserveCorruptPayload(storage, LOCAL_PROFILE_STORAGE_KEY, currentRaw, reason, now),
      warnings: [
        'The saved profile is corrupt. Its raw data was preserved and was not overwritten.',
      ],
    };
  }

  let legacyRaw: string | null;
  try {
    legacyRaw = storage.getItem(LEGACY_LOCAL_PROFILE_STORAGE_KEY);
  } catch (error) {
    return {
      status: 'unavailable',
      profile: emptyLocalProfile(now),
      warnings: [storageError(error, 'storage_unavailable').message],
    };
  }
  if (legacyRaw === null) {
    const legacySettings = readLegacySettings(storage);
    if (Object.keys(legacySettings).length === 0) {
      return { status: 'empty', profile: emptyLocalProfile(now), warnings: [] };
    }
    const at = nowIso(now);
    const migrated: LocalProfile = {
      ...emptyLocalProfile(() => new Date(at)),
      settings: legacySettings,
      migrationMetadata: {
        createdAt: at,
        migratedAt: at,
        migratedFrom: 'dexly:appearance-settings',
        history: [
          {
            fromVersion: 0,
            toVersion: LOCAL_PROFILE_SCHEMA_VERSION,
            at,
            sourceKey: 'dexly:appearance-settings',
          },
        ],
      },
    };
    const warnings: string[] = [];
    try {
      storage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      warnings.push(storageError(error, 'storage_unavailable').message);
    }
    return {
      status: warnings.length > 0 ? 'unavailable' : 'migrated',
      profile: migrated,
      sourceKey: 'dexly:appearance-settings',
      warnings,
    };
  }

  const parsed = parseJson(legacyRaw);
  const validation = parsed.error ? undefined : validateLegacyProfile(parsed.value);
  if (!validation?.ok || !validation.profile) {
    const reason = parsed.error ?? validation?.errors.join(' ') ?? 'The legacy profile is invalid.';
    return {
      status: 'corrupt',
      profile: emptyLocalProfile(now),
      sourceKey: LEGACY_LOCAL_PROFILE_STORAGE_KEY,
      recovery: preserveCorruptPayload(
        storage,
        LEGACY_LOCAL_PROFILE_STORAGE_KEY,
        legacyRaw,
        reason,
        now,
      ),
      warnings: [
        'The legacy profile is corrupt. Its raw data was preserved and was not overwritten.',
      ],
    };
  }

  const migrated = migrateLegacyLocalProfile(validation.profile, now, readLegacySettings(storage));
  const warnings: string[] = [];
  try {
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(migrated));
  } catch (error) {
    warnings.push(
      `${storageError(error, 'storage_unavailable').message} The legacy profile remains available.`,
    );
  }
  return {
    status: warnings.length > 0 ? 'unavailable' : 'migrated',
    profile: migrated,
    sourceKey: LEGACY_LOCAL_PROFILE_STORAGE_KEY,
    warnings,
  };
}

/** Backward-compatible profile loader. New UI should inspect loadLocalProfileResult. */
export function loadLocalProfile(storage?: LocalStorageLike): LocalProfile {
  return loadLocalProfileResult(storage).profile;
}

function validateSnapshot(value: unknown): { snapshot?: LocalProfileSnapshot; errors: string[] } {
  if (!isRecord(value)) return { errors: ['snapshot must be an object.'] };
  const errors = unknownKeyErrors(
    value,
    ['schemaVersion', 'id', 'createdAt', 'reason', 'catalogVersion', 'profile'],
    'snapshot',
  );
  if (value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION)
    errors.push('snapshot schema is unsupported.');
  if (!isSafeId(value.id)) errors.push('snapshot id is invalid.');
  if (!isDateString(value.createdAt)) errors.push('snapshot createdAt is invalid.');
  if (!isSafeId(value.reason, 500)) errors.push('snapshot reason is invalid.');
  if (!isOptionalString(value.catalogVersion, 128))
    errors.push('snapshot catalogVersion is invalid.');
  const profileValidation = validateLocalProfile(value.profile);
  errors.push(...profileValidation.errors.map((error) => `snapshot ${error}`));
  return errors.length === 0
    ? { snapshot: value as unknown as LocalProfileSnapshot, errors }
    : { errors };
}

export function listLocalProfileSnapshots(storageInput?: LocalStorageLike): LocalProfileSnapshot[] {
  const storage = resolveStorage(storageInput);
  if (!storage) return [];
  try {
    return storageKeys(storage)
      .filter((key) => key.startsWith(LOCAL_PROFILE_SNAPSHOT_PREFIX))
      .flatMap((key) => {
        const raw = storage.getItem(key);
        if (raw === null) return [];
        const parsed = parseJson(raw);
        if (parsed.error) return [];
        const validation = validateSnapshot(parsed.value);
        return validation.snapshot ? [validation.snapshot] : [];
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

function rotateSnapshots(storage: LocalStorageLike): void {
  const snapshots = listLocalProfileSnapshots(storage);
  for (const snapshot of snapshots.slice(MAX_LOCAL_PROFILE_SNAPSHOTS)) {
    storage.removeItem(`${LOCAL_PROFILE_SNAPSHOT_PREFIX}${snapshot.id}`);
  }
}

export function createLocalProfileSnapshot(
  profile: LocalProfile,
  reason: string,
  storageInput?: LocalStorageLike,
  now: () => Date = () => new Date(),
): LocalProfileSaveResult {
  const storage = resolveStorage(storageInput);
  if (!storage) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'storage_unavailable',
        'Browser storage is unavailable, so a recovery snapshot could not be created.',
      ),
    };
  }
  const validation = validateLocalProfile(profile);
  if (!validation.ok || !validation.profile) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'validation_failed',
        `The profile is invalid: ${validation.errors.join(' ')}`,
      ),
    };
  }
  if (!isSafeId(reason, 500)) {
    return {
      ok: false,
      error: new LocalProfileStorageError('validation_failed', 'A snapshot reason is required.'),
    };
  }

  const date = now();
  const id = uniqueId('snapshot-', date);
  const snapshot: LocalProfileSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    id,
    createdAt: date.toISOString(),
    reason,
    catalogVersion: profile.catalogVersion,
    profile,
  };
  try {
    storage.setItem(`${LOCAL_PROFILE_SNAPSHOT_PREFIX}${id}`, JSON.stringify(snapshot));
    rotateSnapshots(storage);
    return { ok: true, profile, snapshotId: id };
  } catch (error) {
    return { ok: false, error: storageError(error, 'snapshot_failed') };
  }
}

function mergeLegacyInput(
  legacy: LegacyLocalProfile,
  existing: LocalProfile | undefined,
  now: () => Date,
): LocalProfile {
  const migrated = migrateLegacyLocalProfile(legacy, now);
  return existing
    ? {
        ...existing,
        revision: legacy.revision,
        collectionEntries: [...legacy.collectionEntries],
        wantedEntries: [...legacy.wantedEntries],
        tradeSpecimens: [...legacy.tradeSpecimens],
      }
    : migrated;
}

function profileForSave(
  input: LocalProfile | LegacyLocalProfile,
  existing: LocalProfile | undefined,
  now: () => Date,
): LocalProfileValidationResult {
  if (input.version === 1) {
    const legacyValidation = validateLegacyProfile(input);
    if (!legacyValidation.ok || !legacyValidation.profile) {
      return { ok: false, errors: legacyValidation.errors };
    }
    const migrated = mergeLegacyInput(legacyValidation.profile, existing, now);
    return { ok: true, errors: [], profile: migrated };
  }
  return validateLocalProfile(input);
}

function shouldCreateAutomaticSnapshot(
  storage: LocalStorageLike,
  now: Date,
  force: boolean,
): boolean {
  if (force) return true;
  const latest = listLocalProfileSnapshots(storage)[0];
  return !latest || now.getTime() - Date.parse(latest.createdAt) >= AUTOMATIC_SNAPSHOT_INTERVAL_MS;
}

export function saveLocalProfileSafely(
  input: LocalProfile | LegacyLocalProfile,
  options: LocalProfileSaveOptions = {},
): LocalProfileSaveResult {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'storage_unavailable',
        'Browser storage is disabled or unavailable in this browsing mode.',
      ),
    };
  }
  const now = options.now ?? (() => new Date());
  const existingResult = loadLocalProfileResult(storage, now);
  if (existingResult.status === 'corrupt' && !options.allowCorruptOverwrite) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'corrupt_existing_profile',
        'The existing profile is corrupt and was not overwritten. Download or reset it before saving.',
      ),
    };
  }
  const existing = ['ok', 'migrated'].includes(existingResult.status)
    ? existingResult.profile
    : undefined;
  const validation = profileForSave(input, existing, now);
  if (!validation.ok || !validation.profile) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'validation_failed',
        `The profile was not saved: ${validation.errors.join(' ')}`,
      ),
    };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(validation.profile);
  } catch (error) {
    return { ok: false, error: storageError(error, 'serialization_failed') };
  }

  let snapshotId: string | undefined;
  const createSnapshot = options.createSnapshot ?? true;
  const date = now();
  if (
    createSnapshot &&
    existing &&
    shouldCreateAutomaticSnapshot(storage, date, options.forceSnapshot ?? false)
  ) {
    const snapshot = createLocalProfileSnapshot(
      existing,
      options.snapshotReason ?? 'Before an automatic collection update',
      storage,
      () => date,
    );
    if (!snapshot.ok) {
      return {
        ok: false,
        error: new LocalProfileStorageError(
          'snapshot_failed',
          `The update was not saved because its recovery snapshot failed: ${snapshot.error.message}`,
          snapshot.error,
        ),
      };
    }
    snapshotId = snapshot.snapshotId;
  }

  try {
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, serialized);
  } catch (error) {
    return { ok: false, error: storageError(error, 'storage_unavailable') };
  }
  return { ok: true, profile: validation.profile, snapshotId };
}

/** Backward-compatible writer that throws a typed error when persistence fails. */
export function saveLocalProfile(
  profile: LocalProfile | LegacyLocalProfile,
  storage?: LocalStorageLike,
): void {
  const result = saveLocalProfileSafely(profile, { storage });
  if (!result.ok) throw result.error;
}

export function replaceLocalCollection(
  entries: readonly CollectionEntry[],
  storage?: LocalStorageLike,
): LocalProfile {
  const loaded = loadLocalProfileResult(storage);
  if (loaded.status === 'corrupt' || loaded.status === 'unavailable') {
    throw new LocalProfileStorageError(
      loaded.status === 'corrupt' ? 'corrupt_existing_profile' : 'storage_unavailable',
      loaded.warnings[0] ?? 'The local profile could not be loaded safely.',
    );
  }
  const next: LocalProfile = {
    ...loaded.profile,
    revision: loaded.profile.revision + 1,
    collectionEntries: [...entries],
  };
  const saved = saveLocalProfileSafely(next, { storage });
  if (!saved.ok) throw saved.error;
  return saved.profile;
}

export function createPreImportSnapshot(
  profile: LocalProfile,
  sourceName: string,
  storage?: LocalStorageLike,
): LocalProfileSaveResult {
  return createLocalProfileSnapshot(
    profile,
    `Before CSV import: ${sourceName.trim() || 'unnamed file'}`,
    storage,
  );
}

function setCollectionEntry(
  entries: readonly CollectionEntry[],
  formId: string,
  categoryId: CategoryId,
  collected: boolean,
): CollectionEntry[] {
  const without = entries.filter(
    (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
  );
  return collected ? [...without, { formId, categoryId, collected: true }] : without;
}

function setFormCollectionEntry(
  entries: readonly FormCollectionEntry[],
  formId: string,
  categoryId: FormCollectionCategoryId,
  collected: boolean,
): FormCollectionEntry[] {
  const without = entries.filter(
    (entry) => !(entry.formId === formId && entry.categoryId === categoryId),
  );
  return collected ? [...without, { formId, categoryId, collected: true }] : without;
}

/** Applies an already validated preview and atomically persists its pre-import snapshot. */
export function applyLocalCsvImport(
  profile: LocalProfile,
  preview: CsvImportPreview,
  catalog: readonly CatalogItem[],
  sourceName: string,
  options: Omit<LocalProfileSaveOptions, 'snapshotReason' | 'forceSnapshot'> = {},
): LocalProfileSaveResult {
  if (preview.summary.rejected > 0 || preview.issues.some((issue) => issue.severity === 'error')) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'validation_failed',
        'The CSV import has unresolved errors and was not applied.',
      ),
    };
  }
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  let collectionEntries = [...profile.collectionEntries];
  let formCollectionEntries = [...profile.formCollectionEntries];
  for (const change of preview.changes) {
    if (change.disposition !== 'add' && change.disposition !== 'remove') continue;
    const item = catalogById.get(change.formId);
    if (!item) {
      return {
        ok: false,
        error: new LocalProfileStorageError(
          'validation_failed',
          `The catalog no longer contains ${change.formId}. Preview the CSV again.`,
        ),
      };
    }
    if (item.rules[change.categoryId] !== 'released' && change.after) {
      return {
        ok: false,
        error: new LocalProfileStorageError(
          'validation_failed',
          `The ${change.categoryId} state for ${item.name} is no longer collectible.`,
        ),
      };
    }
    if (item.isDefault) {
      collectionEntries = setCollectionEntry(
        collectionEntries,
        change.formId,
        change.categoryId,
        change.after,
      );
    } else {
      if (!FORM_COLLECTION_CATEGORY_SET.has(change.categoryId)) {
        return {
          ok: false,
          error: new LocalProfileStorageError(
            'validation_failed',
            'Alternate forms can track only Regular and Shiny states.',
          ),
        };
      }
      formCollectionEntries = setFormCollectionEntry(
        formCollectionEntries,
        change.formId,
        change.categoryId as FormCollectionCategoryId,
        change.after,
      );
    }
  }
  const next: LocalProfile = {
    ...profile,
    revision: profile.revision + 1,
    collectionEntries,
    formCollectionEntries,
  };
  return saveLocalProfileSafely(next, {
    ...options,
    createSnapshot: true,
    forceSnapshot: true,
    snapshotReason: `Before CSV import: ${sourceName.trim() || 'unnamed file'}`,
  });
}

export function upsertLocalSavedSearch(
  profile: LocalProfile,
  search: SavedSearch,
  options: LocalProfileSaveOptions = {},
): LocalProfileSaveResult {
  const errors = validateSavedSearch(search);
  if (errors.length > 0) {
    return {
      ok: false,
      error: new LocalProfileStorageError('validation_failed', errors.join(' ')),
    };
  }
  const next: LocalProfile = {
    ...profile,
    revision: profile.revision + 1,
    savedSearches: [...profile.savedSearches.filter((item) => item.id !== search.id), search],
  };
  return saveLocalProfileSafely(next, options);
}

export function removeLocalSavedSearch(
  profile: LocalProfile,
  searchId: string,
  options: LocalProfileSaveOptions = {},
): LocalProfileSaveResult {
  if (!isSafeId(searchId)) {
    return {
      ok: false,
      error: new LocalProfileStorageError('validation_failed', 'The saved search id is invalid.'),
    };
  }
  const remaining = profile.savedSearches.filter((item) => item.id !== searchId);
  if (remaining.length === profile.savedSearches.length) {
    return { ok: true, profile };
  }
  return saveLocalProfileSafely(
    {
      ...profile,
      revision: profile.revision + 1,
      savedSearches: remaining,
    },
    options,
  );
}

export function updateLocalProfileSettings(
  profile: LocalProfile,
  settings: LocalProfileSettings,
  options: LocalProfileSaveOptions = {},
): LocalProfileSaveResult {
  const errors = validateSettings(settings, 'settings');
  if (errors.length > 0) {
    return {
      ok: false,
      error: new LocalProfileStorageError('validation_failed', errors.join(' ')),
    };
  }
  return saveLocalProfileSafely(
    {
      ...profile,
      revision: profile.revision + 1,
      settings: { ...profile.settings, ...settings },
    },
    options,
  );
}

export function restoreLocalProfileSnapshot(
  snapshotId: string,
  storageInput?: LocalStorageLike,
  now: () => Date = () => new Date(),
): LocalProfileSaveResult {
  const storage = resolveStorage(storageInput);
  if (!storage) {
    return {
      ok: false,
      error: new LocalProfileStorageError('storage_unavailable', 'Browser storage is unavailable.'),
    };
  }
  const snapshot = listLocalProfileSnapshots(storage).find((item) => item.id === snapshotId);
  if (!snapshot) {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'validation_failed',
        'That recovery snapshot is unavailable.',
      ),
    };
  }
  const current = loadLocalProfileResult(storage, now);
  const at = nowIso(now);
  const restored: LocalProfile = {
    ...snapshot.profile,
    revision: Math.max(snapshot.profile.revision, current.profile.revision) + 1,
    migrationMetadata: {
      ...snapshot.profile.migrationMetadata,
      lastRestoredAt: at,
    },
  };
  return saveLocalProfileSafely(restored, {
    storage,
    now,
    createSnapshot: current.status !== 'corrupt' && current.status !== 'unavailable',
    forceSnapshot: true,
    snapshotReason: 'Before restoring a recovery snapshot',
    allowCorruptOverwrite: true,
  });
}

/** Explicit recovery action; loadLocalProfileResult preserves the bad raw value first. */
export function resetCorruptLocalProfile(
  storageInput?: LocalStorageLike,
  now: () => Date = () => new Date(),
): LocalProfileSaveResult {
  const storage = resolveStorage(storageInput);
  if (!storage) {
    return {
      ok: false,
      error: new LocalProfileStorageError('storage_unavailable', 'Browser storage is unavailable.'),
    };
  }
  const loaded = loadLocalProfileResult(storage, now);
  if (loaded.status !== 'corrupt') {
    return {
      ok: false,
      error: new LocalProfileStorageError(
        'validation_failed',
        'The current profile is not corrupt, so recovery reset was not applied.',
      ),
    };
  }
  const reset = emptyLocalProfile(now);
  reset.revision = 1;
  return saveLocalProfileSafely(reset, {
    storage,
    now,
    createSnapshot: false,
    allowCorruptOverwrite: true,
  });
}

export function localProfileStorageKey(): string {
  return LOCAL_PROFILE_STORAGE_KEY;
}

export function isLocalCollectionEntry(value: unknown): value is CollectionEntry {
  return validateCollectionEntries([value], 'entry', CATEGORY_ID_SET).length === 0;
}

export function localCollectionKey(formId: string, categoryId: string): string {
  return `${formId}:${categoryId}`;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORY_ID_SET.has(value);
}

export function isTradeOfferTrait(value: unknown): value is TradeOfferTrait {
  return typeof value === 'string' && TRADE_OFFER_TRAIT_SET.has(value);
}
