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

async function swipeHorizontally(target: Locator, direction: 'left' | 'right') {
  await target.evaluate((element, swipeDirection) => {
    const rect = element.getBoundingClientRect();
    const startX = swipeDirection === 'left' ? rect.right - 28 : rect.left + 28;
    const endX = swipeDirection === 'left' ? rect.left + 28 : rect.right - 28;
    const y = rect.top + rect.height / 2;
    const touch = (clientX: number) =>
      new Touch({
        identifier: 1,
        target: element,
        clientX,
        clientY: y,
        pageX: clientX,
        pageY: y,
        screenX: clientX,
        screenY: y,
      });
    const start = touch(startX);
    const end = touch(endX);

    element.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [start],
        targetTouches: [start],
        changedTouches: [start],
      }),
    );
    element.dispatchEvent(
      new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [end],
        targetTouches: [end],
        changedTouches: [end],
      }),
    );
    element.dispatchEvent(
      new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: [end],
      }),
    );
  }, direction);
}

test.describe('mobile collection experience', () => {
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
      };
    });

    expect(layout.computedTracks).toBe(3);
    expect(layout.firstRowCards).toBe(3);
    expect(layout.documentClientWidth).toBe(390);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth);
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth);
    expect(layout.gridLeft).toBeGreaterThanOrEqual(0);
    expect(layout.gridRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  });

  test('keeps search and essential filters above a boxed collection scroller', async ({ page }) => {
    await installFakeApi(page);
    await openDex(page);

    await expect(page.getByLabel('Type')).toHaveCount(0);
    const browser = page.locator('.dex-browser');
    await browser.evaluate((element) => window.scrollTo(0, element.offsetTop - 68));

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

    const controls = await page.locator('.search-field input').evaluate((element) => {
      const rect = element.closest('.dex-controls')!.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight };
    });
    expect(controls.top).toBeGreaterThanOrEqual(68);
    expect(controls.bottom).toBeLessThan(controls.viewportHeight - 70);
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

  test('Quick Check toggles one entry and Undo restores its observed baseline', async ({
    page,
  }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    const quickCheck = page.getByRole('button', { name: /^Quick Check/ });
    await quickCheck.click();
    await expect(quickCheck).toHaveAttribute('aria-pressed', 'true');

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

    const toast = page.locator('.toast');
    await expect(toast).toContainText(/Bulbasaur marked (collected|missing) in normal\./);
    await toast.getByRole('button', { name: 'Undo' }).click();

    await expect(card).toHaveAttribute('aria-pressed', baselinePressed ?? '');
    await expect(card).toHaveAttribute('data-state', baselineState ?? '');
    await expect(toast).toContainText('Last checklist change undone.');
    expect(api.collectionMutationCount).toBe(1);
    expect(api.undoCount).toBe(1);
    expect(api.isCollected('form-0001-standard', 'normal')).toBe(baselinePressed === 'true');
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('Search Lab generates and filters a Pokémon GO missing string', async ({ page }) => {
    await installFakeApi(page);
    await openDex(page);

    await page.locator('.bottom-nav').getByRole('button', { name: 'Search Lab' }).click();
    await expect(page).toHaveURL(/#\/search$/);
    await expect(
      page.getByRole('heading', { name: 'Turn gaps into useful searches.' }),
    ).toBeVisible();

    const output = page.locator('.search-output');
    await expect(output).toContainText('7 missing entries');
    await expect(output.locator('.search-string code')).toHaveText(
      '!traded&4,7,133,152,155,158,252',
    );
    await expect(output).toContainText(
      'Matches the released normal Pokedex entries currently marked missing.',
    );

    await page.getByLabel('Generation').selectOption('1');
    await expect(output).toContainText('3 missing entries');
    await expect(output.locator('.search-string code')).toHaveText('!traded&4,7,133');

    await page.getByLabel('Category').selectOption('shiny');
    await expect(output.locator('.search-string code')).toHaveText('!traded&shiny&1,7,25,133');

    const xxlRecommendation = page
      .locator('.recommended-list article')
      .filter({ hasText: 'My missing XXL families' });
    await expect(xxlRecommendation.locator('code')).toHaveText(
      '!traded&xxl&1-4,7,25,133,152,155,158,252',
    );
    await expect(xxlRecommendation).toContainText(
      'includes catchable family stages you can evolve',
    );

    await page.getByRole('button', { name: 'My wanted trades' }).click();
    await page.getByLabel('Request').selectOption('xxl');
    await expect(output).toContainText('1 requested entry');
    await expect(output.locator('.search-string code')).toHaveText('!traded&xxl&7');
  });

  test('Trade lets an owned size satisfy and remove an active size request', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await page.locator('.bottom-nav').getByRole('button', { name: 'Trade' }).click();
    await expect(page).toHaveURL(/#\/trade$/);
    await expect(page.getByRole('heading', { name: 'Wanted' })).toBeVisible();
    const supportedRequests = page.locator('.trade-trait-strip');
    for (const request of ['Normal', 'Shiny', 'XXL', 'XXS', 'Costume']) {
      await expect(supportedRequests.getByText(request, { exact: true })).toBeVisible();
    }

    const requestCard = page.locator('.trade-wanted-card').filter({ hasText: 'Squirtle' });
    await expect(requestCard).toContainText('XXL');
    await requestCard.getByRole('button', { name: 'I have this' }).click();

    await expect(page.getByText('No active requests')).toBeVisible();
    await expect.poll(() => api.collectionMutationCount).toBe(1);
    expect(api.wantedMutationCount).toBe(0);
    expect(api.isCollected('form-0007-standard', 'xxl')).toBe(true);
    expect(api.isWanted('form-0007-standard', 'xxl')).toBe(false);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('CSV fixture produces a client-side preview without applying changes', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await page.locator('.bottom-nav').getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    await page
      .locator('input[type="file"]')
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
    await expect(page.getByRole('button', { name: 'Apply reviewed import' })).toBeEnabled();
    expect(api.collectionMutationCount).toBe(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });

  test('malformed quoted CSV shows a recoverable preview error', async ({ page }) => {
    const api = await installFakeApi(page);
    await openDex(page);

    await page.locator('.bottom-nav').getByRole('button', { name: 'Profile' }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles(resolve(fixtureDirectory, 'collection-malformed.csv'));

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('CSV preview unavailable');
    await expect(alert).toContainText('Unclosed quoted field');
    await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply reviewed import' })).toHaveCount(0);
    expect(api.unexpectedWriteCount).toBe(0);
  });
});
