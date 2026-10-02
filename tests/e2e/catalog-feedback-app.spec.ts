import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { measureHomeSections } from './home-diagnostics';

const profileKey = 'catchgrid:local-profile:v2';
const discord = 'https://discord.com/users/198246186371514368';
const unavailable = "CatchGrid's catalog says this isn't in GO yet. If that's wrong, report it.";
const rows = [
  'Number\tPokémon\tGender\t\tShiny\t100%\tLucky\tXXL\tXXS\tShadow\tPurified',
  '1\tBulbasaur\tM\tF\t\t\t\t\t\t\t',
  '132\tDitto\tNeutral\t\t\t\t\t\t\tShadow\t',
].join('\n');

async function reviewRows(page: Page, text = rows) {
  await page.goto('/#settings');
  if (
    !(await page.locator('.paste-rows').getAttribute('open')) &&
    !(await page.getByLabel('Rows copied from your spreadsheet').isVisible())
  )
    await page.getByText('Or paste rows from your spreadsheet').click();
  await page.getByLabel('Rows copied from your spreadsheet').fill(text);
  await page.getByRole('button', { name: 'Review pasted rows' }).click();
}
async function clipboard(page: Page, denied = false) {
  const values: string[] = [];
  await page.exposeFunction('recordReportCopy', (value: string) => values.push(value));
  await page.addInitScript((denied) => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          if (denied) throw new Error('Clipboard denied');
          await (
            window as unknown as { recordReportCopy(value: string): Promise<void> }
          ).recordReportCopy(value);
        },
      },
    });
  }, denied);
  return values;
}

test('L2 details report copies the edited draft exactly, stays local and supports keyboard access', async ({
  page,
}, testInfo) => {
  const copied = await clipboard(page);
  await page.goto('/#progress');
  await page.locator('[data-category-select]').selectOption('shiny');
  await page.getByRole('button', { name: 'View details for Bulbasaur', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Pokémon collection details' });
  await page.waitForLoadState('networkidle');
  const before = await page.evaluate((key) => localStorage.getItem(key), profileKey);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const summary = sheet.locator('.entry-report summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const field = sheet.getByLabel('Report message');
  await expect(field).toHaveValue(
    "CatchGrid — report a wrong entry\nPokémon: #1 Bulbasaur\nForm: Default\nCategory: Shiny\nWhat's wrong: [Describe the correction]\nSource link (optional): ",
  );
  const message = (await field.inputValue()).replace(
    '[Describe the correction]',
    'A correction with <tags>, & and "quotes".',
  );
  await field.fill(message);
  await sheet.getByRole('button', { name: 'Copy report' }).click();
  await expect(sheet.locator('.report-status')).toContainText('Report copied.');
  expect(copied).toEqual([message]);
  const link = sheet.getByRole('link', { name: 'Message Cody on Discord' });
  await expect(link).toHaveAttribute('href', discord);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  expect(requests).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), profileKey)).toBe(before);
  await testInfo.attach('details-report', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'View details for Bulbasaur', exact: true }),
  ).toBeFocused();
});

test('L2 alternate form context and clipboard-denied fallback stay inside the details sheet', async ({
  page,
}) => {
  await clipboard(page, true);
  await page.goto('/#progress');
  await page.locator('[data-form]').selectOption('mega');
  await page
    .getByRole('button', { name: 'View details for Mega Charizard X', exact: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Pokémon collection details' });
  await sheet.getByText('Report a wrong entry', { exact: true }).click();
  const field = sheet.getByLabel('Report message');
  await expect(field).toHaveValue(
    /Pokémon: #6 Charizard\nForm: Mega Charizard X\nCategory: Normal/,
  );
  await sheet.getByRole('button', { name: 'Copy report' }).click();
  await expect(sheet.locator('.report-status')).toContainText('Copy unavailable. Message selected');
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((node: HTMLTextAreaElement) =>
      node.value.slice(node.selectionStart, node.selectionEnd),
    ),
  ).toBe(await field.inputValue());
});

test('L2 Sources report and Dex scanner report remain accessible in both themes', async ({
  page,
}, testInfo) => {
  await page.goto('/#about');
  await page.getByText('Report a wrong entry', { exact: true }).click();
  await expect(page.getByLabel('Report message')).toHaveValue(
    /Pokémon: \[Pokémon name or Dex number\]/,
  );
  for (const theme of ['dark', 'light']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.locator('.theme-toggle').click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await testInfo.attach(`sources-${theme}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }
  await page.goto('/#dex?r=kanto');
  const report = page.locator('.hud-readout .entry-report');
  await report.locator('summary').click();
  await expect(report.getByLabel('Report message')).toHaveValue(/Pokémon: #6 Charizard/);
  await report.getByLabel('Report message').fill('My draft');
  await page.getByRole('button', { name: 'Toggle Normal: missing', exact: true }).click();
  await expect(report.getByLabel('Report message')).toHaveValue('My draft');
  await page.getByRole('button', { name: 'Inspect next Pokémon' }).click();
  await page.locator('.hud-readout .entry-report summary').click();
  await expect(page.getByLabel('Report message')).toHaveValue(/Pokémon: #7 Squirtle/);
});

test('L3 skipped cells offer the L2 report with the skipped category and preserve reviewed import', async ({
  page,
}, testInfo) => {
  const copied = await clipboard(page);
  await reviewRows(page);
  const review = page.locator('#import-review');
  await expect(review).toContainText(unavailable);
  await review.getByText('See skipped cells').click();
  await expect(review.locator('.sheet-skipped dd')).toContainText('#132 Ditto');
  await expect(review.getByLabel('Report message')).toHaveCount(1);
  await review.getByText('Report a wrong entry', { exact: true }).click();
  await expect(review.getByLabel('Report message')).toHaveValue(
    /Shadow \(1\):\n- #132 Ditto \(not available\)/,
  );
  await review.getByRole('button', { name: 'Copy report' }).click();
  expect(copied).toEqual([await review.getByLabel('Report message').inputValue()]);
  expect(await page.evaluate((key) => localStorage.getItem(key), profileKey)).toBeNull();
  await testInfo.attach('skipped-cells', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Apply reviewed import' }).click();
  const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), profileKey))!);
  expect(
    saved.collectionEntries.some((entry: { categoryId: string }) => entry.categoryId === 'shadow'),
  ).toBe(false);
  await reviewRows(
    page,
    rows
      .split('\n')
      .filter((line) => !line.startsWith('1\t'))
      .join('\n'),
  );
  await expect(review).toContainText('No new entries can be added');
  await expect(review).not.toContainText('Everything in this sheet is already registered');
});

test('300 skipped cells render one editable report grouped by category without losing cells', async ({
  page,
}) => {
  const copied = await clipboard(page);
  const header = rows.split('\n')[0];
  const skippedRows = Array.from(
    { length: 150 },
    () => '132\tDitto\tNeutral\t\t\t\t\t\t\tShadow\tPurified',
  );
  await reviewRows(page, [header, ...skippedRows].join('\n'));
  const review = page.locator('#import-review');
  await expect(review).toContainText('300 cells skipped as “not available”');
  await expect(review).toContainText(unavailable);
  await expect(review.locator('textarea')).toHaveCount(1);
  await expect(review.locator('.entry-report')).toHaveCount(1);
  await expect(review.locator('.sheet-skipped textarea, .sheet-skipped button')).toHaveCount(0);
  await review.getByText('Report a wrong entry', { exact: true }).click();
  const field = review.getByLabel('Report message');
  const draft = await field.inputValue();
  expect(draft).toContain('Shadow (150):');
  expect(draft).toContain('Purified (150):');
  expect(draft.match(/- #132 Ditto \(not available\)/g)).toHaveLength(300);
  const edited = draft.replace('[Describe the correction]', 'Please check these skipped cells.');
  await field.fill(edited);
  await review.getByRole('button', { name: 'Copy report' }).click();
  expect(copied).toEqual([edited]);
  expect(await page.evaluate((key) => localStorage.getItem(key), profileKey)).toBeNull();
});

test('L2 freshness appears on both Home states and the Dex shelf, with the stale phone budget intact', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00Z'));
  await page.goto('/#home');
  const fresh = page.locator('.catalog-freshness');
  await expect(fresh).toHaveText('Catalog updated 2026-09-29');
  await page.goto('/#dex');
  await expect(fresh).toHaveText('Catalog updated 2026-09-29');
  await page.clock.setFixedTime(new Date('2026-10-21T12:00:00Z'));
  await page.goto('/#home');
  await expect(fresh).toContainText('Some recent releases may be missing');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const state of ['new', 'returning']) {
    if (state === 'returning') {
      await reviewRows(page);
      await page.getByRole('button', { name: 'Apply reviewed import' }).click();
      await page.goto('/#home');
    }
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('.theme-toggle').click();
      await expect(fresh).toContainText('Some recent releases may be missing');
      await page.evaluate(() => document.fonts.ready);
      const measurement = await measureHomeSections(page);
      expect(measurement.contentHeight).toBeLessThanOrEqual(2400);
      await testInfo.attach(`stale-${state}-${theme}-height`, {
        body: JSON.stringify(measurement),
        contentType: 'application/json',
      });
    }
  }
});
