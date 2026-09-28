import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import demo from '../../docs/fixtures/demo-collection.json' with { type: 'json' };
import { measureHomeSections } from './home-diagnostics';

const start = new Date('2026-09-28T12:00:00Z');
const week = 7 * 86400000;
const profile = 'catchgrid:local-profile:v2';
const ios =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

async function safetyApi(page: Page, result: 'yes' | 'no' | 'error' | 'unsupported' = 'yes') {
  let requests = 0;
  await page.exposeFunction('f1Request', () => {
    requests++;
  });
  await page.addInitScript((result) => {
    Object.defineProperty(navigator, 'storage', {
      value:
        result === 'unsupported'
          ? undefined
          : {
              persisted: async () => false,
              persist: async () => {
                await (window as unknown as { f1Request(): Promise<void> }).f1Request();
                if (result === 'error') throw new Error('Request unavailable');
                return result === 'yes';
              },
            },
    });
  }, result);
  return () => requests;
}
async function restore(page: Page, count: number) {
  await page.goto('/#settings');
  const fixture = structuredClone(demo);
  fixture.profile.collectionEntries = fixture.profile.collectionEntries.slice(0, count);
  await page.locator('#import-file').setInputFiles({
    name: 'f1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  await page.goto('/#home');
}
async function stored(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), profile);
}
async function exportJson(page: Page, selector = '[data-export="json"]') {
  const downloaded = page.waitForEvent('download');
  await page.locator(selector).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  return JSON.parse(await readFile(path!, 'utf8'));
}

test('F1 backup threshold, dismissal, reload and JSON export preserve the collection', async ({
  page,
}) => {
  await safetyApi(page);
  await page.clock.setFixedTime(start);
  await restore(page, 24);
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  await restore(page, 25);
  await expect(
    page.getByRole('complementary', { name: 'Collection backup reminder' }),
  ).toBeVisible();
  const before = await stored(page);
  await page.getByRole('button', { name: 'Dismiss backup reminder' }).click();
  await page.reload();
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  expect(await stored(page)).toBe(before);
  await page.clock.setFixedTime(new Date(start.getTime() + week));
  await page.reload();
  await expect(page.locator('.backup-notice')).toBeVisible();
  const backup = await exportJson(page, '.backup-notice [data-export]');
  expect(backup.profile.collectionEntries).toEqual(JSON.parse(before!).collectionEntries);
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  expect(await stored(page)).toBe(before);
  await page.goto('/#settings');
  await expect(page.locator('#storage-safety')).toContainText('Last export:');
  await expect(page.locator('#storage-safety')).toContainText('Phone and computer are separate.');
});

test('F1 a small changed collection waits seven days and an unchanged export never nags', async ({
  page,
}) => {
  await safetyApi(page);
  await page.clock.setFixedTime(start);
  await restore(page, 2);
  await page.clock.setFixedTime(new Date(start.getTime() + week - 1));
  await page.reload();
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  await page.clock.setFixedTime(new Date(start.getTime() + week));
  await page.reload();
  await expect(page.locator('.backup-notice')).toBeVisible();
  const before = await stored(page);
  await exportJson(page);
  await page.clock.setFixedTime(new Date(start.getTime() + week * 3));
  await page.reload();
  await expect(page.locator('.backup-notice')).toHaveCount(0);
  expect(await stored(page)).toBe(before);
});

for (const format of ['csv', 'xlsx']) {
  test(`F1 ${format} export clears the reminder without changing the collection`, async ({
    page,
  }) => {
    await safetyApi(page);
    await restore(page, 25);
    const before = await stored(page);
    await page.goto('/#settings');
    const downloaded = page.waitForEvent('download');
    await page.locator(`[data-export="${format}"]`).click();
    expect((await downloaded).suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    await page.goto('/#home');
    await expect(page.locator('.backup-notice')).toHaveCount(0);
    expect(await stored(page)).toBe(before);
  });
}

test('F1 failed export leaves the reminder and collection intact', async ({ page }) => {
  await safetyApi(page);
  await page.addInitScript(() => {
    URL.createObjectURL = () => {
      throw new Error('Download unavailable');
    };
  });
  await restore(page, 25);
  const before = await stored(page);
  await page.locator('.backup-notice [data-export]').click();
  await expect(page.locator('.toast')).toContainText('Download unavailable');
  await expect(page.locator('.backup-notice')).toBeVisible();
  expect(await stored(page)).toBe(before);
});

test('F1 persistence is requested once at the tenth entry and Settings reports the grant', async ({
  page,
}) => {
  const requests = await safetyApi(page);
  await restore(page, 9);
  expect(requests()).toBe(0);
  await restore(page, 10);
  await expect.poll(requests).toBe(1);
  const before = await stored(page);
  await page.goto('/#settings');
  await expect(page.locator('.storage-protection')).toHaveText(
    'Protected from automatic cleanup: yes',
  );
  await page.reload();
  await expect(page.locator('.storage-protection')).toHaveText(
    'Protected from automatic cleanup: no',
  );
  // The fresh query is authoritative (the stub models a grant revoked between visits).
  expect(requests()).toBe(1);
  expect(await stored(page)).toBe(before);
});

for (const result of ['no', 'error', 'unsupported'] as const) {
  test(`F1 persistence ${result} is harmless and displays no`, async ({ page }) => {
    const requests = await safetyApi(page, result);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await restore(page, 10);
    const before = await stored(page);
    await page.goto('/#settings');
    await expect(page.locator('.storage-protection')).toHaveText(
      'Protected from automatic cleanup: no',
    );
    await page.reload();
    await expect(page.locator('.storage-protection')).toContainText(': no');
    expect(requests()).toBe(result === 'unsupported' ? 0 : 1);
    expect(await stored(page)).toBe(before);
    expect(errors).toEqual([]);
  });
}

test('F1 iPhone install hint dismisses durably and never writes a collection', async ({ page }) => {
  await safetyApi(page);
  await page.addInitScript(
    (ua) => Object.defineProperty(navigator, 'userAgent', { value: ua }),
    ios,
  );
  await page.goto('/#home');
  await expect(page.locator('.install-hint')).toBeVisible();
  const before = await stored(page);
  await page.getByRole('button', { name: 'Dismiss iPhone install hint' }).click();
  await page.reload();
  await expect(page.locator('.install-hint')).toHaveCount(0);
  expect(await stored(page)).toBe(before);
});

for (const signal of ['navigator', 'display-mode']) {
  test(`F1 standalone ${signal} hides installation hints and links`, async ({ page }) => {
    await safetyApi(page);
    await page.addInitScript(
      ({ ua, signal }) => {
        Object.defineProperty(navigator, 'userAgent', { value: ua });
        if (signal === 'navigator') Object.defineProperty(navigator, 'standalone', { value: true });
        else {
          const original = window.matchMedia.bind(window);
          window.matchMedia = (query) => {
            const media = original(query);
            if (query === '(display-mode: standalone)')
              Object.defineProperty(media, 'matches', { value: true });
            return media;
          };
        }
      },
      { ua: ios, signal },
    );
    await page.goto('/#home');
    await expect(page.locator('.first-run')).toBeVisible();
    await expect(page.locator('.install-hint')).toHaveCount(0);
    await restore(page, 25);
    await expect(page.locator('.backup-notice')).toBeVisible();
    await expect(page.locator('.backup-notice a')).toHaveCount(0);
  });
}

test('F1 Home stays within the phone budget with notices, with accessible controls in both themes', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await safetyApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    (ua) => Object.defineProperty(navigator, 'userAgent', { value: ua }),
    ios,
  );
  await page.clock.setFixedTime(start);
  for (const state of ['new', 'returning', 'banner', 'both']) {
    if (state === 'new') await page.goto('/#home');
    if (state === 'returning') {
      await restore(page, 232);
      await exportJson(page);
    }
    if (state === 'banner') {
      await restore(page, 25);
      await page.clock.setFixedTime(new Date(start.getTime() + week));
      await page.reload();
    }
    if (state === 'both') {
      await page.goto('/#settings');
      await page.locator('[data-bulk="Kanto"][data-bulk-collected="false"]').click();
      await page.locator('[data-bulk-confirm]').click();
      await page.goto('/#home');
    }
    for (const theme of ['dark', 'light']) {
      const current = await page.locator('html').getAttribute('data-theme');
      if (theme !== current) await page.locator('.theme-toggle').click();
      await page.evaluate(() => document.fonts.ready);
      const measurement = await measureHomeSections(page);
      await testInfo.attach(`${state}-${theme}-height`, {
        body: JSON.stringify(measurement, null, 2),
        contentType: 'application/json',
      });
      expect(measurement.contentHeight).toBeLessThanOrEqual(2400);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      if (state === 'new' || state === 'both')
        await expect(page.locator('.install-hint')).toBeVisible();
      if (state === 'banner' || state === 'both')
        await expect(page.locator('.backup-notice')).toBeVisible();
      if (state === 'banner' || state === 'both') {
        const dismiss = await page.locator('.backup-notice .notice-dismiss').boundingBox();
        for (const control of await page.locator('.backup-notice .data-notice-actions > *').all()) {
          const box = await control.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(box!.y).toBeGreaterThanOrEqual(dismiss!.y + dismiss!.height);
        }
      }
      const a11y = await new AxeBuilder({ page }).analyze();
      expect(
        a11y.violations
          .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
          .map((v) => v.id),
      ).toEqual([]);
    }
  }
  await page.getByRole('link', { name: 'Add to Home Screen (iPhone)', exact: true }).click();
  await expect(page.locator('#storage-safety')).toBeFocused();
  await expect(page.locator('.install-instructions')).toHaveAttribute('open', '');
  await expect(page.locator('.install-instructions')).toContainText('Download JSON first');
});
