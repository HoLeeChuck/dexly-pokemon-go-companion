import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

for (const route of ['home', 'dex', 'search', 'profile'] as const) {
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
