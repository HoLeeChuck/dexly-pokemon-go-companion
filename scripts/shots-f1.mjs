/* global document, getComputedStyle, window */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5184';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('F1 fixture captures must use a local preview.');
const output = resolve(process.argv[2] ?? 'docs/shots/f1-after');
await mkdir(output, { recursive: true });
const fixture = await readFile('docs/fixtures/demo-collection.json');
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined,
});
const measurements = [];
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['phone', 390, 844],
  ]) {
    for (const state of ['new', 'returning', 'banner']) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'America/Chicago',
        ...(name === 'phone'
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
      await page.exposeFunction('recordF1Csp', (event) => csp.push(event));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) =>
          window.recordF1Csp({ directive: event.violatedDirective, blockedURI: event.blockedURI }),
        );
        Object.defineProperty(navigator, 'storage', {
          value: { persisted: async () => false, persist: async () => false },
        });
      });
      await page.clock.setFixedTime(new Date('2026-09-27T18:00:00.000Z'));
      const response = await page.goto(`${base}/#home`);
      const hasCsp = Boolean(response.headers()['content-security-policy']);
      if (process.env.SHOT_REQUIRE_CSP === '1' && !hasCsp)
        throw new Error('Production CSP missing');
      await page.locator('.first-run').waitFor();
      if (state !== 'new') {
        await page.goto(`${base}/#settings`);
        await page
          .locator('#import-file')
          .setInputFiles({ name: 'demo.json', mimeType: 'application/json', buffer: fixture });
        await page.getByRole('button', { name: 'Apply reviewed import' }).click();
        if (state === 'returning') {
          const downloaded = page.waitForEvent('download');
          await page.locator('[data-export="json"]').click();
          await downloaded;
        }
        await page.goto(`${base}/#home`);
        await page.locator('.dash').waitFor();
      }
      for (const route of state === 'banner' ? ['home', 'settings'] : ['home']) {
        await page.goto(`${base}/#${route}`);
        await page.locator('main[data-route="' + route + '"]').waitFor();
        await page.locator('.toast').waitFor({ state: 'hidden' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          for (const image of document.images) image.loading = 'eager';
          await Promise.all([...document.images].map((image) => image.decode()));
        });
        const file = `${name}-${state}-${route}.png`;
        await page.screenshot({
          path: resolve(output, file),
          fullPage: true,
          animations: 'disabled',
        });
        measurements.push({
          file,
          hasCsp,
          csp: [...csp],
          errors: [...errors],
          ...(await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            contentHeight:
              document.documentElement.scrollHeight -
              parseFloat(getComputedStyle(document.body).paddingBottom) -
              Math.max(
                0,
                parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom) - 35,
              ),
          }))),
        });
      }
      if (errors.length || csp.length) throw new Error(JSON.stringify({ errors, csp }));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(resolve(output, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n');
console.log(measurements);
