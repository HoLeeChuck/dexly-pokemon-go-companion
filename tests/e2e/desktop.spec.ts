import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('desktop shell shows its sidebar and navigates without the mobile bar', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();

  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
  const sidebar = page.locator('.desktop-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText('dexly')).toBeVisible();
  await expect(sidebar.getByText('Private by default')).toBeVisible();
  await expect(sidebar.getByText('Local D1 session')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();

  const navigation = sidebar.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  const searchLab = navigation.getByRole('button', { name: 'Search Lab' });
  await searchLab.click();

  await expect(page).toHaveURL(/#\/search$/);
  await expect(searchLab).toHaveClass(/is-active/);
  await expect(
    page.getByRole('heading', { name: 'Turn gaps into useful searches.' }),
  ).toBeVisible();
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});
