import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('dark mode switches the complete interface and persists after reload', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/home');

  const toggle = page.getByRole('button', { name: 'Use dark mode' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.regional-progress')).toHaveCSS('background-color', 'rgb(23, 30, 28)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible();
});

test('appearance settings combine a persistent color theme with light and dark modes', async ({
  page,
}) => {
  await installFakeApi(page);
  await page.goto('/#/profile');

  const colorThemes = page.getByRole('radiogroup', { name: 'Color theme' });
  await expect(colorThemes.getByRole('radio')).toHaveCount(6);
  await colorThemes.getByRole('radio', { name: 'Purple' }).click();
  await page
    .getByRole('group', { name: 'Brightness mode' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Search Lab' })
    .click();
  await expect(page.locator('.lab-hero')).toHaveCSS(
    'background-image',
    /rgb\(84, 51, 126\).*rgb\(26, 16, 40\)/,
  );

  const purpleAccent = await page
    .locator('html')
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--brand-700').trim());
  expect(purpleAccent).toBe('#a17bd1');

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 12, 22)');
  await page.goto('/#/home');
  await expect(page.locator('.regional-progress')).toHaveCSS('background-color', 'rgb(32, 24, 39)');

  await page.goto('/#/profile');
  await colorThemes.getByRole('radio', { name: 'Blue' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 18, 23)');
  await page.goto('/#/home');
  await expect(page.locator('.regional-progress')).toHaveCSS('background-color', 'rgb(17, 30, 37)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/#/profile');
  await expect(colorThemes.getByRole('radio', { name: 'Blue' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('profile layout starts both columns together and keeps Cody Cloud access unlisted', async ({
  page,
}) => {
  await installFakeApi(page);
  await page.goto('/#/profile');

  await expect(page.getByRole('heading', { name: 'Cody Cloud' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in to Cody Cloud' })).toHaveCount(0);
  await expect(page.getByText('Private by default')).toHaveCount(0);

  const layout = await page.locator('.page--data').evaluate((element) => {
    const appearance = element.querySelector('.appearance-panel')!.getBoundingClientRect();
    const importPanel = element.querySelector('.import-panel')!.getBoundingClientRect();
    return {
      appearanceTop: Math.round(appearance.top),
      importTop: Math.round(importPanel.top),
    };
  });
  expect(Math.abs(layout.appearanceTop - layout.importTop)).toBeLessThanOrEqual(2);

  await page.goto('/cody');
  await expect(page.getByRole('heading', { name: 'Cody Cloud' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in to Cody Cloud' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  await expect(navigation.getByText('Cody Cloud')).toHaveCount(0);
  await navigation.getByRole('button', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/#\/home$/);
});

test('first launch opens the all-in-one Home without exposing the unfinished Trade page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const api = await installFakeApi(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Your Dex at a glance.' })).toBeVisible();
  const dashboardLayout = await page.locator('.page--dashboard').evaluate((dashboard) => {
    const hero = dashboard.querySelector('.dashboard-hero')!.getBoundingClientRect();
    const progress = dashboard.querySelector('.regional-progress')!.getBoundingClientRect();
    return {
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heroWidth: Math.round(hero.width),
      progressWidth: Math.round(progress.width),
      sameColumn: Math.abs(hero.left - progress.left) < 2,
    };
  });
  expect(dashboardLayout.pageOverflows).toBe(false);
  expect(dashboardLayout.sameColumn).toBe(true);
  expect(Math.abs(dashboardLayout.heroWidth - dashboardLayout.progressWidth)).toBeLessThan(2);
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Search Lab' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Trade' })).toHaveCount(0);

  await page.goto('/#/trade');
  await expect(page.getByRole('heading', { name: 'Your Dex at a glance.' })).toBeVisible();
  expect(api.unexpectedWriteCount).toBe(0);
});

test('desktop shell shows its sidebar and navigates without the mobile bar', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();

  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
  const sidebar = page.locator('.desktop-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText('CatchGrid')).toBeVisible();
  await expect(sidebar.getByText('Private by default')).toHaveCount(0);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);

  const navigation = sidebar.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  const home = navigation.getByRole('button', { name: 'Home' });
  await home.click();

  await expect(page).toHaveURL(/#\/home$/);
  await expect(home).toHaveClass(/is-active/);
  await expect(page.getByRole('heading', { name: 'Turn gaps into useful searches.' })).toHaveCount(
    0,
  );

  await navigation.getByRole('button', { name: 'Search Lab' }).click();
  await expect(page).toHaveURL(/#\/search$/);
  await expect(
    page.getByRole('heading', { name: 'Turn gaps into useful searches.' }),
  ).toBeVisible();

  await sidebar.getByRole('button', { name: 'Go to home page' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole('heading', { name: 'Your Dex at a glance.' })).toBeVisible();
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('detail arrows follow catalog order and type themes update with the Pokémon', async ({
  page,
}) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');

  await page.getByTestId('pokemon-card-1').click();
  const sheet = page.locator('.detail-sheet');
  await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
  await expect(sheet).toHaveAttribute('data-primary-type', 'grass');
  await expect(sheet).toHaveAttribute('data-secondary-type', 'poison');
  await expect(page.getByRole('button', { name: 'No previous Pokémon' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next Pokémon: Ivysaur' })).toBeVisible();

  const grassTheme = await sheet.evaluate((element) => ({
    primary: (element as HTMLElement).style.getPropertyValue('--type-primary'),
    secondary: (element as HTMLElement).style.getPropertyValue('--type-secondary'),
    heroBackground: getComputedStyle(element.querySelector('.detail-hero')!).backgroundImage,
  }));
  expect(grassTheme).toEqual({
    primary: '#58a957',
    secondary: '#9a62b5',
    heroBackground: expect.stringContaining('linear-gradient'),
  });

  await page.getByRole('button', { name: 'Next Pokémon: Ivysaur' }).click();
  await expect(page.getByRole('dialog', { name: 'Ivysaur' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous Pokémon: Bulbasaur' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous Pokémon: Bulbasaur' }).click();
  await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();

  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByTestId('pokemon-card-4').click();
  await expect(page.getByRole('dialog', { name: 'Charmander' })).toBeVisible();
  await expect(sheet).toHaveAttribute('data-primary-type', 'fire');
  await expect(sheet).not.toHaveAttribute('data-secondary-type', /.+/);
  const fireTheme = await sheet.evaluate((element) => ({
    primary: (element as HTMLElement).style.getPropertyValue('--type-primary'),
    secondary: (element as HTMLElement).style.getPropertyValue('--type-secondary'),
  }));
  expect(fireTheme).toEqual({ primary: '#ef6a45', secondary: '#ef6a45' });
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('completing every released category activates the animated rainbow hook', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');

  const card = page.getByTestId('pokemon-card-25');
  await card.click();
  const sheet = page.locator('.detail-sheet');
  await expect(sheet).toHaveAttribute('data-collection-complete', 'false');

  for (const category of ['Shiny', 'Lucky', 'Hundo', 'XXL', 'XXS']) {
    const tile = page.getByRole('button', { name: new RegExp(`^${category}`) });
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await expect(tile.locator('.category-tile__status')).toBeVisible();
    await expect(tile).toHaveClass(/category-tile--collected/);
  }

  await expect(sheet).toHaveAttribute('data-collection-complete', 'true');
  await expect(sheet).toHaveClass(/detail-sheet--complete/);
  await expect
    .poll(() => sheet.evaluate((element) => getComputedStyle(element, '::before').animationName))
    .toContain('rainbow-border-flow');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('dexly:local-profile:v1') ?? '{}'),
  );
  expect(
    saved.collectionEntries.filter(
      (entry: { formId: string; collected: boolean }) =>
        entry.formId === 'form-0025-standard' && entry.collected,
    ).length,
  ).toBeGreaterThanOrEqual(6);

  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(card).toHaveAttribute('data-collection-complete', 'true');
  await expect(card).toHaveClass(/pokemon-card--complete/);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('Shadow collection uses the standard card treatment without an aura', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');

  await page.locator('.category-picker__toggle').click();
  await page
    .getByRole('toolbar', { name: 'Collection category' })
    .getByRole('button', { name: 'Shadow' })
    .click();
  const shadowCard = page.getByTestId('pokemon-card-1');
  await expect(shadowCard).toHaveAttribute('data-category', 'shadow');
  await expect(shadowCard).not.toHaveClass(/pokemon-card--shadow/);
  await expect(shadowCard.locator('.pokemon-card__shadow-aura')).toHaveCount(0);
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('Pokémon details open directly to whole-card collection controls', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await page.getByTestId('pokemon-card-1').click();

  await expect(page.locator('.detail-tabs')).toHaveCount(0);
  await expect(page.getByText('Wanted list')).toHaveCount(0);
  await expect(page.getByText('For trade')).toHaveCount(0);
  const grid = page.locator('.category-tile-grid');
  await expect(grid.getByRole('button')).toHaveCount(8);
  const shiny = grid.getByRole('button', { name: /^Shiny/ });
  await expect(shiny.locator('.category-tile__status')).toBeVisible();
  await shiny.click();
  await expect(shiny).toHaveAttribute('aria-pressed', 'true');
  await expect(shiny).toHaveClass(/category-tile--collected/);
  await expect(shiny).toContainText('Collected');
  expect(api.unexpectedWriteCount).toBe(0);
});
