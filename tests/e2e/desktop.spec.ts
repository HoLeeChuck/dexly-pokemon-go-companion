import { expect, test } from '@playwright/test';
import { installFakeApi } from './support/fake-api';

test('legacy workers.dev visitors receive a safe export path without an automatic redirect', async ({
  baseURL,
  page,
}) => {
  if (!baseURL) throw new Error('The E2E base URL is required.');
  const legacyOrigin = 'http://catchgrid-migration-test.workers.dev';
  await page.route(`${legacyOrigin}/**`, async (route) => {
    const requested = new URL(route.request().url());
    const localUrl = new URL(`${requested.pathname}${requested.search}`, baseURL);
    const response = await page.request.fetch(localUrl.toString(), {
      method: route.request().method(),
      headers: route.request().headers(),
      data: route.request().postDataBuffer(),
    });
    await route.fulfill({ response });
  });
  await installFakeApi(page);

  await page.goto(`${legacyOrigin}/#/home`);
  const migration = page.getByRole('status').filter({
    hasText: 'CatchGrid has moved to dex.cjdev.app',
  });
  await expect(migration).toContainText('Browser collections are tied to this web address');
  await expect(migration.getByRole('link', { name: 'Open canonical site' })).toHaveAttribute(
    'href',
    'https://dex.cjdev.app/',
  );
  expect(new URL(page.url()).hostname).toBe('catchgrid-migration-test.workers.dev');

  const download = page.waitForEvent('download');
  await migration.getByRole('button', { name: 'Export backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test('dark mode switches the complete interface and persists after reload', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/settings');
  await page
    .getByRole('group', { name: 'Brightness mode' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByRole('group', { name: 'Brightness mode' }).getByRole('button', { name: 'Dark' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('appearance settings combine a persistent color theme with light and dark modes', async ({
  page,
}) => {
  await installFakeApi(page);
  await page.goto('/#/settings');

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
  await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toBeVisible();

  const purpleAccent = await page
    .locator('html')
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--brand-700').trim());
  expect(purpleAccent).toBe('#a17bd1');

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 12, 22)');
  await page.goto('/#/home');
  await expect(page.locator('.home-section').first()).not.toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  await page.goto('/#/settings');
  await colorThemes.getByRole('radio', { name: 'Blue' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 18, 23)');
  await page.goto('/#/home');
  await expect(page.locator('.home-section').first()).not.toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.desktop-sidebar').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  const restoredColorThemes = page.getByRole('radiogroup', { name: 'Color theme' });
  await expect(restoredColorThemes.getByRole('radio', { name: 'Blue' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('settings uses a compact dashboard and keeps Cody Cloud access unlisted', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/settings');

  await expect(page.getByRole('heading', { name: 'Cody Cloud' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in to Cody Cloud' })).toHaveCount(0);
  await expect(page.getByText('Private by default')).toHaveCount(0);

  const layout = await page.locator('.page--data').evaluate((element) => {
    const setup = element.querySelector('.collection-setup-panel')!.getBoundingClientRect();
    const appearance = element.querySelector('.appearance-panel')!.getBoundingClientRect();
    const importPanel = element.querySelector('.import-panel')!.getBoundingClientRect();
    const exportPanel = element.querySelector('.data-actions')!.getBoundingClientRect();
    return {
      setupTop: Math.round(setup.top),
      appearanceTop: Math.round(appearance.top),
      importTop: Math.round(importPanel.top),
      exportTop: Math.round(exportPanel.top),
      appearanceLeft: Math.round(appearance.left),
      importLeft: Math.round(importPanel.left),
      exportLeft: Math.round(exportPanel.left),
    };
  });
  expect(Math.abs(layout.appearanceTop - layout.exportTop)).toBeLessThan(2);
  expect(Math.abs(layout.appearanceTop - layout.importTop)).toBeLessThan(2);
  expect(layout.appearanceLeft).toBeLessThan(layout.exportLeft);
  expect(layout.exportLeft).toBeLessThan(layout.importLeft);
  expect(layout.importTop).toBeLessThan(layout.setupTop);
  await expect(page.locator('.collection-setup-panel')).not.toHaveAttribute('open', '');

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

  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommended Search Strings' })).toBeVisible();
  await expect(page.getByText('Recent Shinies')).toHaveCount(0);
  const dashboardLayout = await page.locator('.page--dashboard').evaluate((dashboard) => {
    const header = dashboard.querySelector('.home-header')!.getBoundingClientRect();
    const shortcuts = dashboard.querySelector('.home-shortcuts')!.getBoundingClientRect();
    const guide = dashboard.querySelector('.home-guide')!.getBoundingClientRect();
    const lower = dashboard.querySelector('.home-lower-grid')!.getBoundingClientRect();
    return {
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      headerWidth: Math.round(header.width),
      headerHeight: Math.round(header.height),
      lowerWidth: Math.round(lower.width),
      panelsShareRow: Math.abs(shortcuts.top - guide.top) < 2 && shortcuts.right < guide.left,
    };
  });
  expect(dashboardLayout.pageOverflows).toBe(false);
  expect(dashboardLayout.headerHeight).toBeLessThan(100);
  expect(dashboardLayout.panelsShareRow).toBe(true);
  expect(Math.abs(dashboardLayout.headerWidth - dashboardLayout.lowerWidth)).toBeLessThan(2);
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  await expect(navigation.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Progress' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Search Lab' })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Trade' })).toHaveCount(0);

  await page.goto('/#/trade');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(api.unexpectedWriteCount).toBe(0);
});

test('primary pages fill the viewport stage and use responsive wide-screen workspaces', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await installFakeApi(page);

  for (const route of ['home', 'progress', 'search', 'settings']) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('.page')).toBeVisible();
    const shell = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>('main')!;
      const stage = document.querySelector<HTMLElement>('.app-stage')!;
      const activePage = document.querySelector<HTMLElement>('.page')!;
      return {
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        mainOverflowY: getComputedStyle(main).overflowY,
        pageWidth: activePage.getBoundingClientRect().width,
        stageWidth: stage.getBoundingClientRect().width,
      };
    });
    expect(shell.documentScrollHeight).toBeLessThanOrEqual(shell.documentClientHeight + 1);
    expect(shell.mainOverflowY).toBe('auto');
    expect(Math.abs(shell.stageWidth - shell.pageWidth)).toBeLessThanOrEqual(18);
  }

  await page.goto('/#/progress');
  const progressLayout = await page.locator('.page--progress').evaluate((element) => {
    const overview = element.querySelector('.progress-overview')!.getBoundingClientRect();
    const regional = element.querySelector('.regional-progress')!.getBoundingClientRect();
    return {
      sharesRow: Math.abs(overview.top - regional.top) < 2,
      separated: overview.right < regional.left,
    };
  });
  expect(progressLayout).toEqual({ sharesRow: true, separated: true });

  await page.goto('/#/search');
  const searchLayout = await page.locator('.page--search-lab').evaluate((element) => {
    const generator = element.querySelector('.generator-panel')!.getBoundingClientRect();
    const recommended = element.querySelector('.recommended-panel')!.getBoundingClientRect();
    const share = element.querySelector('.discord-share-panel')!.getBoundingClientRect();
    return {
      topPanelsShareRow: Math.abs(generator.top - recommended.top) < 2,
      topPanelsSeparated: generator.right < recommended.left,
      shareSpansTopPanels:
        share.left === generator.left && Math.abs(share.right - recommended.right) < 2,
    };
  });
  expect(searchLayout).toEqual({
    topPanelsShareRow: true,
    topPanelsSeparated: true,
    shareSpansTopPanels: true,
  });
});

test('critical routes fit every public launch viewport without horizontal overflow', async ({
  page,
}) => {
  await installFakeApi(page);
  const viewports = [
    { width: 320, height: 844 },
    { width: 360, height: 800 },
    { width: 375, height: 844 },
    { width: 390, height: 844 },
    { width: 430, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const routes = ['home', 'dex', 'progress', 'search', 'settings'];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('main')).toBeVisible();
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect.soft({ ...viewport, route, ...layout }).toMatchObject({
        width: viewport.width,
        route,
        clientWidth: viewport.width,
        scrollWidth: viewport.width,
      });
    }
  }
});

test('multi-form details track alternate Regular and Shiny without inflating species progress', async ({
  page,
}) => {
  await installFakeApi(page);
  await page.goto('/#/dex');

  await page.getByTestId('pokemon-card-38').click();
  await expect(page.getByRole('dialog', { name: 'Ninetales' })).toBeVisible();
  const forms = page.locator('.compact-form-sections');
  await expect(forms.locator('.compact-form-row')).toHaveCount(1);
  const alolan = forms.locator('.compact-form-row', { hasText: 'Alolan Ninetales' });
  await expect(alolan).toHaveAttribute('data-variant-kind', 'regional');
  await expect(alolan.getByRole('button')).toHaveCount(2);
  await alolan.getByRole('button', { name: /Regular/ }).click();
  await expect(alolan.getByRole('button', { name: /Regular/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Close details' }).click();
  await page.goto('/#/home');
  await expect(page.getByRole('heading', { name: 'A quick snapshot' })).toBeVisible();
});

test('desktop shell shows its sidebar and navigates without the mobile bar', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();

  expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
  const sidebar = page.locator('.desktop-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Go to home page' })).toBeVisible();
  await expect(sidebar.getByText('Private by default')).toHaveCount(0);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);

  const dexViewport = await page.evaluate(() => {
    const browser = document.querySelector<HTMLElement>('.dex-browser')!;
    const results = document.querySelector<HTMLElement>('.dex-results')!;
    return {
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      browserBottom: browser.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      resultsClientHeight: results.clientHeight,
      resultsScrollHeight: results.scrollHeight,
      resultsOverflowY: getComputedStyle(results).overflowY,
      stageWidth: document.querySelector<HTMLElement>('.app-stage')!.getBoundingClientRect().width,
      pageWidth: document.querySelector<HTMLElement>('.page--dex')!.getBoundingClientRect().width,
    };
  });
  expect(dexViewport.documentScrollHeight).toBeLessThanOrEqual(
    dexViewport.documentClientHeight + 1,
  );
  expect(dexViewport.browserBottom).toBeLessThanOrEqual(dexViewport.viewportHeight + 1);
  expect(dexViewport.resultsOverflowY).toBe('auto');
  expect(dexViewport.resultsScrollHeight).toBeGreaterThanOrEqual(dexViewport.resultsClientHeight);
  expect(Math.abs(dexViewport.stageWidth - dexViewport.pageWidth)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1024, height: 600 });
  const compactDexViewport = await page.evaluate(() => {
    const browser = document.querySelector<HTMLElement>('.dex-browser')!;
    const results = document.querySelector<HTMLElement>('.dex-results')!;
    return {
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      browserBottom: browser.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      resultsClientHeight: results.clientHeight,
      resultsScrollHeight: results.scrollHeight,
    };
  });
  expect(compactDexViewport.documentScrollHeight).toBeLessThanOrEqual(
    compactDexViewport.documentClientHeight + 1,
  );
  expect(compactDexViewport.browserBottom).toBeLessThanOrEqual(
    compactDexViewport.viewportHeight + 1,
  );
  expect(compactDexViewport.resultsScrollHeight).toBeGreaterThan(
    compactDexViewport.resultsClientHeight,
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  const navigation = sidebar.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  const home = navigation.getByRole('button', { name: 'Home' });
  await home.click();

  await expect(page).toHaveURL(/#\/home$/);
  await expect(home).toHaveClass(/is-active/);
  await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toHaveCount(0);

  await navigation.getByRole('button', { name: 'Progress' }).click();
  await expect(page).toHaveURL(/#\/progress$/);
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.locator('.generator-panel')).toHaveCount(0);

  await navigation.getByRole('button', { name: 'Search Lab' }).click();
  await expect(page).toHaveURL(/#\/search$/);
  await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toBeVisible();

  await sidebar.getByRole('button', { name: 'Go to home page' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('transformation views show and search the full collector form name', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/dex');

  await page.getByLabel('Form view').selectOption('mega');
  const mega = page.getByRole('button', { name: /Open Mega Charizard X details/ });
  await expect(mega).toContainText('Mega Charizard X');
  await mega.click();
  await expect(page.getByRole('dialog', { name: 'Mega Charizard X' })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  await page.getByRole('searchbox', { name: 'Search Pokémon' }).fill('Mega Charizard X');
  await expect(page.getByRole('button', { name: /Open Mega Charizard X details/ })).toBeVisible();
});

test('Progress and Search Lab remain distinct public destinations', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/progress');

  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.locator('.generator-panel')).toHaveCount(0);

  await page.goto('/#/search?section=missing-searches');
  await expect(page).toHaveURL(/#\/search\?section=missing-searches$/);
  await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toBeVisible();
  await expect(page.locator('.generator-panel')).toBeVisible();
});

test('Search Lab keeps its desktop sections stacked without overlap', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/search');

  const searchLab = page.locator('.page--search-lab');
  const [labBox, generatorBox, recommendedBox, discordBox] = await Promise.all([
    searchLab.boundingBox(),
    page.locator('#missing-searches').boundingBox(),
    page.locator('#recommended-searches').boundingBox(),
    page.locator('#share-tools').boundingBox(),
  ]);

  expect([labBox, generatorBox, recommendedBox, discordBox].every(Boolean)).toBe(true);
  expect(generatorBox!.y + generatorBox!.height).toBeLessThanOrEqual(recommendedBox!.y + 1);
  expect(recommendedBox!.y + recommendedBox!.height).toBeLessThanOrEqual(discordBox!.y + 1);
  expect(Math.abs(recommendedBox!.x - generatorBox!.x)).toBeLessThan(2);
  expect(Math.abs(discordBox!.x - generatorBox!.x)).toBeLessThan(2);
  expect(Math.abs(recommendedBox!.width - generatorBox!.width)).toBeLessThan(2);
  expect(Math.abs(discordBox!.width - generatorBox!.width)).toBeLessThan(2);
});

test('species-first search discovers named alternate forms directly', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/dex');

  await expect(page.getByLabel('Form view')).toHaveValue('species');
  await page.getByRole('searchbox', { name: 'Search Pokémon' }).fill('Alolan Ninetales');
  await expect(page.getByRole('button', { name: /Open Alolan Ninetales details/ })).toBeVisible();
});

test('detail navigation follows the filtered result context', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/dex');

  await page.getByRole('searchbox', { name: 'Search Pokémon' }).fill('Pikachu');
  await page.getByTestId('pokemon-card-25').click();
  await expect(page.getByRole('dialog', { name: 'Pikachu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No previous Pokémon' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'No next Pokémon' })).toBeHidden();
});

test('desktop search, region, and collection controls share one aligned row', async ({ page }) => {
  await installFakeApi(page);
  await page.goto('/#/dex');

  const controls = [
    page.getByRole('searchbox', { name: 'Search Pokémon' }),
    page.locator('.region-standard-select select'),
    page.locator('.collection-standard-select select'),
    page.locator('.view-standard-select select'),
  ];
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  expect(
    Math.max(...boxes.map((box) => box!.y)) - Math.min(...boxes.map((box) => box!.y)),
  ).toBeLessThan(2);
  expect(
    Math.max(...boxes.map((box) => box!.height)) - Math.min(...boxes.map((box) => box!.height)),
  ).toBeLessThan(3);
});

test('costumes are separate from transformations and navigation resets to collection', async ({
  page,
}) => {
  await installFakeApi(page);
  await page.goto('/#/dex');
  await page.getByTestId('pokemon-card-25').click();

  await expect(page.getByText('Gigantamax Pikachu', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Costumes/ }).click();
  await expect(page.getByText('Pikachu with Party Hat (2017)', { exact: true })).toBeVisible();
  await expect(page.getByText('Gigantamax Pikachu', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Next Pokémon: Ninetales' }).click();
  await expect(page.getByRole('dialog', { name: 'Ninetales' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Pokémon detail sections' })).toHaveCount(0);
  await expect(page.locator('.category-tile-grid')).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Next Pokémon: Ivysaur' })).not.toHaveClass(
    /icon-button/,
  );

  const grassTheme = await sheet.evaluate((element) => ({
    primary: getComputedStyle(element).getPropertyValue('--type-primary').trim(),
    secondary: getComputedStyle(element).getPropertyValue('--type-secondary').trim(),
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
    primary: getComputedStyle(element).getPropertyValue('--type-primary').trim(),
    secondary: getComputedStyle(element).getPropertyValue('--type-secondary').trim(),
  }));
  expect(fireTheme).toEqual({ primary: '#ef6a45', secondary: '#ef6a45' });
  expect(api.collectionMutationCount).toBe(0);
  expect(api.unexpectedWriteCount).toBe(0);
});

test('detail dialogs support previous and next keyboard navigation', async ({ page }) => {
  const api = await installFakeApi(page);
  await page.goto('/#/dex');
  await page.getByTestId('pokemon-card-1').click();
  await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Ivysaur' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
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

  for (const category of ['Shiny', '★ 100%', 'Lucky', 'XXL', 'XXS']) {
    const tile = page
      .locator('.category-tile-grid')
      .getByRole('button', { name: new RegExp(`^${category}`) });
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
    JSON.parse(localStorage.getItem('catchgrid:local-profile:v2') ?? '{}'),
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

  await page.getByLabel('Collection category').selectOption('shadow');
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
  await expect(grid.getByRole('button').locator('strong')).toHaveText([
    'Normal',
    'Shiny',
    '★ 100%',
    'Lucky',
    'XXL',
    'XXS',
    'Shadow',
    'Purified',
  ]);
  const shiny = grid.getByRole('button', { name: /^Shiny/ });
  await expect(shiny.locator('.category-tile__status')).toBeVisible();
  await shiny.click();
  await expect(shiny).toHaveAttribute('aria-pressed', 'true');
  await expect(shiny).toHaveClass(/category-tile--collected/);
  await expect(shiny).not.toContainText('Collected');
  expect(api.unexpectedWriteCount).toBe(0);
});
