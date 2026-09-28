import { chromium, webkit, devices, type Page, type TestInfo } from '@playwright/test';
import demoCollection from '../../docs/fixtures/demo-collection.json' with { type: 'json' };

export async function measureHomeSections(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')!;
    const footerClearance = parseFloat(getComputedStyle(document.body).paddingBottom);
    const mainClearance = Math.max(0, parseFloat(getComputedStyle(main).paddingBottom) - 35);
    const selectors = '.masthead, .dash > :not(.bento), .bento > *, .first-run > *, footer';
    const measure = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        name: element.getAttribute('class') || element.tagName.toLowerCase(),
        width: rect.width,
        height: rect.height,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      };
    };
    return {
      documentHeight: document.documentElement.scrollHeight,
      contentHeight: document.documentElement.scrollHeight - footerClearance - mainClearance,
      navigationClearance: footerClearance + mainClearance,
      sections: [...document.querySelectorAll(selectors)].map((element) => ({
        ...measure(element),
        children: [...element.children].map(measure),
      })),
    };
  });
}

// Called only after the unchanged height limit fails. Keep both engines' section
// measurements with the failure so font/layout differences do not become guesswork.
export async function diagnoseHomeHeightFailure(
  page: Page,
  browserName: string,
  testInfo: TestInfo,
) {
  testInfo.setTimeout(testInfo.timeout + 30_000);
  const measurements: Record<string, unknown> = {
    [browserName]: await measureHomeSections(page),
  };
  const otherName = browserName === 'webkit' ? 'chromium' : 'webkit';
  const otherType = otherName === 'chromium' ? chromium : webkit;
  let otherBrowser;
  try {
    otherBrowser = await otherType.launch(
      otherName === 'chromium' && process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
        ? { channel: 'chrome' }
        : {},
    );
    const context = await otherBrowser.newContext({
      ...devices[otherName === 'webkit' ? 'iPhone 13' : 'Desktop Chrome'],
      viewport: page.viewportSize()!,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
      serviceWorkers: 'block',
    });
    const otherPage = await context.newPage();
    await otherPage.clock.setFixedTime(new Date(demoCollection.createdAt));
    const origin = new URL(page.url()).origin;
    await otherPage.goto(`${origin}/#settings`);
    await otherPage.locator('#import-file').setInputFiles({
      name: 'diagnostic-demo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(demoCollection)),
    });
    await otherPage.getByRole('button', { name: 'Apply reviewed import' }).click();
    await otherPage.goto(`${origin}/#home`);
    await otherPage.locator('.dash').waitFor();
    await otherPage.evaluate(() => document.fonts.ready);
    measurements[otherName] = await measureHomeSections(otherPage);
    await testInfo.attach(`home-height-${otherName}`, {
      body: await otherPage.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  } catch (error) {
    measurements[otherName] = { diagnosticError: String(error) };
  } finally {
    await otherBrowser?.close();
  }
  await testInfo.attach(`home-height-${browserName}`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png',
  });
  const report = JSON.stringify(measurements, null, 2);
  console.log(`HOME_HEIGHT_DIAGNOSTIC\n${report}`);
  await testInfo.attach('home-height-comparison', {
    body: report,
    contentType: 'application/json',
  });
}
