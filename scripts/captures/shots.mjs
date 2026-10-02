/* global window, document, innerWidth */
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Disposable contexts only. Restore the fixture through the app, never storage keys.
const base = process.env.SHOT_BASE ?? 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('Screenshot fixtures must run on loopback.');
const tag = process.argv[2] ?? 'current';
if (!/^[a-zA-Z0-9_-]+$/.test(tag)) throw new Error('Use a simple screenshot tag.');
const directory = resolve('docs/shots', tag);
const fixturePath = resolve('docs/fixtures/demo-collection.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [width, height, name] of [
    [1440, 900, 'desktop'],
    [390, 844, 'phone'],
  ]) {
    for (const state of ['empty', 'seeded']) {
      const ctx = await browser.newContext({
        viewport: { width, height },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'America/Chicago',
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      // Fixed fixture clock keeps its nine activity days reproducible on later runs.
      await page.clock.setFixedTime(new Date(fixture.createdAt));
      await page.goto(base + '/');
      await expect(page.locator('main')).not.toBeEmpty();
      if (state === 'seeded') {
        const hasHook = await page.evaluate(() => typeof window.__catchgridDevSeed === 'function');
        if (hasHook) await page.evaluate(() => window.__catchgridDevSeed());
        else {
          // Also works against the before screenshot and a production preview.
          await page.goto(base + '/#settings');
          await page.locator('#import-file').setInputFiles(fixturePath);
          await expect(page.locator('#import-review')).toContainText('232 collected entries');
          await page.getByRole('button', { name: 'Apply reviewed import' }).click();
          await expect(page.locator('.toast')).toContainText('Import saved');
        }
        await page.reload();
      }
      for (const route of ['', '#dex', '#progress', '#search']) {
        await page.goto(base + '/' + route);
        await expect(page.locator('main')).toHaveAttribute('data-route', route.slice(1) || 'home');
        await page.evaluate(async () => {
          await document.fonts.ready;
          document.querySelectorAll('main img').forEach((img) => {
            img.loading = 'eager';
          });
          await Promise.all(
            [...document.querySelectorAll('main img')].map((img) => img.decode().catch(() => {})),
          );
        });
        if (state === 'seeded' && !route) {
          await expect(page.locator('[data-key="kpi-species"] .kpi-value')).toHaveText('180');
        }
        const file = `${name}-${state}-${route.slice(1) || 'home'}.png`;
        await page.screenshot({
          path: resolve(directory, file),
          fullPage: true,
          animations: 'disabled',
        });
        results.push({
          file,
          ...(await page.evaluate(() => ({
            width: innerWidth,
            pageWidth: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            zeroPercentOnHome:
              document.querySelector('main')?.dataset.route === 'home' &&
              document.querySelector('main').innerText.includes('0%'),
            brokenArtwork: [...document.querySelectorAll('main img')].filter(
              (img) => !img.naturalWidth,
            ).length,
          }))),
          errors: [...errors],
        });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  resolve(directory, 'results.json'),
  JSON.stringify({ base, fixtureDate: fixture.createdAt, results }, null, 2) + '\n',
);
if (results.some((r) => r.errors.length || r.brokenArtwork || r.pageWidth > r.width))
  throw new Error('Screenshot checks failed; inspect results.json.');
console.log(`Saved ${results.length} screenshots and results to ${directory}`);
