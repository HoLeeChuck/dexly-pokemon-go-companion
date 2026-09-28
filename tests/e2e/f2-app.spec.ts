import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

const profileKey = 'catchgrid:local-profile:v2';
const profile = (page: Page) => page.evaluate((key) => localStorage.getItem(key), profileKey);
const picker = (page: Page) => page.getByRole('group', { name: 'Progress category', exact: true });

async function phoneProgress(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#progress');
  await page.locator('[data-region]').selectOption('Kanto');
}

async function points(page: Page) {
  await page
    .locator('.collection-grid')
    .evaluate((grid) => grid.scrollIntoView({ behavior: 'instant' }));
  const boxes = page.locator('button.gcell');
  const first = (await boxes.nth(0).boundingBox())!;
  const last = (await boxes.nth(5).boundingBox())!;
  return {
    x: first.x + first.width / 2,
    y1: first.y + first.height / 2,
    y2: last.y + last.height / 2,
  };
}

test('F2 phone categories, artwork, 44px targets, filters and search stay in sync', async ({
  page,
}) => {
  await phoneProgress(page);
  await expect(picker(page).getByRole('button')).toHaveCount(10);
  for (const category of [
    'normal',
    'male',
    'female',
    'shiny',
    'lucky',
    'hundo',
    'xxl',
    'xxs',
    'shadow',
    'purified',
  ]) {
    await picker(page).locator(`[data-focus-cat="${category}"]`).click();
    await expect(page.locator('[data-category-select]')).toHaveValue(category);
    await expect(picker(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    const rows = await page.locator('.collection-grid tbody tr').evaluateAll((rows) =>
      rows.map((row) => {
        const cells = [...row.querySelectorAll<HTMLElement>('.gcell')];
        const image = row.querySelector('img')!;
        return {
          count: cells.length,
          category: cells[0].dataset.cat,
          width: cells[0].getBoundingClientRect().width,
          height: cells[0].getBoundingClientRect().height,
          imageWidth: image.getBoundingClientRect().width,
        };
      }),
    );
    expect(rows.length).toBe(151);
    for (const row of rows) {
      expect(row.count).toBe(1);
      expect([category, undefined]).toContain(row.category); // Ineligible entries are noninteractive.
      expect(row.width).toBeGreaterThanOrEqual(44);
      expect(row.height).toBeGreaterThanOrEqual(44);
      expect(row.imageWidth).toBe(36);
    }
    await expect(page.locator('.gcell[tabindex="0"]')).toHaveCount(1);
  }
  expect(await profile(page)).toBeNull();
  await picker(page).getByRole('button', { name: 'Shiny', exact: true }).click();
  await page.getByRole('button', { name: 'Bulbasaur Shiny', exact: true }).click();
  await expect(page.locator('#grid-string')).toContainText(/^2,3,/);
  await page.getByRole('button', { name: 'Have Shiny', exact: true }).click();
  await expect(page.locator('.collection-grid tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Missing Shiny', exact: true }).click();
  await expect(page.locator('button.gcell[data-cell="form-0001-standard"]')).toHaveCount(0);
  await page.locator('[data-category-select]').selectOption('lucky');
  await expect(picker(page).getByRole('button', { name: 'Lucky', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#grid-string')).toContainText(/^1,2,3,/);
});

test('F2 comparison and the 700px boundary preserve data, single tab stop and details', async ({
  page,
}) => {
  await phoneProgress(page);
  await page.getByRole('button', { name: 'Bulbasaur Normal', exact: true }).click();
  const saved = await profile(page);
  const compare = page.getByRole('button', { name: 'Compare categories' });
  await compare.click();
  await expect(compare).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.collection-grid')).toHaveCount(1);
  await expect(
    page.locator('.collection-grid tbody tr').first().locator('button.gcell'),
  ).toHaveCount(10);
  await expect(page.locator('.gcell[tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('tr[data-key="row-form-0001-standard"] .grid-done span')).toHaveText(
    '10%',
  );
  await page.getByRole('button', { name: 'View details for Bulbasaur', exact: true }).click();
  await page.keyboard.press('Escape');
  await compare.click();
  await expect(page.locator('.single-category')).toHaveCount(1);
  for (const width of [699, 700, 844, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.single-category')).toHaveCount(width < 700 ? 1 : 0);
    await expect(picker(page)).toHaveCount(width < 700 ? 1 : 0);
    await expect(page.locator('.gcell[tabindex="0"]')).toHaveCount(1);
  }
  expect(await profile(page)).toBe(saved);
  await expect(page.getByRole('button', { name: 'Bulbasaur Normal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('F2 a fast phone drag saves one range with recovery and Undo', async ({
  page,
  browserName,
}) => {
  await phoneProgress(page);
  // Recovery preserves an existing collection; an empty profile intentionally has no snapshot.
  await page.getByRole('button', { name: 'Bulbasaur Normal', exact: true }).click();
  await picker(page).getByRole('button', { name: 'Shiny', exact: true }).click();
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    (window as unknown as { profileWrites: number }).profileWrites = 0;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) (window as unknown as { profileWrites: number }).profileWrites++;
      return original.call(this, name, value);
    };
  }, profileKey);
  const { x, y1, y2 } = await points(page);
  if (browserName === 'chromium') {
    // Real browser touch events: exercises touch-action and implicit pointer capture.
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: y1 }],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y2 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    // Playwright WebKit has no touch-drag API; exercise the same pointer handler by mouse.
    await page.mouse.move(x, y1);
    await page.mouse.down();
    await page.mouse.move(x, y2);
    await page.mouse.up();
  }
  await expect(page.locator('button.gcell.on')).toHaveCount(6);
  expect(
    await page.evaluate(() => (window as unknown as { profileWrites: number }).profileWrites),
  ).toBe(1);
  await expect(page.locator('.toast')).toContainText('6 Shiny entries collected');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('button.gcell.on')).toHaveCount(0);
  await page.goto('/#settings');
  await expect(page.getByText('Before filling the grid', { exact: false }).first()).toBeVisible();
});

test('F2 interrupted and second-pointer gestures never save; touch names still scroll', async ({
  page,
  browserName,
}) => {
  await phoneProgress(page);
  const { x, y1, y2 } = await points(page);
  for (const reason of ['cancel', 'second-pointer', 'resize']) {
    await page.mouse.move(x, y1);
    await page.mouse.down();
    await page.mouse.move(x, y2);
    await expect(page.locator('.gcell.filling')).toHaveCount(6);
    if (reason === 'resize') {
      await page.setViewportSize({ width: 700, height: 844 });
    } else {
      await page
        .locator('button.gcell')
        .first()
        .dispatchEvent(reason === 'cancel' ? 'pointercancel' : 'pointerdown', {
          pointerId: reason === 'cancel' ? 1 : 999,
          pointerType: 'touch',
          isPrimary: false,
          button: 0,
        });
    }
    await page.mouse.up();
    await expect(page.locator('.gcell.filling')).toHaveCount(0);
    expect(await profile(page), `No save after ${reason}`).toBeNull();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator('button.gcell')
      .first()
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe('none');
  expect(
    await page
      .locator('.grid-name')
      .first()
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).not.toBe('none');
  if (browserName === 'chromium') {
    await page
      .locator('.collection-grid')
      .evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
    const box = (await page.locator('.grid-scroll').boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const point = { x: box.x + 80, y: box.y + 300 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, y: point.y - 160 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(() => page.locator('.grid-scroll').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await session.detach();
    expect(await profile(page)).toBeNull();
  }
});

test('F2 a failed drag save leaves the collection and toggle appearance unchanged', async ({
  page,
}) => {
  await phoneProgress(page);
  await page.getByRole('button', { name: 'Bulbasaur Normal', exact: true }).click();
  const saved = await profile(page);
  await picker(page).getByRole('button', { name: 'Shiny', exact: true }).click();
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, profileKey);
  const { x, y1, y2 } = await points(page);
  await page.mouse.move(x, y1);
  await page.mouse.down();
  await page.mouse.move(x, y2);
  await expect(page.locator('.gcell.filling')).toHaveCount(6);
  await page.mouse.up();
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('button.gcell.on, .gcell.filling')).toHaveCount(0);
  expect(await profile(page)).toBe(saved);
});

test('F2 forms, long names, paging and both themes remain usable at 390px', async ({ page }) => {
  await phoneProgress(page);
  await page.locator('[data-region]').selectOption('All regions');
  await page.locator('[data-grid-page-select]').selectOption('1');
  await expect(page.locator('.gcell[tabindex="0"]')).toHaveCount(1);
  await picker(page).getByRole('button', { name: 'Shadow', exact: true }).click();
  await page.locator('[data-form]').selectOption('mega');
  await expect(picker(page).getByRole('button')).toHaveCount(2);
  await expect(picker(page).getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#grid-search').fill('Charizard');
  await expect(
    page.getByRole('button', { name: 'View details for Mega Charizard X', exact: true }),
  ).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished)),
    );
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      clipped: [...document.querySelectorAll('.grid-name, .grid-label')].some(
        (el) => el.scrollWidth > el.clientWidth,
      ),
    }));
    expect(metrics.width).toBe(390);
    expect(metrics.clipped).toBe(false);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? '')),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Compare categories' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    const compared = await new AxeBuilder({ page }).analyze();
    expect(
      compared.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? '')),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Compare categories' }).click();
  }
  expect(await profile(page)).toBeNull();
});

test('F2 social metadata matches the served 1200x630 PNG and Settings describes drag-fill', async ({
  page,
  request,
}) => {
  await page.goto('/#settings');
  await expect(
    page.getByText('Drag-fill on the Progress grid handles smaller ranges.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Paint mode', { exact: false })).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://dex.cjdev.app/catchgrid-social.png',
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    'content',
    'image/png',
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  const response = await request.get('/catchgrid-social.png');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  const png = await response.body();
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});
