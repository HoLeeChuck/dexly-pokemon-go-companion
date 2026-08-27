import { describe, expect, it } from 'vitest';
import { emptyLocalProfile, type LocalProfileSnapshot } from '../../src/lib/localProfile';
import { createPortableProfileBackupJson } from '../../src/lib/profileBackup';
import { reviewPortableBackup, reviewSnapshot } from '../../src/components/RestoreReview';

const at = (value: string) => () => new Date(value);

describe('restore review summaries', () => {
  it('parses a portable backup for review without applying it', () => {
    const profile = {
      ...emptyLocalProfile(at('2026-08-25T10:00:00.000Z')),
      catalogVersion: 'catalog-current',
      collectionEntries: [
        { formId: 'form-0001-standard', categoryId: 'normal' as const, collected: true },
      ],
      savedSearches: [],
      settings: { theme: 'dark' as const, accentTheme: 'purple' as const },
    };
    const raw = createPortableProfileBackupJson(
      profile,
      'catalog-current',
      at('2026-08-25T10:05:00.000Z'),
    );

    const reviewed = reviewPortableBackup(raw, 'backup.json', 'catalog-current');

    expect(reviewed.raw).toBe(raw);
    expect(reviewed.summary).toMatchObject({
      sourceName: 'backup.json',
      catalogCompatibility: 'current',
      collectionRecords: 1,
      savedSearches: 0,
      settings: ['light/dark mode', 'accent theme'],
    });
  });

  it('reports snapshot scope and a differing catalog before confirmation', () => {
    const profile = emptyLocalProfile(at('2026-08-25T09:00:00.000Z'));
    const snapshot: LocalProfileSnapshot = {
      schemaVersion: 1,
      id: 'snapshot:test',
      createdAt: '2026-08-25T09:30:00.000Z',
      reason: 'Before import',
      catalogVersion: 'catalog-older',
      profile,
    };

    expect(reviewSnapshot(snapshot, 'catalog-current')).toMatchObject({
      sourceName: 'Before import',
      catalogCompatibility: 'different',
      collectionRecords: 0,
    });
  });
});
