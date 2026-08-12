import type { CategoryId, CollectionEntry, TradeSpecimen, WantedEntry } from '../../shared/types';

const STORAGE_KEY = 'dexly:local-profile:v1';

export interface LocalProfile {
  version: 1;
  revision: number;
  collectionEntries: CollectionEntry[];
  wantedEntries: WantedEntry[];
  tradeSpecimens: TradeSpecimen[];
}

function emptyProfile(): LocalProfile {
  return {
    version: 1,
    revision: 0,
    collectionEntries: [],
    wantedEntries: [],
    tradeSpecimens: [],
  };
}

export function loadLocalProfile(): LocalProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<LocalProfile>;
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.revision) ||
      !Array.isArray(parsed.collectionEntries) ||
      !Array.isArray(parsed.wantedEntries) ||
      !Array.isArray(parsed.tradeSpecimens)
    ) {
      return emptyProfile();
    }
    return parsed as LocalProfile;
  } catch {
    return emptyProfile();
  }
}

export function saveLocalProfile(profile: LocalProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function replaceLocalCollection(entries: readonly CollectionEntry[]): LocalProfile {
  const profile = loadLocalProfile();
  const next = {
    ...profile,
    revision: profile.revision + 1,
    collectionEntries: [...entries],
  };
  saveLocalProfile(next);
  return next;
}

export function localProfileStorageKey(): string {
  return STORAGE_KEY;
}

export function isLocalCollectionEntry(value: unknown): value is CollectionEntry {
  const entry = value as Partial<CollectionEntry>;
  return (
    typeof entry?.formId === 'string' &&
    typeof entry.categoryId === 'string' &&
    typeof entry.collected === 'boolean'
  );
}

export function localCollectionKey(formId: string, categoryId: CategoryId): string {
  return `${formId}:${categoryId}`;
}
