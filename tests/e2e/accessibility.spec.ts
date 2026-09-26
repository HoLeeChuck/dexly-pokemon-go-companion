import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const hash of [
  'home',
  'dex',
  'dex?r=kanto',
  'progress',
  'search',
  'search?section=recommended-searches',
  'settings',
  'about',
]) {
  test(`${hash} has no serious automatically detectable accessibility violations`, async ({
    page,
  }) => {
    await page.goto(`/#${hash}`);
    await expect(page.locator('main')).not.toBeEmpty();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations
        .filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
        .map((v) => `${v.id}: ${v.nodes.length}`),
    ).toEqual([]);
  });
}

test('the Progress grid is a single tab stop with arrow-key movement', async ({ page }) => {
  await page.goto('/#progress');
  const grid = page.locator('.collection-grid');
  await expect(grid.locator('.gcell[tabindex="0"]')).toHaveCount(1);
  await grid.locator('.gcell[tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Bulbasaur Male', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Ivysaur Male', exact: true })).toBeFocused();
  await expect(grid.locator('.gcell[tabindex="0"]')).toHaveCount(1);
});
