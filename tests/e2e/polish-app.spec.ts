import { expect, test, type Page } from '@playwright/test';
import demo from '../../docs/fixtures/demo-collection.json' with { type: 'json' };

// October 2026 polish (Minior release): appearance default, scanner start, medal note,
// header icons and phone tap targets. Every test starts from an empty, isolated profile.
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 800;

async function restore(page: Page) {
  await page.goto('/#settings');
  await page.locator('#import-file').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demo)),
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
}

test.describe('first visit on a light-mode device', () => {
  test.use({ colorScheme: 'light' });

  test('follows the device setting until the person chooses', async ({ page }) => {
    await page.goto('/#home');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to dark appearance');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    // The saved choice now wins over the device setting.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-label', 'Switch to light appearance');
  });
});

test('a dark-mode device still opens dark', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-toggle')).toHaveAttribute(
    'aria-label',
    'Switch to light appearance',
  );
});

test('the Kanto scanner opens on Bulbasaur', async ({ page }) => {
  await page.goto('/#dex?r=kanto');
  await expect(page.locator('.hud-number')).toHaveText('#0001');
  await expect(page.locator('.hud-readout h3')).toHaveText('Bulbasaur');
});

test('medals say how many species in their total are not in GO yet', async ({ page }) => {
  await restore(page);
  await page.goto('/#home');
  const kanto = page.locator('[data-key="medal-Kanto"]');
  await expect(kanto).toBeVisible();
  await expect(kanto.locator('.medal-unavailable')).toHaveCount(0);
  const sinnoh = page.locator('[data-key="medal-Sinnoh"]');
  await expect(sinnoh.locator('.medal-unavailable')).toHaveText(/^\d+ not in GO yet$/);
  const note = (await sinnoh.locator('.medal-unavailable').textContent()) ?? '';
  const total = Number((await sinnoh.textContent())?.match(/\/(\d+)/)?.[1]);
  expect(Number.parseInt(note, 10)).toBeGreaterThan(0);
  expect(Number.parseInt(note, 10)).toBeLessThan(total);
});

test('header icons are drawn, not text characters', async ({ page }) => {
  await page.goto('/#home');
  for (const name of ['.jump-toggle', '.theme-toggle']) {
    const button = page.locator(name);
    await expect(button.locator('svg.header-icon')).toHaveCount(1);
    expect(await button.textContent()).not.toMatch(/[⌕◐]/);
  }
});

test('small phone controls have 44px tap areas', async ({ page }) => {
  test.skip(!isPhone(page), 'Phone sizes only');
  const height = async (selector: string) =>
    (await page.locator(selector).first().boundingBox())?.height ?? 0;
  await page.goto('/#home');
  expect(await height('footer a[href="#about"]')).toBeGreaterThanOrEqual(44);
  await page.goto('/#settings');
  expect(await height('label.evolve-option:has([data-silhouettes])')).toBeGreaterThanOrEqual(44);
  expect((await page.locator('[data-silhouettes]').boundingBox())?.width).toBeGreaterThanOrEqual(
    22,
  );
  await page.goto('/#search');
  expect(await height('.term-section > summary')).toBeGreaterThanOrEqual(44);
});
