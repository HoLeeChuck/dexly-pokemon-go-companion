import { expect, test } from '@playwright/test';

test('installs offline support without caching private routes', async ({ page, context }) => {
  await page.goto('/#home');
  await expect(page.locator('main')).not.toBeEmpty();
  await expect
    .poll(
      () =>
        page
          .evaluate(async () => {
            const registration = (await navigator.serviceWorker.getRegistrations())[0];
            return registration?.active?.state === 'activated';
          })
          .catch(() => false),
      { timeout: 15_000 },
    )
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      urls.push(...(await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname));
    return [...new Set(urls)];
  });
  expect(cached).toContain('/');
  expect(cached.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(true);
  expect(cached).not.toContain('/advanced/');
  expect(cached).not.toContain('/api/v1/bootstrap');
  expect(cached).not.toContain('/cody');

  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main')).not.toBeEmpty();
  await context.setOffline(false);
});

test('a waiting update is only applied when the person accepts it', async ({ page }) => {
  await page.goto('/#dex');
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 15_000,
    })
    .toBe(true);
  await page.request.post('/__test/enable-sw-update');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await expect(page.getByText('A new version of CatchGrid is ready.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('main')).toHaveAttribute('data-route', 'dex');
  await page.getByRole('button', { name: 'Update now' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'dex');
});
