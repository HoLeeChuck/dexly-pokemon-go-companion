import { expect, test } from '@playwright/test';

// app/pokedex.css was once saved double-encoded, so this pill read "â— REGISTERED".
test('a registered scanner entry shows a clean status dot', async ({ page }) => {
  await page.goto('/#dex?r=kanto');
  await page.getByRole('button', { name: 'Toggle Normal: missing', exact: true }).click();
  await expect(page.locator('.hud-stage.registered .hud-status')).toBeVisible();
  const before = await page
    .locator('.hud-status')
    .evaluate((el) => getComputedStyle(el, '::before').content);
  expect(before).toBe('"● "');
});
