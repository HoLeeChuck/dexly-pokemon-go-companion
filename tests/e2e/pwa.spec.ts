import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('first install works offline and never caches private collection routes', async ({
  context,
  page,
}) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(new URL(request.url()).pathname));
  await installFakeApi(page);
  await page.goto('/#/home');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  await expect
    .poll(
      () =>
        page
          .evaluate(async () => {
            const registration =
              (await navigator.serviceWorker.getRegistrations())[0] ??
              (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
            return (
              registration.active?.state === 'activated' &&
              Boolean(navigator.serviceWorker.controller)
            );
          })
          .catch(() => false),
      { timeout: 15_000 },
    )
    .toBe(true);

  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return [...new Set(urls)].sort();
  });
  expect(cachedUrls.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(true);
  expect(cachedUrls.filter((url) => /\/assets\/.*\.js$/.test(url)).length).toBeGreaterThan(3);
  expect(cachedUrls.some((url) => /\/assets\/.*\.css$/.test(url))).toBe(true);
  expect(cachedUrls).toContain('/api/v1/catalog');
  expect(cachedUrls).not.toContain('/api/v1/bootstrap');
  expect(cachedUrls).not.toContain('/api/v1/collection');
  expect(cachedUrls).not.toContain('/cody');

  const controlledBeforeOffline = await page.evaluate(() =>
    Boolean(navigator.serviceWorker.controller),
  );
  expect(controlledBeforeOffline).toBe(true);
  await page.unrouteAll({ behavior: 'wait' });
  await context.setOffline(true);
  await page.evaluate(() => {
    window.location.hash = '#/dex';
  });
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/progress';
  });
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/search';
  });
  await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/settings';
  });
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  const diagnostics = await page.evaluate(() => ({
    body: document.body.innerText,
    htmlLength: document.documentElement.outerHTML.length,
    scripts: [...document.scripts].map((script) => script.src),
    controlled: Boolean(navigator.serviceWorker.controller),
  }));
  expect(diagnostics).toMatchObject({ controlled: true });
  expect(diagnostics.htmlLength).toBeGreaterThan(1000);
  expect({ errors, failedRequests }).toEqual({ errors: [], failedRequests: [] });
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
});

test('a waiting service worker updates only after the user accepts it', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/dex');
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 15_000,
    })
    .toBe(true);

  await page.evaluate(async () => {
    await fetch('/__test/enable-sw-update', { method: 'POST' });
    const registration = await navigator.serviceWorker.getRegistration('/');
    await registration?.update();
  });
  const updatePrompt = page.getByText('A CatchGrid update is ready');
  await expect(updatePrompt).toBeVisible();
  const toastDismiss = page.locator('.toast__close');
  if (await toastDismiss.isVisible()) {
    const layout = await page.locator('.notification-stack').evaluate((stack) => {
      const toast = stack.querySelector('.toast')!.getBoundingClientRect();
      const update = stack.querySelector('.update-prompt')!.getBoundingClientRect();
      return { separated: toast.bottom <= update.top || update.bottom <= toast.top };
    });
    expect(layout.separated).toBe(true);
    await toastDismiss.click();
  }
  let reloadCount = 0;
  page.on('load', () => {
    reloadCount += 1;
  });
  const navigation = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Update now' }).click();
  await navigation;
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();
  await expect(updatePrompt).toHaveCount(0);
  await expect.poll(() => reloadCount).toBe(1);
});
