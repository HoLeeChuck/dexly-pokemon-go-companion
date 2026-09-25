import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// JS preview reuses production storage and CSV contracts.
import {
  collectionKeys,
  toggleCollection,
  exportBackup,
  exportCsv,
  reviewImport,
  commitImport,
} from '../../design/prism/data.js';
import { LOCAL_PROFILE_STORAGE_KEY, loadLocalProfileResult } from '../../src/lib/localProfile';
class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());
describe('Prism collection integration', () => {
  it('starts empty and persists separate species and Mega form entries', () => {
    expect(collectionKeys().size).toBe(0);
    toggleCollection('form-0006-standard', 'normal');
    toggleCollection('form-0006-mega-x', 'normal');
    const p = loadLocalProfileResult(storage).profile;
    expect(p.collectionEntries).toHaveLength(1);
    expect(p.formCollectionEntries).toHaveLength(1);
    expect(collectionKeys().size).toBe(2);
  });
  it('keeps transformation collection separate from base size and other forms', () => {
    toggleCollection('form-0006-standard', 'xxl');
    toggleCollection('form-0006-mega-x', 'normal');
    toggleCollection('form-0006-gigantamax', 'shiny');
    expect([...collectionKeys()].sort()).toEqual([
      'form-0006-gigantamax:shiny',
      'form-0006-mega-x:normal',
      'form-0006-standard:xxl',
    ]);
    expect(() => toggleCollection('form-0006-mega-x', 'xxl')).toThrow();
    toggleCollection('form-0006-mega-x', 'normal');
    expect(collectionKeys().has('form-0006-standard:xxl')).toBe(true);
    expect(collectionKeys().has('form-0006-gigantamax:shiny')).toBe(true);
  });
  it('rejects ineligible Shadow Eevee without saving', () => {
    expect(() => toggleCollection('form-0133-standard', 'shadow')).toThrow();
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBeNull();
  });
  it('CSV exports and imports both species and alternate forms', () => {
    toggleCollection('form-0006-standard', 'xxl');
    toggleCollection('form-0006-mega-x', 'shiny');
    const csv = exportCsv();
    const expected = [...collectionKeys()].sort();
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const review = reviewImport(csv, 'csv');
    expect(collectionKeys().size).toBe(0);
    commitImport(review);
    expect([...collectionKeys()].sort()).toEqual(expected);
  });
  it('JSON round trips and refuses a stale import preview', () => {
    toggleCollection('form-0006-standard', 'xxl');
    const backup = exportBackup();
    const review = reviewImport(backup, 'json');
    toggleCollection('form-0007-standard', 'normal');
    expect(() => commitImport(review)).toThrow(/changed after preview/);
    commitImport(reviewImport(backup, 'json'));
    expect([...collectionKeys()]).toEqual(['form-0006-standard:xxl']);
  });
  it('fails closed on corrupt storage and invalid imports', () => {
    storage.setItem(LOCAL_PROFILE_STORAGE_KEY, 'broken');
    expect(() => toggleCollection('form-0006-standard', 'normal')).toThrow();
    expect(storage.getItem(LOCAL_PROFILE_STORAGE_KEY)).toBe('broken');
    expect(() => reviewImport('{bad', 'json')).toThrow();
  });
});
