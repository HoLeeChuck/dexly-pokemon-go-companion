import { chromium, expect, test } from '@playwright/test';

test('standalone phone navigation respects safe areas and rotation', async ({ baseURL }) => {
  // Chrome app mode exposes the actual standalone media query, not a matchMedia stub.
  // The empty directory argument creates a temporary, isolated browser profile.
  const context = await chromium.launchPersistentContext('', {
    // App mode needs the full browser; Playwright's default headless shell has no app window.
    channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? 'chrome' : 'chromium',
    headless: true,
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
    args: [`--app=${baseURL}/#home`],
  });
  try {
    const page = context.pages()[0];
    await page.goto(`${baseURL}/#home`);
    expect(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(true);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34 } });
    const tabs = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(tabs).toHaveCSS('height', '90px');
    await expect(page.locator('main')).toHaveCSS('padding-bottom', '90px');
    await expect(page.locator('body')).toHaveCSS('padding-top', '47px');
    for (const theme of ['dark', 'light']) {
      if (theme === 'light')
        await page.getByRole('button', { name: 'Switch to light appearance' }).click();
      for (const [width, height] of [
        [390, 844],
        [844, 390],
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await cdp.send('Emulation.setSafeAreaInsetsOverride', {
          insets:
            width > height
              ? { left: 47, right: 47, bottom: 21, top: 0 }
              : { top: 47, bottom: 34, left: 0, right: 0 },
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        if (width < 700) {
          await expect(tabs).toBeVisible();
          await tabs.getByRole('link', { name: 'Search', exact: true }).click();
          await expect(page.locator('main')).toHaveAttribute('data-route', 'search');
          await tabs.getByRole('link', { name: 'Home', exact: true }).click();
        } else {
          await expect(tabs).toBeHidden();
          await expect(page.locator('body')).toHaveCSS('padding-bottom', '21px');
          expect(
            await page.locator('.theme-toggle').evaluate((el) => el.getBoundingClientRect().right),
          ).toBeLessThanOrEqual(width - 47);
        }
      }
    }
  } finally {
    await context.close();
  }
});

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
