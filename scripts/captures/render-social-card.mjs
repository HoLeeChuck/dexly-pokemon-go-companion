/* global document */
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The SVG is the editable source; render it with the project's existing browser tooling.
const svg = await readFile('public/catchgrid-social.svg');
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0}img{display:block}</style><img width="1200" height="630" src="data:image/svg+xml;base64,${svg.toString('base64')}" alt="">`,
  );
  await page.evaluate(() => document.querySelector('img').decode());
  await page.screenshot({ path: 'public/catchgrid-social.png' });
} finally {
  await browser.close();
}
