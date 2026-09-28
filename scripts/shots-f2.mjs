/* global document, window */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5184';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('F2 fixture captures must use a local preview.');
const output = resolve(process.argv[2] ?? 'docs/shots/f2-after');
await mkdir(output, { recursive: true });
const fixture = await readFile('docs/fixtures/demo-collection.json');
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined,
});
const measurements = [];
try {
  for (const [name, width, height, colorScheme] of [
    ['desktop', 1440, 900, 'dark'],
    ['phone', 390, 844, 'dark'],
    ['phone-light', 390, 844, 'light'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'America/Chicago',
    });
    const page = await context.newPage();
    const errors = [];
    const csp = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.exposeFunction('recordF2Csp', (event) => csp.push(event));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) =>
        window.recordF2Csp({ directive: event.violatedDirective, blockedURI: event.blockedURI }),
      );
    });
    await page.clock.setFixedTime(new Date('2026-09-27T18:00:00.000Z'));
    const response = await page.goto(`${base}/#settings`);
    const hasCsp = Boolean(response.headers()['content-security-policy']);
    if (process.env.SHOT_REQUIRE_CSP === '1' && !hasCsp) throw new Error('Production CSP missing');
    if (colorScheme === 'light') {
      await page.getByRole('button', { name: 'Switch to light appearance' }).click();
      await page.locator('html[data-theme="light"]').waitFor();
    }
    await page.locator('#import-file').setInputFiles({
      name: 'demo.json',
      mimeType: 'application/json',
      buffer: fixture,
    });
    await page.getByRole('button', { name: 'Apply reviewed import' }).click();
    await page.goto(`${base}/#progress`);
    await page.locator('[data-region]').selectOption('Kanto');
    await page.locator('[data-category-select]').selectOption('shiny');
    await page.locator('.toast').waitFor({ state: 'hidden' });
    for (const mode of width < 700 && (await page.locator('[data-grid-compare]').count())
      ? ['single', 'compare']
      : ['grid']) {
      if (mode === 'compare') await page.locator('[data-grid-compare]').click();
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const image of document.images) image.loading = 'eager';
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await page.mouse.move(0, 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      const file = `${name}-progress-${mode}.png`;
      await page.screenshot({
        path: resolve(output, file),
        fullPage: true,
        animations: 'disabled',
      });
      measurements.push({
        file,
        hasCsp,
        errors: [...errors],
        csp: [...csp],
        ...(await page.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          cells: [...document.querySelectorAll('button.gcell')].slice(0, 10).map((cell) => {
            const { width, height } = cell.getBoundingClientRect();
            return { width, height, category: cell.dataset.cat };
          }),
        }))),
      });
    }
    if (errors.length || csp.length) throw new Error(JSON.stringify({ errors, csp }));
    await context.close();
  }
  const social = await fetch(new URL('/catchgrid-social.png', base));
  if (!social.ok || !social.headers.get('content-type')?.includes('image/png'))
    throw new Error('Social card must be served as a PNG.');
  await writeFile(resolve(output, 'social-card.png'), Buffer.from(await social.arrayBuffer()));
} finally {
  await browser.close();
}
await writeFile(
  resolve(output, 'progress-measurements.json'),
  JSON.stringify(measurements, null, 2) + '\n',
);
console.log(measurements);
