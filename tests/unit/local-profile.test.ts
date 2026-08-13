import { describe, expect, it } from 'vitest';

import { previewCanonicalWideCsv } from '../../shared/csv';
import type { CatalogItem, CategoryId, RuleState } from '../../shared/types';
import {
  LEGACY_LOCAL_PROFILE_STORAGE_KEY,
  LOCAL_PROFILE_CORRUPT_PREFIX,
  LOCAL_PROFILE_STORAGE_KEY,
  applyLocalCsvImport,
  createLocalProfileSnapshot,
  emptyLocalProfile,
  listLocalProfileSnapshots,
  loadLocalProfileResult,
  removeLocalSavedSearch,
  resetCorruptLocalProfile,
  restoreLocalProfileSnapshot,
  saveLocalProfileSafely,
  updateLocalProfileSettings,
  upsertLocalSavedSearch,
  validateLocalProfile,
} from '../../src/lib/localProfile';
import type {
  LegacyLocalProfile,
  LocalProfile,
  LocalStorageLike,
} from '../../src/lib/localProfile';
import {
  createPortableProfileBackupJson,
  parsePortableProfileBackup,
  restorePortableProfileBackup,
} from '../../src/lib/profileBackup';
import type { SavedSearch } from '../../src/lib/savedSearches';

class MemoryStorage implements LocalStorageLike {
  readonly values = new Map<string, string>();
  failGet: unknown;
  failSetKey: string | undefined;
  failSetError: unknown;

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    if (this.failGet) throw this.failGet;
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (key === this.failSetKey) throw this.failSetError;
    this.values.set(key, value);
  }
}

function at(value = '2026-08-13T12:00:00.000Z'): () => Date {
  return () => new Date(value);
}

function savedSearch(id = 'search:missing-shiny'): SavedSearch {
  return {
    id,
    name: 'Missing shiny',
    query: '!traded&shiny&1-151',
    quality: 'exact',
    interpretation: 'Untraded shiny Kanto Pokemon.',
    builder: {
      version: 1,
      join: 'and',
      clauses: [
        { id: 'clause:1', polarity: 'exclude', term: 'traded' },
        { id: 'clause:2', polarity: 'include', term: 'shiny' },
      ],
    },
    createdAt: '2026-08-13T12:00:00.000Z',
    updatedAt: '2026-08-13T12:00:00.000Z',
  };
}

function profile(overrides: Partial<LocalProfile> = {}): LocalProfile {
  return {
    ...emptyLocalProfile(at()),
    catalogVersion: '2026-08-13.1',
    ...overrides,
  };
}

function catalogItem(
  id: string,
  dexNumber: number,
  name: string,
  overrides: Partial<CatalogItem> = {},
): CatalogItem {
  const allReleased = Object.fromEntries(
    ['normal', 'shiny', 'lucky', 'hundo', 'xxl', 'xxs', 'shadow', 'purified'].map((category) => [
      category,
      'released',
    ]),
  ) as Record<CategoryId, RuleState>;
  return {
    id,
    speciesId: `species:${dexNumber}`,
    dexNumber,
    name,
    formKey: 'standard',
    generation: 1,
    region: 'kanto',
    types: ['grass'],
    isDefault: true,
    variantKind: 'standard',
    collectorGroupId: `species:${dexNumber}`,
    isReleased: true,
    isTradeable: true,
    formSortOrder: 0,
    searchExact: true,
    rules: allReleased,
    ...overrides,
  };
}

describe('versioned local profiles', () => {
  it('migrates and preserves every valid v1 record without deleting the legacy source', () => {
    const storage = new MemoryStorage();
    const legacy: LegacyLocalProfile = {
      version: 1,
      revision: 7,
      collectionEntries: [{ formId: '001_STANDARD', categoryId: 'normal', collected: true }],
      wantedEntries: [
        { formId: '004_STANDARD', categoryId: 'shiny', wanted: true, notes: 'legacy' },
      ],
      tradeSpecimens: [{ id: 'trade:1', formId: '007_STANDARD', traits: ['xxl'], quantity: 1 }],
    };
    storage.setItem(LEGACY_LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(legacy));

    const result = loadLocalProfileResult(storage, at());

    expect(result.status).toBe('migrated');
    expect(result.profile).toMatchObject({
      version: 2,
      revision: 7,
      collectionEntries: legacy.collectionEntries,
      wantedEntries: legacy.wantedEntries,
      tradeSpecimens: legacy.tradeSpecimens,
      formCollectionEntries: [],
      savedSearches: [],
    });
    expect(result.profile.migrationMetadata.history[0]).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      sourceKey: LEGACY_LOCAL_PROFILE_STORAGE_KEY,
    });
    expect(storage.getItem(LEGACY_LOCAL_PROFILE_STORAGE_KEY)).toBe(JSON.stringify(legacy));
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).not.toBeNull();
  });

  it('migrates legacy appearance and active-category preferences into portable settings', () => {
    const storage = new MemoryStorage();
    storage.setItem('dexly:theme', 'dark');
    storage.setItem('dexly:accent-theme', 'orange');
    storage.setItem('dexly:active-category', 'shiny');

    const result = loadLocalProfileResult(storage, at());

    expect(result.status).toBe('migrated');
    expect(result.profile.settings).toEqual({
      theme: 'dark',
      accentTheme: 'orange',
      activeCategory: 'shiny',
    });
    expect(result.profile.migrationMetadata.migratedFrom).toBe('dexly:appearance-settings');
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).not.toBeNull();
  });

  it('preserves corrupt raw data instead of silently overwriting it', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, '{not-json');

    const result = loadLocalProfileResult(storage, at());

    expect(result.status).toBe('corrupt');
    expect(result.recovery).toMatchObject({
      sourceKey: LOCAL_PROFILE_STORAGE_KEY,
      rawPayload: '{not-json',
    });
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBe('{not-json');
    expect(
      [...storage.values.keys()].some((key) => key.startsWith(LOCAL_PROFILE_CORRUPT_PREFIX)),
    ).toBe(true);
    const save = saveLocalProfileSafely(profile(), { storage, now: at() });
    expect(save).toMatchObject({ ok: false, error: { code: 'corrupt_existing_profile' } });
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBe('{not-json');
  });

  it('resets a corrupt profile only through an explicit recovery action', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, '{not-json');

    const reset = resetCorruptLocalProfile(storage, at());

    expect(reset.ok).toBe(true);
    expect(loadLocalProfileResult(storage, at())).toMatchObject({
      status: 'ok',
      profile: { revision: 1, collectionEntries: [] },
    });
    expect(
      [...storage.values.keys()].some((key) => key.startsWith(LOCAL_PROFILE_CORRUPT_PREFIX)),
    ).toBe(true);
  });

  it('rejects invalid categories, booleans, duplicate records, and revisions', () => {
    const invalid = {
      ...profile(),
      revision: -1,
      collectionEntries: [
        { formId: '001_STANDARD', categoryId: 'made-up', collected: 'yes' },
        { formId: '001_STANDARD', categoryId: 'made-up', collected: true },
      ],
      formCollectionEntries: [{ formId: '001_PARTY', categoryId: 'lucky', collected: true }],
    };

    const result = validateLocalProfile(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('revision');
    expect(result.errors.join(' ')).toContain('categoryId');
    expect(result.errors.join(' ')).toContain('collected');
    expect(result.errors.join(' ')).toContain('duplicates');
  });

  it('reports disabled storage and quota failures without claiming persistence', () => {
    const disabled = new MemoryStorage();
    disabled.failGet = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    expect(loadLocalProfileResult(disabled, at())).toMatchObject({ status: 'unavailable' });

    const full = new MemoryStorage();
    full.failSetKey = LOCAL_PROFILE_STORAGE_KEY;
    full.failSetError = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    const saved = saveLocalProfileSafely(profile(), { storage: full, now: at() });
    expect(saved).toMatchObject({ ok: false, error: { code: 'quota_exceeded' } });
    expect(full.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('keeps migrated v1 data in memory but reports unavailable when upgrade persistence fails', () => {
    const storage = new MemoryStorage();
    const legacy: LegacyLocalProfile = {
      version: 1,
      revision: 2,
      collectionEntries: [{ formId: '001_STANDARD', categoryId: 'normal', collected: true }],
      wantedEntries: [],
      tradeSpecimens: [],
    };
    storage.setItem(LEGACY_LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(legacy));
    storage.failSetKey = LOCAL_PROFILE_STORAGE_KEY;
    storage.failSetError = Object.assign(new Error('full'), { name: 'QuotaExceededError' });

    const result = loadLocalProfileResult(storage, at());

    expect(result.status).toBe('unavailable');
    expect(result.profile.collectionEntries).toEqual(legacy.collectionEntries);
    expect(result.warnings[0]).toContain('storage is full');
    expect(storage.getItem(LEGACY_LOCAL_PROFILE_STORAGE_KEY)).toBe(JSON.stringify(legacy));
  });

  it('merges a compatibility v1 save without erasing v2 forms, searches, or settings', () => {
    const storage = new MemoryStorage();
    const current = profile({
      formCollectionEntries: [{ formId: '037_ALOLA', categoryId: 'shiny', collected: true }],
      savedSearches: [savedSearch()],
      settings: { theme: 'dark', accentTheme: 'purple' },
    });
    expect(saveLocalProfileSafely(current, { storage, now: at(), createSnapshot: false }).ok).toBe(
      true,
    );

    const legacyInput: LegacyLocalProfile = {
      version: 1,
      revision: 4,
      collectionEntries: [{ formId: '004_STANDARD', categoryId: 'normal', collected: true }],
      wantedEntries: [],
      tradeSpecimens: [],
    };
    const saved = saveLocalProfileSafely(legacyInput, {
      storage,
      now: at('2026-08-13T12:01:01.000Z'),
    });

    expect(saved.ok && saved.profile).toMatchObject({
      version: 2,
      revision: 4,
      formCollectionEntries: current.formCollectionEntries,
      savedSearches: current.savedSearches,
      settings: current.settings,
    });
  });
});

describe('snapshots, imports, and restore', () => {
  it('keeps a rotating set of five valid recovery snapshots', () => {
    const storage = new MemoryStorage();
    for (let index = 0; index < 7; index += 1) {
      const current = profile({ revision: index });
      const result = createLocalProfileSnapshot(
        current,
        `Checkpoint ${index}`,
        storage,
        at(`2026-08-13T12:0${index}:00.000Z`),
      );
      expect(result.ok).toBe(true);
    }

    const snapshots = listLocalProfileSnapshots(storage);
    expect(snapshots).toHaveLength(5);
    expect(snapshots.map((item) => item.reason)).toEqual([
      'Checkpoint 6',
      'Checkpoint 5',
      'Checkpoint 4',
      'Checkpoint 3',
      'Checkpoint 2',
    ]);
  });

  it('restores a valid snapshot over a corrupt primary after preserving its raw payload', () => {
    const storage = new MemoryStorage();
    const checkpoint = profile({
      collectionEntries: [{ formId: '001_STANDARD', categoryId: 'normal', collected: true }],
    });
    const snapshot = createLocalProfileSnapshot(checkpoint, 'Known good', storage, at());
    expect(snapshot.ok).toBe(true);
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, '{broken');
    expect(loadLocalProfileResult(storage, at()).status).toBe('corrupt');

    const restored = restoreLocalProfileSnapshot(
      snapshot.ok ? (snapshot.snapshotId ?? '') : '',
      storage,
      at('2026-08-13T12:04:00.000Z'),
    );

    expect(restored.ok).toBe(true);
    if (restored.ok)
      expect(restored.profile.collectionEntries).toEqual(checkpoint.collectionEntries);
    expect(
      [...storage.values.keys()].some((key) => key.startsWith(LOCAL_PROFILE_CORRUPT_PREFIX)),
    ).toBe(true);
  });

  it('applies default and alternate form CSV changes with a rollback snapshot', () => {
    const storage = new MemoryStorage();
    const initial = profile();
    expect(saveLocalProfileSafely(initial, { storage, now: at(), createSnapshot: false }).ok).toBe(
      true,
    );
    const catalog = [
      catalogItem('037_STANDARD', 37, 'Vulpix'),
      catalogItem('037_ALOLA', 37, 'Vulpix', {
        formKey: 'alola',
        formName: 'Alolan',
        isDefault: false,
      }),
    ];
    const csv = [
      'form_id,name,normal,shiny',
      '037_STANDARD,Vulpix,true,',
      '037_ALOLA,Vulpix Alolan,true,true',
    ].join('\n');
    const preview = previewCanonicalWideCsv(csv, catalog, initial.collectionEntries, 'merge');

    const applied = applyLocalCsvImport(initial, preview, catalog, 'forms.csv', {
      storage,
      now: at('2026-08-13T12:02:00.000Z'),
    });

    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.profile.collectionEntries).toEqual([
      { formId: '037_STANDARD', categoryId: 'normal', collected: true },
    ]);
    expect(applied.profile.formCollectionEntries).toEqual([
      { formId: '037_ALOLA', categoryId: 'normal', collected: true },
      { formId: '037_ALOLA', categoryId: 'shiny', collected: true },
    ]);
    expect(applied.snapshotId).toBeTruthy();

    const restored = restoreLocalProfileSnapshot(
      applied.snapshotId ?? '',
      storage,
      at('2026-08-13T12:03:00.000Z'),
    );
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.profile.collectionEntries).toEqual([]);
      expect(restored.profile.formCollectionEntries).toEqual([]);
    }
  });

  it('blocks an alternate-form category outside Regular and Shiny at apply time', () => {
    const storage = new MemoryStorage();
    const initial = profile();
    const catalog = [
      catalogItem('006_MEGA_X', 6, 'Charizard', {
        formKey: 'mega-x',
        formName: 'Mega X',
        isDefault: false,
      }),
    ];
    const preview = previewCanonicalWideCsv('form_id,lucky\n006_MEGA_X,true', catalog, [], 'merge');

    const applied = applyLocalCsvImport(initial, preview, catalog, 'invalid.csv', { storage });

    expect(applied).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBeNull();
  });
});

describe('portable backups and saved search persistence', () => {
  it('round-trips all Phase B profile data and creates a pre-restore snapshot', () => {
    const storage = new MemoryStorage();
    const original = profile({
      revision: 8,
      collectionEntries: [{ formId: '001_STANDARD', categoryId: 'normal', collected: true }],
      formCollectionEntries: [{ formId: '201_EXCLAMATION', categoryId: 'shiny', collected: true }],
      savedSearches: [savedSearch()],
      settings: { theme: 'dark', accentTheme: 'blue' },
    });
    const json = createPortableProfileBackupJson(original, '2026-08-13.1', at());
    const parsed = parsePortableProfileBackup(json);
    expect(parsed.profile).toMatchObject({
      collectionEntries: original.collectionEntries,
      formCollectionEntries: original.formCollectionEntries,
      savedSearches: original.savedSearches,
      settings: original.settings,
      migrationMetadata: original.migrationMetadata,
    });

    const current = profile({ revision: 12, settings: { theme: 'light', accentTheme: 'red' } });
    expect(saveLocalProfileSafely(current, { storage, now: at(), createSnapshot: false }).ok).toBe(
      true,
    );
    const restored = restorePortableProfileBackup(json, storage, at('2026-08-13T12:05:00.000Z'));

    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.profile.revision).toBe(13);
    expect(restored.profile.formCollectionEntries).toEqual(original.formCollectionEntries);
    expect(restored.profile.savedSearches).toEqual(original.savedSearches);
    expect(restored.profile.settings).toEqual(original.settings);
    expect(restored.preRestoreSnapshotId).toBeTruthy();
  });

  it('rejects malformed, unsupported, and internally inconsistent backups', () => {
    expect(() => parsePortableProfileBackup('{')).toThrow('not valid JSON');
    expect(() => parsePortableProfileBackup('{"format":"somewhere-else"}')).toThrow(
      'not a supported CatchGrid backup',
    );
    const json = createPortableProfileBackupJson(profile(), '2026-08-13.1', at());
    const value = JSON.parse(json) as { catalogVersion: string };
    value.catalogVersion = 'different';
    expect(() => parsePortableProfileBackup(JSON.stringify(value))).toThrow('integrity validation');
  });

  it('upserts, removes, and backs up saved searches without in-memory-only success', () => {
    const storage = new MemoryStorage();
    const initial = profile();
    expect(saveLocalProfileSafely(initial, { storage, now: at(), createSnapshot: false }).ok).toBe(
      true,
    );
    const added = upsertLocalSavedSearch(initial, savedSearch(), {
      storage,
      now: at('2026-08-13T12:01:00.000Z'),
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.profile.savedSearches).toHaveLength(1);

    const themed = updateLocalProfileSettings(
      added.profile,
      { theme: 'dark', accentTheme: 'pink' },
      { storage, now: at('2026-08-13T12:02:00.000Z') },
    );
    expect(themed.ok && themed.profile.settings).toEqual({ theme: 'dark', accentTheme: 'pink' });
    if (!themed.ok) return;

    const removed = removeLocalSavedSearch(themed.profile, savedSearch().id, {
      storage,
      now: at('2026-08-13T12:03:00.000Z'),
    });
    expect(removed.ok && removed.profile.savedSearches).toEqual([]);
  });
});
