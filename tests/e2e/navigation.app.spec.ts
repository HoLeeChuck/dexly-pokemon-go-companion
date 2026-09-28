import { expect, test } from '@playwright/test';
import demoCollection from '../../docs/fixtures/demo-collection.json' with { type: 'json' };

test('Dex cue is confined to empty Home and runs once per tab session', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#home');
  const dex = page.locator('#main-nav a[href="#dex"]');
  await expect(dex).toHaveClass('dex-nudge');
  expect(await dex.evaluate((el) => getComputedStyle(el, '::after').height)).toBe('2px');
  const timing = await dex.evaluate((el) => {
    const style = getComputedStyle(el, '::after');
    return [style.animationName, style.animationIterationCount];
  });
  expect(timing).toEqual(['dex-nav-pulse', '1']);
  await dex.click();
  await expect(dex).not.toHaveClass('dex-nudge');
  await page.locator('#main-nav a[href="#home"]').click();
  await expect(page.locator('.first-run')).toBeVisible();
  await expect(dex).not.toHaveClass('dex-nudge');
  await page.reload();
  await expect(page.locator('.first-run')).toBeVisible();
  await expect(dex).not.toHaveClass('dex-nudge');

  const freshTab = await context.newPage();
  await freshTab.setViewportSize({ width: 1440, height: 900 });
  await freshTab.emulateMedia({ reducedMotion: 'reduce' });
  await freshTab.goto('/#home');
  await expect(freshTab.locator('#main-nav .dex-nudge')).toBeVisible();
  expect(
    await freshTab
      .locator('#main-nav .dex-nudge')
      .evaluate((el) => getComputedStyle(el, '::after').animationName),
  ).toBe('none');
  await freshTab.close();
});

test('blocked session storage cannot break navigation or replay the Dex cue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/#home');
  await expect(page.locator('#main-nav .dex-nudge')).toBeVisible();
  await page.locator('#main-nav a[href="#progress"]').click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'progress');
  await page.locator('#main-nav a[href="#home"]').click();
  await expect(page.locator('.first-run')).toBeVisible();
  await expect(page.locator('#main-nav .dex-nudge')).toHaveCount(0);
});

test('returning Home never advertises the first-run Dex cue', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#settings');
  await page.locator('#import-file').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoCollection)),
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  await page.locator('#main-nav a[href="#home"]').click();
  await expect(page.locator('.dash')).toBeVisible();
  await expect(page.locator('#main-nav .dex-nudge')).toHaveCount(0);
});

test('phone destinations, keyboard access and Menu remain usable across the 700px boundary', async ({
  page,
}) => {
  await page.goto('/#home');
  const tabs = page.getByRole('navigation', { name: 'Mobile navigation' });
  for (const width of [320, 390, 699, 700, 844, 1440, 390]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    if (width < 700) {
      await expect(tabs).toBeVisible();
      await expect(tabs).toHaveCSS('height', '56px');
      await expect(page.locator('main')).toHaveCSS('padding-bottom', '56px');
    } else await expect(tabs).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await expect(tabs.getByRole('link')).toHaveText(['Home', 'Dex', 'Progress', 'Search']);
  await tabs.getByRole('link', { name: 'Home', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(tabs.getByRole('link', { name: 'Dex', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-route', 'dex');
  await page.locator('.device-card[href="#dex?r=kanto"]').click();
  await expect(tabs.getByRole('link', { name: 'Dex', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const [name, route] of [
    ['Progress', 'progress'],
    ['Search', 'search'],
    ['Home', 'home'],
  ]) {
    await tabs.getByRole('link', { name, exact: true }).click();
    await expect(page.locator('main')).toHaveAttribute('data-route', route);
    await expect(tabs.locator('[aria-current]')).toHaveText(name);
  }
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#main-nav a:visible')).toHaveText(['Settings']);
  await page.locator('#main-nav a[href="#settings"]').click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'settings');
  await expect(tabs.locator('[aria-current]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  const credits = page.getByRole('link', { name: 'Sources & credits', exact: true });
  await credits.focus();
  // Focus scrolls smoothly; wait for the browser to finish revealing the footer link.
  await expect
    .poll(() => credits.evaluate((el) => el.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual((await tabs.boundingBox())!.y);
});

test('a hidden Dex link does not consume its first-visit cue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#home');
  await expect(page.locator('#main-nav .dex-nudge')).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('#main-nav .dex-nudge')).toHaveCount(0);
  await page.setViewportSize({ width: 700, height: 844 });
  await expect(page.locator('#main-nav .dex-nudge')).toBeVisible();
});

test('phone dialogs and actionable toasts stay above the navigation', async ({
  page,
  context,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Exercise real CSS safe-area env values in Chromium, including the home indicator.
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: 34 } });
  }
  await page.goto('/#progress');
  const tabs = page.locator('.mobile-tabs');
  const expectedSpace = browserName === 'chromium' ? 90 : 56;
  await expect(tabs).toHaveCSS('height', `${expectedSpace}px`);
  const before = await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'));
  await page.getByRole('button', { name: 'View details for Bulbasaur', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pokémon collection details' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
    (await tabs.boundingBox())!.y,
  );
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'))).toBe(
    before,
  );
  await page.getByRole('button', { name: 'Copy search string', exact: true }).click();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('.toast')).not.toHaveClass(/sr-only/);
  expect(
    await page.locator('.toast').evaluate((el) => el.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual((await tabs.boundingBox())!.y);
  expect(
    await page.locator('.toast').evaluate((el) => Number(getComputedStyle(el).zIndex)),
  ).toBeGreaterThan(await tabs.evaluate((el) => Number(getComputedStyle(el).zIndex)));
  await page.getByRole('button', { name: 'Jump to a Pokémon', exact: true }).click();
  await expect(page.locator('#jump-dialog')).toBeVisible();
  expect(
    await page.locator('#jump-dialog').evaluate((el) => el.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual((await tabs.boundingBox())!.y);
});
