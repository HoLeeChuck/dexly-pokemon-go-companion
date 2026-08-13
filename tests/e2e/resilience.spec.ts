import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('catalog downtime is recoverable and never looks like an empty collection', async ({
  page,
}) => {
  await installFakeApi(page, { catalogFailureCount: 1 });
  await page.goto('/#/dex');

  await expect(page.getByRole('heading', { name: /couldn.t load your collection/i })).toBeVisible();
  await expect(page.getByText('Catalog temporarily unavailable.')).toBeVisible();
  await expect(page.getByText(/has not been erased/i)).toBeVisible();
  await expect(page.getByText(/0 shown/i)).toHaveCount(0);

  await page.getByRole('button', { name: /try again/i }).click();
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();
  await expect(page.locator('.pokemon-card')).not.toHaveCount(0);
});
