import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('Search Builder selected controls remain readable in dark purple', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Purple' }).click();
  await page
    .getByRole('group', { name: 'Brightness mode' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await page.goto('/#/search');
  const builder = page.getByRole('region', { name: 'Visual Search Builder' });
  await builder.getByRole('button', { name: /Daily catch review/ }).click();
  const results = await new AxeBuilder({ page })
    .include('#search-builder')
    .withRules(['color-contrast'])
    .analyze();
  expect(results.violations).toEqual([]);
});

for (const route of ['home', 'dex', 'progress', 'search', 'settings'] as const) {
  test(`${route} has no automatically detectable serious accessibility violations`, async ({
    page,
  }) => {
    await installFakeApi(page);
    await page.goto(`/#/${route}`);
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
    ).toEqual([]);
  });
}

test('mobile menu traps focus, closes with Escape, and restores its trigger', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'The navigation dialog is mobile-only.');
  await installFakeApi(page);
  await page.goto('/#/home');
  const trigger = page.getByRole('button', { name: 'Open navigation menu' });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'CatchGrid navigation' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mobile-nav-panel')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('every light and dark color theme has no serious detectable violations', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(!testInfo.project.name.startsWith('desktop-'), 'Run the theme matrix once per engine.');
  await installFakeApi(page);
  await page.goto('/#/profile');
  const accents = ['Green', 'Blue', 'Purple', 'Red', 'Orange', 'Pink'];
  const brightness = page.getByRole('group', { name: 'Brightness mode' });

  for (const accent of accents) {
    await page.getByRole('radio', { name: accent }).click();
    for (const mode of ['Light', 'Dark']) {
      await brightness.getByRole('button', { name: mode, exact: true }).click();
      const results = await new AxeBuilder({ page }).analyze();
      expect
        .soft(
          results.violations
            .filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))
            .map((violation) => ({
              accent,
              mode,
              id: violation.id,
              nodes: violation.nodes.map((node) => ({
                target: node.target,
                message: node.any[0]?.message ?? node.failureSummary,
              })),
            })),
        )
        .toEqual([]);
    }
  }
});
