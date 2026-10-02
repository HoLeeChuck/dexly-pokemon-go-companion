/* global document, getComputedStyle, window */
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:4188';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('L2 captures must use a local preview.');
const output = resolve(process.argv[2] ?? 'docs/shots/l2-after');
await mkdir(output, { recursive: true });
const demo = JSON.parse(await readFile('docs/fixtures/demo-collection.json', 'utf8'));
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined,
});
const measurements = [];
try {
  for (const [device, width, height] of [
    ['desktop', 1440, 900],
    ['phone', 390, 844],
  ]) {
    for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'America/Chicago',
        ...(device === 'phone'
          ? {
              userAgent:
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
            }
          : {}),
      });
      const page = await context.newPage();
      const errors = [];
      const csp = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.exposeFunction('recordL2Csp', (event) => csp.push(event));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) =>
          window.recordL2Csp({ directive: event.violatedDirective, blockedURI: event.blockedURI }),
        );
        Object.defineProperty(navigator, 'storage', {
          value: { persisted: async () => false, persist: async () => false },
        });
      });
      await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
      const response = await page.goto(`${base}/#home`);
      const hasCsp = Boolean(response.headers()['content-security-policy']);
      if (process.env.SHOT_REQUIRE_CSP === '1' && !hasCsp)
        throw new Error('Production CSP missing');
      if (theme !== (await page.locator('html').getAttribute('data-theme')))
        await page.locator('.theme-toggle').click();
      async function capture(name, home = false, screenshot = true) {
        await page.locator('.toast').waitFor({ state: 'hidden' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          for (const image of document.images) image.loading = 'eager';
          await Promise.all([...document.images].map((image) => image.decode()));
        });
        const file = `${device}-${theme}-${name}.png`;
        const measurement = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          contentHeight:
            document.documentElement.scrollHeight -
            parseFloat(getComputedStyle(document.body).paddingBottom) -
            Math.max(
              0,
              parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom) - 35,
            ),
          freshness: document.querySelector('.catalog-freshness')?.textContent ?? null,
        }));
        if (home && device === 'phone') expect(measurement.contentHeight).toBeLessThanOrEqual(2400);
        expect(measurement.width).toBe(width);
        if (screenshot)
          await page.screenshot({
            path: resolve(output, file),
            fullPage: !name.startsWith('details'),
            animations: 'disabled',
          });
        measurements.push({
          file: screenshot ? file : null,
          device,
          theme,
          state: name,
          hasCsp,
          errors: [...errors],
          csp: [...csp],
          ...measurement,
        });
      }
      async function homeCapture(state) {
        await page.clock.setFixedTime(new Date('2026-10-08T12:00:00Z'));
        await page.goto(`${base}/#home`);
        await capture(`home-${state}`, true);
        await page.clock.setFixedTime(new Date('2026-10-23T12:00:00Z'));
        await page.reload();
        await capture(`home-${state}-stale`, true, false);
        await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
      }
      async function restore(count) {
        await page.goto(`${base}/#settings`);
        const fixture = structuredClone(demo);
        fixture.profile.collectionEntries = fixture.profile.collectionEntries.slice(0, count);
        await page.locator('#import-file').setInputFiles({
          name: 'demo.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(fixture)),
        });
        await page.getByRole('button', { name: 'Apply reviewed import' }).click();
      }
      await homeCapture('new');
      await restore(232);
      const download = page.waitForEvent('download');
      await page.locator('[data-export="json"]').click();
      await download;
      await homeCapture('returning');
      await restore(25);
      await homeCapture('banner');
      await page.goto(`${base}/#settings`);
      await page.locator('[data-bulk="Kanto"][data-bulk-collected="false"]').click();
      await page.locator('[data-bulk-confirm]').click();
      await homeCapture('both-notices');
      await page.goto(`${base}/#dex`);
      await capture('dex-shelf');
      await page.goto(`${base}/#progress`);
      await page.getByRole('button', { name: 'View details for Bulbasaur', exact: true }).click();
      await page.locator('#inspect-dialog .entry-report summary').click();
      await page.locator('#inspect-dialog .report-actions').scrollIntoViewIfNeeded();
      await capture('details-report');
      await page.keyboard.press('Escape');
      await page.goto(`${base}/#about`);
      await page.locator('main .entry-report summary').click();
      await capture('sources');
      await page.goto(`${base}/#settings`);
      await page.getByText('Or paste rows from your spreadsheet').click();
      await page
        .getByLabel('Rows copied from your spreadsheet')
        .fill(
          'Number\tPokémon\tGender\t\tShiny\t100%\tLucky\tXXL\tXXS\tShadow\tPurified\n132\tDitto\tNeutral\t\t\t\t\t\t\tShadow\t',
        );
      await page.getByRole('button', { name: 'Review pasted rows' }).click();
      await page.getByText('See skipped cells').click();
      await page.locator('#import-review .entry-report summary').click();
      await capture('skipped-cells');
      expect(errors).toEqual([]);
      expect(csp).toEqual([]);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(
    resolve(output, 'measurements.json'),
    JSON.stringify(measurements, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    captures: measurements.filter((item) => item.file).length,
    measurements: measurements.length,
    maximumPhoneHomeHeight: Math.max(
      ...measurements
        .filter((item) => item.device === 'phone' && item.state.startsWith('home-'))
        .map((item) => item.contentHeight),
    ),
  }),
);
