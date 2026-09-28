import { expect, test, type Page } from '@playwright/test';
import demoCollection from '../../docs/fixtures/demo-collection.json' with { type: 'json' };
import nearlyCollection from '../../docs/fixtures/phase2-nearly-complete.json' with { type: 'json' };
import AxeBuilder from '@axe-core/playwright';

// Every test starts from an empty, isolated browser profile.
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 800;

async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await expect(page.locator('main')).not.toBeEmpty();
}

async function markFirstCatch(page: Page) {
  await open(page, 'dex?r=kanto');
  await page.getByRole('button', { name: 'Toggle Normal: missing', exact: true }).click();
}

async function restoreDashboard(page: Page, fixture = demoCollection) {
  await page.clock.setFixedTime(new Date(fixture.createdAt));
  await open(page, 'settings');
  await page.locator('#import-file').setInputFiles({
    name: 'dashboard.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  await open(page, 'home');
}

test('returning Home has recent artwork, medal partners and an accessible responsive heatmap', async ({
  page,
}) => {
  await restoreDashboard(page);
  await expect(page.locator('.kpi-recent img')).toHaveCount(3);
  await expect(page.locator('.kpi-recent img').first()).toHaveCSS('width', '28px');
  await expect(page.locator('.medal-mark img')).toHaveCount(10);
  await expect(page.locator('[data-key="medal-Kanto"]')).toHaveClass(/bronze/);
  await expect(page.locator('[data-key="medal-Kanto"] .medal-mark')).toHaveCSS(
    'border-top-color',
    'rgb(184, 129, 78)',
  );
  await expect(page.locator('[data-key="medal-Johto"] .medal-mark')).toHaveCSS(
    'border-top-color',
    'rgb(185, 194, 204)',
  );
  await expect(page.locator('[data-key="medal-Unova"]')).toContainText('No medal yet');
  await expect(page.locator('[data-key="medal-Unova"]')).toContainText('5 to bronze');
  await expect(page.locator('[data-key="medal-Unova"] img')).not.toHaveCSS('filter', 'none');
  if (isMobile(page)) {
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      2400,
    );
    await expect(page.locator('.region-bar')).toHaveCount(11);
    const picker = page.getByRole('combobox', { name: 'Category', exact: true });
    await expect(picker).toHaveValue('normal');
    await picker.focus();
    await picker.selectOption('shiny');
    await expect(picker).toBeFocused();
    await expect(page.locator('.region-bar').first()).toContainText('10 / 151');
    await page.getByText('Show full table', { exact: true }).click();
  }
  const table = page.getByRole('table', { name: 'Regional collection counts by category' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(12);
  const zero = table.locator('.heat-cell.zero').first();
  await expect(zero.locator('span')).toHaveText('·');
  await expect(zero).toHaveAttribute('title', /^0 of \d+$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
      .map((v) => v.id),
  ).toEqual([]);
});

test('almost-complete cards show missing categories and open details without modifying ownership', async ({
  page,
}) => {
  await restoreDashboard(page, nearlyCollection);
  const shelf = page.locator('.nearly-list');
  const cards = shelf.locator('.nearly-item');
  await expect(cards).toHaveCount(6);
  await expect(cards.first().locator('img')).toHaveCSS('width', '72px');
  await expect(cards.first()).toContainText(/#\d{4}/);
  await expect(cards.first().locator('.missing-chip')).not.toHaveCount(0);
  const ratio = await shelf.evaluate(
    (el) => el.querySelector('.nearly-item')!.getBoundingClientRect().width / el.clientWidth,
  );
  expect(ratio).toBeCloseTo(isMobile(page) ? 1 / 1.3 : 1 / 4, 1);
  const before = await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'));
  await cards.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Pokémon collection details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cards.first()).toBeFocused();
  // Tab along the shelf must reveal its off-screen cards without moving the whole page sideways.
  for (let i = 1; i < 6; i++) await page.keyboard.press('Tab');
  await expect(cards.last()).toBeFocused();
  expect(await shelf.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Pokémon collection details' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'))).toBe(
    before,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('medal partners fill with the earned tier and weekly artwork disappears for old entries', async ({
  page,
}) => {
  const fixture = structuredClone(demoCollection);
  for (let n = 46; n <= 100; n++)
    fixture.profile.collectionEntries.push({
      formId: `form-${String(n).padStart(4, '0')}-standard`,
      categoryId: 'normal',
      collected: true,
      updatedAt: fixture.createdAt,
    });
  await restoreDashboard(page, fixture);
  await expect(page.locator('[data-key="medal-Kanto"] .medal-mark')).toHaveCSS(
    'border-top-color',
    'rgb(227, 179, 65)',
  );
  await expect(page.locator('[data-key="medal-Kanto"] img')).toHaveCSS('filter', 'none');
  await open(page, 'settings');
  await page.locator('[data-bulk="Kanto"][data-bulk-collected="true"]').click();
  await page.getByRole('button', { name: /^Mark all/ }).click();
  await open(page, 'home');
  await expect(page.locator('[data-key="medal-Kanto"] .medal-mark')).toHaveCSS(
    'border-top-color',
    'rgb(159, 227, 224)',
  );
  await page.clock.setFixedTime(new Date('2026-10-27T18:00:00.000Z'));
  await page.reload();
  await expect(page.locator('[data-key="kpi-week"] .kpi-value')).toHaveText('0');
  await expect(page.locator('.kpi-recent')).toHaveCount(0);
});

test('first-run Home introduces the app without empty progress and has a logical tab order', async ({
  page,
}) => {
  await open(page, 'home');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Track every catch. Build the perfect search.',
  );
  await expect(page.locator('main')).not.toContainText('0%');
  await expect(page.locator('.kpi-row')).toHaveCount(0);
  await expect(page.locator('.first-run-parade img')).toHaveCount(7);
  await expect(page.locator('.first-run-regions .device-card')).toHaveCount(5);
  await page.locator('main').focus();
  for (const name of [
    'Start with your Pokédex',
    'Import a backup',
    'Try the Search Lab',
    'Open the Kanto Pokédex',
    'Open the Johto Pokédex',
    'Open the Hoenn Pokédex',
    'Open the Sinnoh Pokédex',
    'Open the Unova Pokédex',
    'See every region',
  ]) {
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name, exact: name !== 'See every region' }),
    ).toBeFocused();
  }
  await page.getByRole('link', { name: 'Open the Johto Pokédex', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Johto Pokédex' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Toggle Normal: missing', exact: true }),
  ).toBeVisible();
});

test('first-run backup action focuses the existing reviewed import and restores the dashboard', async ({
  page,
}) => {
  await open(page, 'home');
  await page.getByRole('link', { name: 'Import a backup', exact: true }).click();
  const input = page.locator('#import-file');
  await expect(input).toBeFocused();
  await input.setInputFiles({
    name: 'demo-collection.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoCollection)),
  });
  await expect(page.locator('#import-review')).toContainText('232 collected entries');
  await open(page, 'home');
  await expect(page.locator('.first-run')).toBeVisible();
  await open(page, 'settings');
  await input.setInputFiles({
    name: 'demo-collection.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoCollection)),
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  await open(page, 'home');
  await expect(page.locator('.first-run')).toHaveCount(0);
  await expect(page.locator('[data-key="kpi-species"] .kpi-value')).toHaveText('180');
  await expect(page.locator('.ring-legend-item.cat-shiny small')).toHaveText(/^40 \/ /);
  await expect(page.locator('.ring-legend-item.cat-lucky small')).toHaveText(/^12 \/ /);
  await page.reload();
  await expect(page.locator('[data-key="kpi-species"] .kpi-value')).toHaveText('180');
  expect(await page.evaluate(() => '__catchgridDevSeed' in window)).toBe(false);
});

test('first-run parade is static and full colour with reduced motion in both themes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'home');
  for (const theme of ['dark', 'light']) {
    if (theme === 'light')
      await page.getByRole('button', { name: 'Switch to light appearance' }).click();
    for (const img of await page.locator('.first-run-parade img').all()) {
      await expect(img).toHaveCSS('animation-name', 'none');
      await expect(img).toHaveCSS('filter', 'none');
      await expect(img).toHaveCSS('opacity', '1');
    }
  }
});

test('the first marked catch switches Home to the dashboard and removing it restores onboarding', async ({
  page,
}) => {
  await markFirstCatch(page);
  await open(page, 'home');
  await expect(page.locator('.kpi-row')).toBeVisible();
  await expect(page.locator('.first-run')).toHaveCount(0);
  await open(page, 'dex?r=kanto');
  await page.getByRole('button', { name: 'Toggle Normal: collected', exact: true }).click();
  await open(page, 'home');
  await expect(page.locator('.first-run')).toBeVisible();
});

test('marks a Pokémon from the Dex grid and keeps it after reload', async ({ page }) => {
  await open(page, 'dex?r=kanto');
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.getByRole('button', { name: /^Toggle Bulbasaur Normal, missing/ }).click();
  await expect(
    page.getByRole('button', { name: /^Toggle Bulbasaur Normal, collected/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(
    page.getByRole('button', { name: /^Toggle Bulbasaur Normal, collected/ }),
  ).toBeVisible();
});

test('viewing details never changes collection state', async ({ page }) => {
  await open(page, 'dex?r=kanto');
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.getByRole('button', { name: 'View details for Ivysaur' }).click();
  const inspector = page.getByRole('complementary', { name: 'Ivysaur collection inspector' });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Toggle Normal: missing' })).toBeVisible();
});

test('the Pokédex shelf opens a region device with a working scanner', async ({ page }) => {
  await open(page, 'dex');
  await expect(page.locator('.device-card')).toHaveCount(12);
  await page.getByRole('link', { name: /^Open the Johto Pokédex/ }).click();
  await expect(page).toHaveURL(/#dex\?r=johto$/);
  await expect(page.getByRole('heading', { name: 'Johto Pokédex' })).toBeVisible();
  const name = page.locator('.hud-readout h3');
  await expect(name).toHaveText('Chikorita');
  await page.getByRole('button', { name: 'Inspect next Pokémon' }).click();
  await expect(name).toHaveText('Bayleef');
  await page.locator('#dex-dial').fill('100');
  await expect(name).toHaveText('Celebi');
  await expect(page.locator('.official-link')).toHaveAttribute(
    'href',
    'https://www.pokemon.com/us/pokedex/celebi',
  );
  await page.getByRole('link', { name: 'All Pokédexes' }).click();
  await expect(page.locator('.device-card')).toHaveCount(12);
});

test('the National Dex grid is paged instead of one endless list', async ({ page }) => {
  await open(page, 'dex?r=national');
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.locator('#dex-results .target-wrap')).toHaveCount(100);
  await page.locator('.pager').first().getByRole('button', { name: '#1001–#1025' }).click();
  await expect(page.locator('#dex-results .target-wrap')).toHaveCount(25);
});

test('the footer links to sources and credits', async ({ page }) => {
  await open(page, 'home');
  await page.locator('footer').getByRole('link', { name: 'Sources & credits' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'about');
  await expect(page.getByRole('heading', { name: 'Copyright and trademarks' })).toBeVisible();
});

test('Search Lab keeps Cody’s eight recommendations in order', async ({ page }) => {
  await open(page, 'search?section=recommended-searches');
  await expect(page.locator('.recommendation h3')).toHaveText([
    'Trade',
    'Megas',
    'Tag',
    'Evolve',
    'Special Moves',
    'Untagged',
    'XXL',
    'XXS',
  ]);
  await expect(page.locator('.recommendation code').first()).toHaveText('#trade&');
});

test('Discord output stays within the message limit', async ({ page }) => {
  await open(page, 'search?section=discord');
  const messages = page.locator('.discord-message pre');
  await expect(messages.first()).toBeVisible();
  for (const text of await messages.allTextContents())
    expect(text.length).toBeLessThanOrEqual(2000);
});

test('builder composes an exact query without touching the collection', async ({ page }) => {
  await open(page, 'search');
  await page.getByLabel('Add a Pokémon GO keyword').fill('buddy3-5');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#query-text')).toHaveText('age0&!#&buddy3-5');
  const stored = await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'));
  expect(stored).toBeNull();
});

test('dragging down a grid column fills a range in one save and can be undone', async ({
  page,
}) => {
  test.skip(isMobile(page), 'Drag-fill is a mouse gesture; touch scrolls the grid instead.');
  await open(page, 'progress');
  await page.locator('[data-region]').selectOption('Kanto');
  const shiny = page.locator('.gcell[data-cat="shiny"]');
  const first = (await shiny.nth(0).boundingBox())!;
  const last = (await shiny.nth(5).boundingBox())!;
  await page.mouse.move(first.x + 8, first.y + 8);
  await page.mouse.down();
  await page.mouse.move(last.x + 8, last.y + 8, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.gcell.on[data-cat="shiny"]')).toHaveCount(6);
  await expect(page.locator('.toast')).toContainText('6 Shiny entries collected');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.gcell.on[data-cat="shiny"]')).toHaveCount(0);
});

test('the grid marks cells by click and keyboard and updates the search string', async ({
  page,
}) => {
  await open(page, 'progress');
  await page.locator('[data-region]').selectOption('Kanto');
  const string = page.locator('#grid-string');
  await expect(string).toContainText(/^1,2,3,/);
  const doneBar = page.locator('tr[data-key="row-form-0001-standard"] td.grid-done .meter b');
  const before = (await doneBar.boundingBox())!.width;
  await page.getByRole('button', { name: 'Bulbasaur Normal', exact: true }).click();
  // The row's progress bar animates up rather than jumping.
  await expect.poll(async () => (await doneBar.boundingBox())!.width).toBeGreaterThan(before);
  // One of ten categories (with Male and Female).
  await expect(page.locator('tr[data-key="row-form-0001-standard"] td.grid-done span')).toHaveText(
    '10%',
  );
  await expect(page.getByRole('button', { name: 'Bulbasaur Normal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(string).toContainText(/^2,3,/);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Ivysaur Normal', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(string).toContainText(/^3,/);
  await page.getByRole('button', { name: 'Tradeable' }).click();
  await expect(string).toContainText(/^!traded&3,/);
  await page.reload();
  await page.locator('[data-region]').selectOption('Kanto');
  await expect(page.locator('.gcell.on[data-cat="normal"]')).toHaveCount(2);
});

test('Progress fits the window with equal-width category columns', async ({ page }) => {
  test.skip(isMobile(page), 'On narrow screens the page scrolls and the grid scrolls sideways.');
  await open(page, 'progress');
  const fits = await page.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight,
  );
  expect(fits).toBe(true);
  const widths = await page
    .locator('.collection-grid tbody tr:first-child .gcell')
    .evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);
});

test('a name in the grid opens details without changing the collection', async ({ page }) => {
  await open(page, 'progress');
  await page.getByRole('button', { name: 'View details for Charmander' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pokémon collection details' });
  await expect(dialog.getByRole('heading', { name: 'Charmander' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Toggle Normal: missing' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.gcell.on')).toHaveCount(0);
});

test('the Home dashboard shows rings, the region heatmap and activity', async ({ page }) => {
  await open(page, 'progress');
  await page.getByRole('button', { name: 'Charmander Normal', exact: true }).click();
  await open(page, 'home');
  await expect(page.locator('.rings-art .ring-value')).toHaveCount(10);
  await expect(page.locator('.ring-legend-item')).toHaveCount(10);
  await expect(page.locator('.ring-legend-item.cat-normal strong')).toHaveText('<1%');
  await expect(page.locator('.ring-legend-item.cat-normal small')).toHaveText(/^1 \/ /);
  await expect(page.locator('[data-key="kpi-week"] .kpi-value')).toHaveText('1');
  await expect(page.locator('[data-key="kpi-species"] .kpi-value')).toHaveText('1');
  if (isMobile(page))
    await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('shiny');
  await page.getByRole('link', { name: /^Kanto Shiny: 0 of/ }).click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'progress');
  await expect(page.locator('[data-region]')).toHaveValue('Kanto');
  await expect(page.locator('.string-scope')).toHaveText('Missing Shiny · Kanto');
});

test('rows pasted from the community spreadsheet are reviewed, then added', async ({ page }) => {
  await open(page, 'settings');
  await page.getByText('Or paste rows from your spreadsheet').click();
  await page
    .getByLabel('Rows copied from your spreadsheet')
    .fill(
      [
        'Number\tPokémon\tGender\t\tShiny\t100%\tLucky\tXXL\tXXS\tShadow\tPurified',
        '1\tBulbasaur\tM\tF\tShiny\t\tLucky\t\t\t\t',
        '29\tNidoran♀️\tFemale\t\t\t100%\t\t\t\t\t',
        '81\tMagnemite\tNeutral\t\t\t\t\tXXL\t\t\t',
        '132\tDitto\tNeutral\t\t\t\t\t\t\tShadow\t',
      ].join('\n'),
    );
  await page.getByRole('button', { name: 'Review pasted rows' }).click();
  const review = page.locator('#import-review');
  await expect(review).toContainText('11 new entries from 4 rows');
  await expect(review).toContainText('1 cells aren’t available in Pokémon GO');
  await review.getByText('See skipped cells').click();
  await expect(review.locator('.sheet-skipped dd')).toContainText('#132 Ditto');
  // Nothing is saved until the review is applied.
  expect(await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'))).toBeNull();
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  await expect(page.locator('.toast')).toContainText('Import saved');
  await open(page, 'progress');
  await page.locator('[data-region]').selectOption('Kanto');
  for (const name of ['Bulbasaur Male', 'Bulbasaur Female', 'Bulbasaur Lucky', 'Nidoran♀ Female'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  await expect(page.getByRole('button', { name: 'Magnemite Male', exact: true })).toHaveCount(0);
});

test('the collection downloads as the community spreadsheet', async ({ page }) => {
  await open(page, 'settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download spreadsheet (.xlsx)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^CatchGrid-Pokedex-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const size = (await (await import('node:fs/promises')).stat((await file.path())!)).size;
  expect(size).toBeGreaterThan(50_000);
});

test('medals, poster and compare link are available on Home', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  // This test verifies PNG download; system Chrome can offer an OS share sheet instead.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
  });
  await markFirstCatch(page);
  await open(page, 'home');
  await expect(page.locator('.medal')).toHaveCount(10);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Create poster/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^CatchGrid-.*\.png$/);
});

test('a compare link shows who can help whom', async ({ page }) => {
  // Friend has registered Bulbasaur (#1) in Normal: first bit set.
  await open(page, 'compare?v=1&c=normal&d=AQ&n=Misty');
  await expect(page.getByRole('heading', { name: 'Misty has 1 of 954' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Misty could help you with 1' })).toBeVisible();
  await open(page, 'compare?v=1&c=normal&d=%3Cbad%3E');
  await expect(page.getByRole('heading', { name: /can’t be read/ })).toBeVisible();
});

test('a compare link is shown for manual copy when the clipboard is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('blocked'));
  });
  await markFirstCatch(page);
  await open(page, 'home');
  await page.getByRole('button', { name: 'Copy compare link' }).click();
  const field = page.getByRole('textbox', { name: 'Text to copy' });
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(/#compare\?v=1&c=normal&d=/);
  await expect(field).toBeFocused();
});

test('quick jump opens a Pokémon from anywhere', async ({ page }) => {
  await open(page, 'home');
  await page.getByRole('button', { name: 'Jump to a Pokémon' }).click();
  await page.locator('#jump-input').fill('garchomp');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('complementary', { name: /Garchomp collection inspector/ }).last(),
  ).toBeVisible();
});

test('bulk region setup asks before changing anything', async ({ page }) => {
  await open(page, 'settings');
  await page.locator('[data-bulk="Hisui"][data-bulk-collected="true"]').click();
  expect(await page.evaluate(() => localStorage.getItem('catchgrid:local-profile:v2'))).toBeNull();
  await page.getByRole('button', { name: /^Mark all/ }).click();
  await expect(page.locator('.toast')).toContainText('Normal entries collected');
});

test('retired and unknown routes fall back to Home', async ({ page }) => {
  for (const hash of ['events', 'field-kit', 'advanced']) {
    await open(page, hash);
    await expect(page.locator('main')).toHaveAttribute('data-route', 'home');
  }
});

test('no horizontal overflow on any destination', async ({ page }) => {
  for (const hash of ['home', 'dex', 'dex?r=national', 'progress', 'search', 'settings', 'about']) {
    await open(page, hash);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
    // Production CSP is style-src 'self': markup must use data-style, never style attributes.
    await expect(page.locator('body [style]:not([data-style])')).toHaveCount(0);
  }
});
