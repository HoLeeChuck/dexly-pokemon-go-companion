import { expect, test } from '@playwright/test';

import { emptyLocalProfile, LOCAL_PROFILE_STORAGE_KEY } from '../../src/lib/localProfile';
import { createPortableProfileBackupJson } from '../../src/lib/profileBackup';
import { installFakeApi } from './support/fake-api';

const backupProfile = {
  ...emptyLocalProfile(() => new Date('2026-08-13T12:00:00.000Z')),
  revision: 20,
  catalogVersion: '2026-08-13.1',
  wantedEntries: [
    {
      formId: 'form-0002-standard',
      categoryId: 'shiny' as const,
      wanted: true,
      notes: 'Restore regression marker',
    },
  ],
  tradeSpecimens: [
    {
      id: 'trade:restore-regression',
      formId: 'form-0007-standard',
      traits: ['xxl' as const],
      quantity: 2,
      notes: 'Restore regression marker',
    },
  ],
};

test.describe('portable backup restore safety', () => {
  test('restored wanted and trade state survives the next collection mutation', async ({
    page,
  }) => {
    await installFakeApi(page);
    await page.goto('/#/settings');

    const backupJson = createPortableProfileBackupJson(
      backupProfile,
      backupProfile.catalogVersion,
      () => new Date('2026-08-13T12:01:00.000Z'),
    );
    await page.locator('input[accept="application/json,.json"]').setInputFiles({
      name: 'catchgrid-complete-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupJson),
    });
    await expect(page.locator('.toast')).toContainText('Portable backup restored');
    await page.locator('.toast__close').click();

    await page.goto('/#/dex');
    await page.getByRole('button', { name: /^Quick Check/ }).click();
    await page.getByTestId('pokemon-card-2').click();
    await expect(page.locator('.toast').filter({ hasText: /Ivysaur marked/ })).toHaveCount(0);

    const persisted = await page.evaluate((storageKey) => {
      const value = localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    }, LOCAL_PROFILE_STORAGE_KEY);
    expect(persisted.wantedEntries).toEqual(backupProfile.wantedEntries);
    expect(persisted.tradeSpecimens).toEqual(backupProfile.tradeSpecimens);
  });

  test('cloud mode requires returning to browser storage before local restore', async ({
    page,
  }) => {
    await installFakeApi(page);
    await page.goto('/cody');
    await page.getByRole('button', { name: 'Sign in to Cody Cloud' }).click();
    await page.getByPlaceholder('Paste access key').fill('e2e-owner-token');
    await page.getByRole('button', { name: 'Connect Cody Cloud' }).click();

    const restoreButton = page.getByRole('button', { name: 'Switch to browser to restore' });
    await expect(restoreButton).toBeDisabled();
    await expect(
      page.getByText(/Local JSON restore is disabled while Cody Cloud is connected/),
    ).toBeVisible();
    await expect(page.locator('input[accept="application/json,.json"]')).toBeDisabled();
  });
});
