// Fresh, disposable browser contexts only. No game, owner API, or real profile access.
/* global document, innerWidth, getComputedStyle */
import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.argv[2];
const stage = process.argv[3] || 'bramblin';
const output = resolve(process.argv[4] || `archive/release-work/october-${stage}-browser`);
const dates = { bramblin: '2026-10-13', minior: '2026-10-19', greavard: '2026-11-01' };
if (!base || !dates[stage])
  throw new Error(
    'Usage: node scripts/release/verify-october-catalog.mjs URL bramblin|minior|greavard OUTPUT',
  );
mkdirSync(output, { recursive: true });
const results = [];
const errors = [];
const engines = process.env.CATCHGRID_CAPTURE_ENGINES?.split(',') || ['chromium', 'webkit'];
for (const engineName of engines) {
  const engine = { chromium, webkit }[engineName];
  if (!engine) throw new Error(`Unknown engine: ${engineName}`);
  const browser = await engine.launch();
  try {
    for (const size of ['desktop', 'phone']) {
      const context = await browser.newContext({
        viewport: size === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        isMobile: size === 'phone',
        hasTouch: size === 'phone',
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        locale: 'en-US',
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(`${engineName}/${size}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`${engineName}/${size}: ${message.text()}`);
      });
      try {
        for (const theme of ['dark', 'light']) {
          for (const route of ['home', 'dex', 'progress', 'search', 'settings', 'about']) {
            await page.goto(`${base}/#${route}`);
            await expect(page.locator('main')).not.toBeEmpty();
            if ((await page.locator('html').getAttribute('data-theme')) !== theme)
              await page.locator('.theme-toggle').click();
            await page.evaluate(() => document.fonts.ready);
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            );
            expect(overflow, `${route} horizontal overflow`).toBe(false);
            if (route === 'home' || route === 'dex')
              await expect(page.locator('main')).toContainText(`Catalog updated ${dates[stage]}`);
            if (route === 'progress')
              await page.getByLabel('Search Pokémon', { exact: true }).fill('Bramblin');
            await page.evaluate(() =>
              document.documentElement.scrollTo({ top: 0, behavior: 'instant' }),
            );
            await page.screenshot({
              path: resolve(output, `${engineName}-${size}-${theme}-${route}.png`),
              fullPage: true,
            });
            results.push({ engineName, size, theme, route, passed: true });
          }
        }
        const checks = [
          ['Bramblin', 'normal', true],
          ['Bramblin', 'shiny', false],
          ['Brambleghast', 'normal', false],
          ['Shroodle', 'shiny', true],
          ['Grafaiai', 'shiny', true],
          ...['Zekrom', 'Wimpod', 'Fomantis', 'Sandygast', 'Golisopod', 'Palossand'].flatMap(
            (name) => [
              [name, 'shadow', true],
              [name, 'purified', true],
            ],
          ),
          ['Lurantis', 'shadow', false],
          ['Minior', 'normal', stage !== 'bramblin'],
          ['Minior', 'shiny', false],
          ['Greavard', 'shiny', stage === 'greavard'],
          ['Houndstone', 'shiny', false],
        ];
        for (const [name, category, enabled] of checks) {
          await page.goto(`${base}/#dex?r=national`);
          await page.getByLabel('Search Pokémon', { exact: true }).fill(name);
          const inspector = page.getByRole('complementary', {
            name: `${name} collection inspector`,
            exact: true,
          });
          await expect(inspector).toBeVisible();
          const cell = inspector.locator(
            `[data-category-toggle="${category}"]:not([data-form-toggle])`,
          );
          if (enabled) await expect(cell).toBeEnabled();
          else await expect(cell).toBeDisabled();
          results.push({ engineName, size, name, category, enabled, passed: true });
        }
        await page.goto(`${base}/#dex?r=national`);
        await page.getByLabel('Search Pokémon', { exact: true }).fill('Bramblin');
        await page.getByRole('button', { name: 'Toggle Normal: missing', exact: true }).click();
        await expect(page.locator('.hud-stage.registered .hud-status')).toBeVisible();
        expect(
          await page
            .locator('.hud-status')
            .evaluate((el) => getComputedStyle(el, '::before').content),
        ).toBe('"● "');
        await page.locator('.hud-readout h3').click();
        await page.evaluate(() =>
          document.documentElement.scrollTo({ top: 0, behavior: 'instant' }),
        );
        await page.screenshot({
          path: resolve(output, `${engineName}-${size}-registered-bramblin.png`),
          fullPage: true,
        });
        results.push({ engineName, size, check: 'registered-dot', passed: true });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
writeFileSync(
  resolve(output, 'results.json'),
  JSON.stringify({ base, stage, checkedAt: new Date().toISOString(), results, errors }, null, 2) +
    '\n',
);
console.log(
  JSON.stringify({ checks: results.length, screenshots: engines.length * 26, errors }, null, 2),
);
if (errors.length) process.exitCode = 1;
