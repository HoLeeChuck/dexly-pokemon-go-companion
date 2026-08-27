import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeApi } from './support/fake-api';

const fixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

async function openDex(page: import('@playwright/test').Page) {
  await page.goto('/#/dex');
  await expect(page.getByRole('heading', { name: 'Pokédex' })).toBeVisible();
}

async function openMobileRoute(
  page: import('@playwright/test').Page,
  route: 'Home' | 'Dex' | 'Progress' | 'Search Lab' | 'Settings',
) {
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const menu = page.locator('.mobile-nav-panel');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: route }).click();
  await expect(menu).toBeHidden();
}

async function swipeHorizontally(target: Locator, direction: 'left' | 'right') {
  await target.evaluate((element, swipeDirection) => {
    const rect = element.getBoundingClientRect();
    const startX = swipeDirection === 'left' ? rect.right - 28 : rect.left + 28;
    const endX = swipeDirection === 'left' ? rect.left + 28 : rect.right - 28;
    const y = rect.top + rect.height / 2;
    const dispatchTouch = (type: string, clientX: number, ended = false) => {
      const touch = {
        identifier: 1,
        target: element,
        clientX,
        clientY: y,
        pageX: clientX,
        pageY: y,
        screenX: clientX,
        screenY: y,
      };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: ended ? [] : [touch] },
        targetTouches: { value: ended ? [] : [touch] },
        changedTouches: { value: [touch] },
      });
      element.dispatchEvent(event);
    };

    dispatchTouch('touchstart', startX);
    dispatchTouch('touchmove', endX);
    dispatchTouch('touchend', endX, true);
  }, direction);
}

async function swipeDown(target: Locator): Promise<string> {
  return target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const startY = rect.top + 28;
    const endY = Math.min(rect.bottom - 12, startY + 110);
    const dispatchTouch = (type: string, clientY: number, ended = false) => {
      const touch = {
        identifier: 1,
        target: element,
        clientX: x,
        clientY,
        pageX: x,
        pageY: clientY,
        screenX: x,
        screenY: clientY,
      };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: ended ? [] : [touch] },
        targetTouches: { value: ended ? [] : [touch] },
        changedTouches: { value: [touch] },
      });
      element.dispatchEvent(event);
    };

    dispatchTouch('touchstart', startY);
    dispatchTouch('touchmove', endY);
    const dragTransform = getComputedStyle(element.closest('.detail-sheet')!).transform;
    dispatchTouch('touchend', endY, true);
    return dragTransform;
  });
}

test.describe('mobile collection experience', () => {
  test('Home explains CatchGrid and fits the mobile viewport', async ({ page }) => {
    await installFakeApi(page);
    await page.goto('/#/home');
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Four simple steps' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Dex' })).toBeVisible();

    const layout = await page.locator('.page--dashboard').evaluate((dashboard) => {
      const cards = [...dashboard.querySelectorAll('.home-shortcut-grid > button')].slice(0, 2);
      const rectangles = cards.map((card) => card.getBoundingClientRect());
      return {
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cardsFit: rectangles.every((rect) => rect.left >= 0 && rect.right <= innerWidth),
        cardsStack: rectangles.length === 2 && rectangles[1].top >= rectangles[0].bottom,
      };
    });
    expect(layout).toEqual({ pageOverflows: false, cardsFit: true, cardsStack: true });
  });

  test('mobile header keeps profile and appearance controls in the menu', async ({ page }) => {
    await installFakeApi(page);
    await page.goto('/#/home');
    await expect(page.getByRole('button', { name: 'Use dark mode' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Use light mode' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open profile' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
  });

  test('dark Dex controls use consistent dark surfaces and readable text', async ({ page }) => {
    await installFakeApi(page);
    await page.addInitScript(() => localStorage.setItem('dexly:theme', 'dark'));
    await openDex(page);

    await expect(page.locator('.quick-toggle')).not.toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(page.locator('.quick-toggle')).toHaveCSS('color', 'rgb(231, 243, 238)');
    await expect(page.locator('.dex-results')).toHaveCSS('color', 'rgb(231, 243, 238)');
    await expect(
      page.getByRole('group', { name: 'Collection state' }).getByRole('button', { name: 'All' }),
    ).toHaveCSS('background-color', 'rgb(24, 61, 53)');
  });

  test('renders an exact 390x844 three-column grid without page-level overflow', async ({
    page,
  }) => {
    await installFakeApi(page);
    await openDex(page);

    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    const layout = await page.getByTestId('pokemon-grid').evaluate((grid) => {
      const cards = [...grid.querySelectorAll<HTMLElement>('[data-testid^="pokemon-card-"]')];
      const firstTop = cards[0]?.getBoundingClientRect().top ?? 0;
      const firstRow = cards.filter(
        (card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 2,
      );
      const gridRect = grid.getBoundingClientRect();

      return {
        computedTracks: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
        firstRowCards: firstRow.length,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        gridLeft: gridRect.left,
        gridRight: gridRect.right,
        viewportWidth: innerWidth,
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
      };
    });

    expect(layout.computedTracks).toBe(3);
    expect(layout.firstRowCards).toBe(3);
    expect(layout.documentClientWidth).toBe(390);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth);
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth);
    expect(layout.gridLeft).toBeGreaterThanOrEqual(0);
    expect(layout.gridRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.documentScrollHeight).toBeLessThanOrEqual(layout.documentClientHeight + 1);
  });

  test('keeps search and essential filters above a boxed collection scroller', async ({ page }) => {
    await installFakeApi(page);
    await openDex(page);

    await expect(page.getByLabel('Type')).toHaveCount(0);
    await expect(page.locator('.dex-controls').getByLabel('Generation')).toHaveCount(0);
    const mobileControlSizes = await page
      .locator('.search-field input, .standard-filter-select select')
      .evaluateAll((elements) =>
        elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      );
    expect(mobileControlSizes.length).toBeGreaterThan(0);
    expect(mobileControlSizes.every((size) => size >= 16)).toBe(true);
    const results = page.locator('.dex-results');
    const before = await results.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(before.overflowY).toBe('auto');
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await results.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    const controls = await page.locator('.dex-controls').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
    });
    expect(controls.top).toBeGreaterThanOrEqual(68);
    expect(controls.bottom).toBeLessThan(controls.viewportHeight);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await expect(page.locator('.dex-results .grid-heading')).toHaveCount(0);
    await expect(page.getByText('Your collection', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/collection$/i, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/shown$/i, { exact: true })).toHaveCount(0);
    await expect(page.locator('.pokemon-card').first()).toHaveCSS('isolation', 'isolate');

    const brandTarget = await page
      .getByRole('button', { name: 'Go to home page' })
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    expect(brandTarget.width).toBeGreaterThanOrEqual(44);
    expect(brandTarget.height).toBeGreaterThanOrEqual(44);

    const stateFilter = page.getByRole('group', { name: 'Collection state' });
    await expect(stateFilter.getByRole('button', { name: 'Available' })).toHaveCount(0);

    const searchTrigger = page.getByRole('button', { name: 'Open Pokémon search' });
    await searchTrigger.click();
    await expect(page.getByLabel('Search Pokémon')).toBeVisible();
    await expect(page.locator('.dex-compact-bar')).toHaveClass(/is-searching/);
    await page.getByRole('button', { name: 'Close search' }).click();
    await expect(searchTrigger).toBeVisible();

    const regionPicker = page.locator('.region-standard-select select');
    await expect(regionPicker.locator('option[value="all"]')).toHaveText('All');
    await regionPicker.selectOption('Kanto');
    await expect(regionPicker).toHaveValue('Kanto');
    const categoryPicker = page.locator('.collection-standard-select select');
    await categoryPicker.selectOption('shiny');
    await expect(categoryPicker).toHaveValue('shiny');
    await categoryPicker.selectOption('xxs');
    await expect(categoryPicker).toHaveValue('xxs');
  });

  test('uses the top hamburger menu instead of a persistent bottom bar', async ({ page }) => {
    await installFakeApi(page);
    await openDex(page);

    await expect(page.locator('.bottom-nav')).toHaveCount(0);
    const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const menu = page.locator('.mobile-nav-panel');
    await expect(menu).toBeVisible();
    const menuLayout = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        fillsWidth: Math.abs(rect.left) <= 1 && Math.abs(rect.right - innerWidth) <= 1,
        fillsBelowHeader: Math.abs(rect.top - 68) <= 1 && Math.abs(rect.bottom - innerHeight) <= 1,
      };
    });
    expect(menuLayout).toEqual({ fillsWidth: true, fillsBelowHeader: true });
    for (const route of ['Home', 'Dex', 'Progress', 'Settings']) {
      await expect(menu.getByRole('button', { name: route, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('button', { name: 'Trade', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('button', { name: 'Dex', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await page.getByRole('button', { name: 'Close navigation menu' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('a normal browse tap opens details without mutating collection state', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    const card = page.getByTestId('pokemon-card-1');
    const baselineState = await card.getAttribute('data-state');
    expect(baselineState).not.toBeNull();
    await expect(card).not.toHaveAttribute('aria-pressed');

    await card.click();
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
    await expect(page.locator('.detail-dialog')).toHaveCSS('outline-style', 'none');
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);

    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeHidden();
    await expect(card).toHaveAttribute('data-state', baselineState ?? '');
  });

  test('swiping a detail sheet moves through catalog order without toggling a category', async ({
    page,
  }) => {
    const api = await installFakeApi(page);
    await openDex(page);
    await page.getByTestId('pokemon-card-1').click();

    const hero = page.locator('.detail-hero');
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
    await expect(page.locator('.detail-nav').first()).toBeHidden();
    await expect(page.locator('.detail-nav').last()).toBeHidden();
    await swipeHorizontally(hero, 'left');
    await expect(page.getByRole('dialog', { name: 'Ivysaur' })).toBeVisible();

    await swipeHorizontally(hero, 'right');
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('swiping down on the Pokémon header closes it while the collection body remains scrollable', async ({
    page,
  }) => {
    const api = await installFakeApi(page);
    await openDex(page);
    await page.getByTestId('pokemon-card-1').click();

    await expect(page.getByRole('button', { name: 'Close details' })).toBeVisible();
    await swipeDown(page.locator('.detail-sheet__body'));
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeVisible();

    const dragTransform = await swipeDown(page.locator('.detail-hero'));
    expect(dragTransform).not.toBe('none');
    expect(dragTransform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
    await expect(page.getByRole('dialog', { name: 'Bulbasaur' })).toBeHidden();
    expect(api.collectionMutationCount).toBe(0);
  });

  test('Quick Check toggles one entry without a confirmation toast', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    const quickCheck = page.getByRole('button', { name: /^Quick Check/ });
    await quickCheck.click();
    await expect(quickCheck).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Quick Check is on')).toHaveCount(0);

    const card = page.getByTestId('pokemon-card-1');
    const baselinePressed = await card.getAttribute('aria-pressed');
    const baselineState = await card.getAttribute('data-state');
    expect(['true', 'false']).toContain(baselinePressed);
    expect(['collected', 'missing']).toContain(baselineState);
    const expectedPressedAfterToggle = baselinePressed === 'true' ? 'false' : 'true';
    const expectedStateAfterToggle = baselineState === 'collected' ? 'missing' : 'collected';

    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', expectedPressedAfterToggle);
    await expect(card).toHaveAttribute('data-state', expectedStateAfterToggle);

    await expect(page.locator('.toast').filter({ hasText: /Bulbasaur marked/ })).toHaveCount(0);
    const savedAfterToggle = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('catchgrid:local-profile:v2') ?? '{}'),
    );
    expect(
      savedAfterToggle.collectionEntries.some(
        (entry: { formId: string; categoryId: string; collected: boolean }) =>
          entry.formId === 'form-0001-standard' && entry.categoryId === 'normal' && entry.collected,
      ),
    ).toBe(expectedPressedAfterToggle === 'true');
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('Quick Check opens ineligible cards without mutating unavailable state', async ({
    page,
  }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await page.getByLabel('Collection category').selectOption('shadow');
    await page.getByRole('button', { name: /^Quick Check/ }).click();
    const ineligible = page.getByTestId('pokemon-card-2');
    await expect(ineligible).toHaveAttribute('data-state', 'unknown');
    await expect(ineligible).toBeEnabled();
    await ineligible.click();

    await expect(page.getByRole('dialog', { name: 'Ivysaur' })).toBeVisible();
    await expect(page.getByText('Data unavailable · needs review').first()).toBeVisible();
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('Quick Check preserves the collection scroll position when a filtered card leaves the grid', async ({
    page,
  }) => {
    const api = await installFakeApi(page, { catalogCopies: 10 });
    await openDex(page);

    await page.getByRole('button', { name: /^Quick Check/ }).click();
    await page
      .getByRole('group', { name: 'Collection state' })
      .getByRole('button', { name: 'Missing' })
      .click();

    const results = page.locator('.dex-results');
    await results.evaluate((element) => element.scrollTo(0, 420));
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);

    const card = page.locator('.pokemon-card[data-state="missing"]').nth(30);
    await card.scrollIntoViewIfNeeded();
    const cardTestId = await card.getAttribute('data-testid');
    expect(cardTestId).not.toBeNull();
    const before = await results.evaluate((element) => element.scrollTop);
    await card.click();
    await expect(page.locator(`[data-testid="${cardTestId}"]`)).toHaveCount(0);
    const after = await results.evaluate((element) => element.scrollTop);

    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('Dex filters, Quick Check, render depth, and internal scroll survive route navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await installFakeApi(page, { catalogCopies: 10 });
    await openDex(page);

    await page.getByLabel('Region').selectOption('Kanto');
    await page.getByLabel('Collection category').selectOption('shiny');
    await page.getByRole('button', { name: /^Quick Check/ }).click();
    await page.getByRole('button', { name: 'Open Pokémon search' }).click();
    await page.getByRole('searchbox', { name: 'Search Pokémon' }).fill('a');
    const results = page.locator('.dex-results');
    await results.evaluate((element) => element.scrollTo(0, 520));
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);

    await openMobileRoute(page, 'Progress');
    await openMobileRoute(page, 'Dex');

    await expect(page.getByRole('searchbox', { name: 'Search Pokémon' })).toHaveValue('a');
    await expect(page.getByLabel('Region')).toHaveValue('Kanto');
    await expect(page.getByLabel('Collection category')).toHaveValue('shiny');
    await expect(page.getByRole('button', { name: /^Quick Check/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => results.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);
  });

  test('Progress accuracy and Search Lab tools stay separate', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await installFakeApi(page);
    await openDex(page);

    await openMobileRoute(page, 'Progress');
    await expect(page).toHaveURL(/#\/progress$/);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    await expect(page.locator('.generator-panel')).toHaveCount(0);

    const kanto = page.locator('.region-shortcut-grid button').filter({ hasText: 'Kanto' });
    await expect(kanto).toContainText('4/8');
    await kanto.click();
    await page.getByLabel('Regional collection category').selectOption('shiny');
    await expect(kanto).toContainText('3/8');

    await openMobileRoute(page, 'Search Lab');
    await expect(page).toHaveURL(/#\/search$/);
    await expect(page.locator('.generator-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Search Lab', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visual search builder' })).toHaveCount(0);

    const output = page
      .locator('.all-category-searches .search-output')
      .filter({ hasText: 'Normal' });
    await expect(output).toContainText('8 missing');
    await expect(output.locator('.search-string code')).toHaveText('4,7,38,133,152,155,158,252');
    await expect(page.getByRole('button', { name: 'None', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.generator-panel').getByLabel('Generation')).toHaveCount(0);
    await expect(page.locator('.generator-panel').getByLabel('Region')).toHaveCount(0);
    await expect(page.locator('.generator-panel').getByLabel('Category')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'My wanted trades' })).toHaveCount(0);
    const shinyOutput = page
      .locator('.all-category-searches .search-output')
      .filter({ hasText: 'Shiny' });
    await expect(shinyOutput.locator('.search-string code')).toHaveText(
      'shiny&1,7,25,38,133,152,155,158,252',
    );

    await page.getByRole('button', { name: 'Personal', exact: true }).click();
    await expect(output.locator('.search-string code')).toHaveText('!#&4,7,38,133,152,155,158,252');
    await page.getByRole('button', { name: 'Tradeable', exact: true }).click();
    await expect(output.locator('.search-string code')).toHaveText(
      '!traded&4,7,38,133,152,155,158,252',
    );
    await page.getByRole('button', { name: 'None', exact: true }).click();
    await expect(output.locator('.search-string code')).toHaveText('4,7,38,133,152,155,158,252');

    const xxlOutput = page
      .locator('.all-category-searches .search-output')
      .filter({ hasText: 'XXL' });
    await expect(xxlOutput.locator('.search-string code')).not.toContainText('1-4');
    await page.getByRole('checkbox', { name: /Evolution-aware XXL/ }).check();
    await expect(xxlOutput.locator('.search-string code')).toHaveText(
      'xxl&1-4,7,25,38,133,152,155,158,252',
    );
    await expect(page.getByRole('heading', { name: 'My Missing', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cody’s Recommended' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Share With Friends' })).toBeVisible();
    const recommendations = page.locator('.recommended-list article');
    await expect(recommendations).toHaveCount(8);
    expect(await recommendations.locator('h3').allTextContents()).toEqual([
      'Trade',
      'Megas',
      'Tag',
      'Evolve',
      'Special Moves',
      'Untagged',
      'XXL',
      'XXS',
    ]);
    await expect(recommendations.nth(0).locator('code')).toHaveText('#trade&');
    await expect(recommendations.nth(0)).toContainText('adoption');
    await expect(recommendations.nth(1).locator('code')).toHaveText('#max&mega2-3&');
    await expect(recommendations.nth(1)).toContainText('Avoid naming the custom tag “mega”');
    await expect(recommendations.nth(2).locator('code')).toHaveText(
      '!#&4*,shiny,costume,background,candykm20,dynamax,gigantamax,lucky&',
    );
    await expect(recommendations.nth(3).locator('code')).toHaveText('!#&evolvenew&');
    await expect(recommendations.nth(4).locator('code')).toHaveText(
      '!#&@frustration,@return,@special&',
    );
    await expect(recommendations.nth(5).locator('code')).toHaveText('!#&');
    await expect(recommendations.nth(6).locator('code')).toHaveText(/^!#&xxl&/);
    await expect(recommendations.nth(7).locator('code')).toHaveText(/^!#&xxs&/);

    const layout = await page.locator('.generator-panel').evaluate((panel) => {
      const cards = [...panel.querySelectorAll('.search-output')].slice(0, 2);
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      return {
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        panelFits: panel.getBoundingClientRect().right <= document.documentElement.clientWidth,
        stringsFit: [...panel.querySelectorAll('.search-string')].every(
          (entry) => entry.getBoundingClientRect().right <= panel.getBoundingClientRect().right,
        ),
        searchCardsStack: cardRects.length === 2 && cardRects[1].top >= cardRects[0].bottom,
      };
    });
    expect(layout).toEqual({
      pageOverflows: false,
      panelFits: true,
      stringsFit: true,
      searchCardsStack: true,
    });

    const sharePicker = page.getByRole('group', { name: 'Lists to share' });
    const shareToggleLayout = await sharePicker.evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')].map((button) =>
        button.getBoundingClientRect(),
      );
      return {
        firstRowAligned: Math.abs(buttons[0].top - buttons[1].top) <= 1,
        secondRowAligned: Math.abs(buttons[2].top - buttons[3].top) <= 1,
        twoRows: buttons[2].top > buttons[0].bottom,
        fits: buttons.every((button) => button.right <= innerWidth),
      };
    });
    expect(shareToggleLayout).toEqual({
      firstRowAligned: true,
      secondRowAligned: true,
      twoRows: true,
      fits: true,
    });
    await sharePicker.getByRole('button', { name: /^Normal/ }).click();
    await sharePicker.getByRole('button', { name: /^Shiny/ }).click();
    const preview = page.locator('.discord-message-list pre');
    await expect(preview).not.toContainText('**Normal**');
    await expect(preview).not.toContainText('**Shiny**');
    await expect(preview).toContainText('**XXL**');
    await expect(preview).toContainText('**XXS**');
    await expect(preview).toContainText('[Generated by CatchGrid](https://dex.cjdev.app/)');
    await expect(page.getByRole('button', { name: 'Copy Discord message' })).toBeVisible();
    await page.getByRole('checkbox', { name: /Discord Nitro/ }).check();
    await expect(page.locator('.discord-message-list article').first()).toContainText(
      '/4,000 characters',
    );
    const nitroCheckboxSize = await page
      .getByRole('checkbox', { name: /Discord Nitro/ })
      .evaluate((checkbox) => {
        const box = checkbox.getBoundingClientRect();
        return { width: Math.round(box.width), height: Math.round(box.height) };
      });
    expect(nitroCheckboxSize).toEqual({ width: 17, height: 17 });
  });

  test('CSV fixture produces a client-side preview without applying changes', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await openMobileRoute(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    await page
      .getByLabel('Choose a CSV file to preview')
      .setInputFiles(resolve(fixtureDirectory, 'collection-preview.csv'));

    await expect(page.getByText('collection-preview.csv')).toBeVisible();
    const stats = page.locator('.preview-stats');
    await expect(stats).toContainText('2 matched');
    await expect(stats).toContainText('2 add');
    await expect(stats).toContainText('0 remove');
    await expect(stats).toContainText('0 issues');

    const table = page.locator('.preview-table-wrap table');
    await expect(table).toContainText('Charmander');
    await expect(table).toContainText('Squirtle');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByText('Showing 1–2 of 2 proposed changes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply reviewed import' })).toBeEnabled();
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('CSV review paginates every blocking issue and keeps Apply disabled', async ({ page }) => {
    await installFakeApi(page);
    await page.goto('/#/settings');
    const csv = `name,normal\n${Array.from(
      { length: 20 },
      (_, index) => `Unknown form ${index + 1},true`,
    ).join('\n')}`;
    await page.getByLabel('Choose a CSV file to preview').setInputFiles({
      name: 'many-issues.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText('Showing 1–12 of 20 issues')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Showing 13–20 of 20 issues')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply reviewed import' })).toBeDisabled();
  });

  test('reviewed CSV import applies locally and survives a reload', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);
    await openMobileRoute(page, 'Settings');
    await page
      .getByLabel('Choose a CSV file to preview')
      .setInputFiles(resolve(fixtureDirectory, 'collection-preview.csv'));

    await page.getByRole('button', { name: 'Apply reviewed import' }).click();
    await expect(page.locator('.toast')).toContainText('Import applied: 2 added, 0 removed.');
    await expect(page.locator('.import-panel')).toContainText('Import complete');
    await expect(page.locator('.import-panel')).toContainText(
      'Import applied: 2 added and 0 removed.',
    );

    const importedEntries = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('catchgrid:local-profile:v2') ?? '{}');
      return saved.collectionEntries;
    });
    expect(importedEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          formId: 'form-0004-standard',
          categoryId: 'normal',
          collected: true,
        }),
        expect.objectContaining({
          formId: 'form-0007-standard',
          categoryId: 'shiny',
          collected: true,
        }),
      ]),
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    const persistedEntries = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('catchgrid:local-profile:v2') ?? '{}');
      return saved.collectionEntries;
    });
    expect(persistedEntries).toEqual(expect.arrayContaining(importedEntries));
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('malformed quoted CSV shows a recoverable preview error', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await openMobileRoute(page, 'Settings');
    await page
      .getByLabel('Choose a CSV file to preview')
      .setInputFiles(resolve(fixtureDirectory, 'collection-malformed.csv'));

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('CSV preview unavailable');
    await expect(alert).toContainText('Unclosed quoted field');
    await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply reviewed import' })).toHaveCount(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });
});
