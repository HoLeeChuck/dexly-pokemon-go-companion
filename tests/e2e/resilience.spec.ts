import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('retired tools fall back to Home and Search Builder stays available without an event feed', async ({
  page,
}) => {
  const api = await installFakeApi(page);
  const eventRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/events') eventRequests.push(request.url());
  });
  for (const route of ['events', 'field-kit']) {
    await page.goto(`/#/${route}`);
    await expect(
      page.getByRole('heading', { name: /Your collection starts here|Ready for your next catch/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open Search Builder', exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Open Search Builder', exact: true }).click();
  await expect(page).toHaveURL(/#\/search\?section=search-builder$/);
  const builder = page.getByRole('region', { name: 'Visual Search Builder' });
  await expect(builder).toBeVisible();
  await builder.getByRole('button', { name: /Daily catch review/ }).click();
  await builder.getByLabel('Custom Pokémon GO search keyword').fill('buddy3-5');
  await builder.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(builder.getByText('age0&!#&!traded&buddy3-5', { exact: true })).toBeVisible();
  expect(eventRequests).toEqual([]);
  expect(api.unexpectedWriteCount).toBe(0);
});

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
