import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('dark mode switches the complete interface and persists after reload', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/home');

  const toggle = page.getByRole('button', { name: 'Use dark mode' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.regional-progress')).toHaveCSS('background-color', 'rgb(16, 41, 37)');
  await expect(page.locator('.region-progress-card').first()).toHaveCSS(
    'background-color',
    'rgb(20, 47, 42)',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible();
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
  await expect(navigation.getByRole('button')).toHaveCount(3);
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Search Lab' })).toHaveCount(0);
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
  await expect(sidebar.getByText('dexly')).toBeVisible();
  await expect(sidebar.getByText('Private by default')).toBeVisible();
  await expect(sidebar.getByText('Saved on this browser')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toHaveCount(0);

  const navigation = sidebar.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(3);
  const home = navigation.getByRole('button', { name: 'Home' });
  await home.click();

  await expect(page).toHaveURL(/#\/home$/);
  await expect(home).toHaveClass(/is-active/);
  await expect(
    page.getByRole('heading', { name: 'Turn gaps into useful searches.' }),
  ).toBeVisible();
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
    await expect(tile.locator('.category-toggle-switch')).toBeVisible();
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

test('Wanted details expose only realistic trade requests and recognize owned sizes', async ({
  page,
}) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await page.getByTestId('pokemon-card-1').click();
  await page.getByRole('button', { name: 'Wanted' }).click();

  const requestGrid = page.locator('.category-tile-grid--wanted');
  await expect(requestGrid.getByRole('button')).toHaveCount(5);
  for (const request of ['Normal', 'Shiny', 'XXL', 'XXS', 'Costume']) {
    await expect(
      requestGrid.getByRole('button', { name: new RegExp(`^${request}`) }),
    ).toBeVisible();
  }
  await expect(requestGrid.getByRole('button', { name: /^XXL/ })).toBeDisabled();
  await expect(requestGrid.getByRole('button', { name: /^XXL/ })).toContainText(
    'Owned · no trade needed',
  );
  await expect(requestGrid.getByText('Hundo')).toHaveCount(0);
  await expect(requestGrid.getByText('Shadow')).toHaveCount(0);

  const costume = requestGrid.getByRole('button', { name: /^Costume/ });
  await costume.click();
  await expect(costume).toHaveAttribute('aria-pressed', 'true');
  const savedWanted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('dexly:local-profile:v1') ?? '{}'),
  );
  expect(
    savedWanted.wantedEntries.some(
      (entry: { formId: string; categoryId: string; wanted: boolean }) =>
        entry.formId === 'form-0001-standard' && entry.categoryId === 'costume' && entry.wanted,
    ),
  ).toBe(true);
  expect(api.unexpectedWriteCount).toBe(0);
});
