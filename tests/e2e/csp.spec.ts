import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const port = Number(
  process.env.PLAYWRIGHT_CSP_PORT ?? Number(process.env.PLAYWRIGHT_PORT ?? 4173) + 1,
);
const policy = readFileSync('public/_headers', 'utf8').match(
  /^\s+Content-Security-Policy:\s*(.+)$/m,
)?.[1];
if (!policy) throw new Error('Production Content-Security-Policy is missing');
test.use({ baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'allow', reducedMotion: 'reduce' });

type Violation = {
  blockedURI: string;
  directive: string;
  source: string;
  line: number;
  column: number;
};
type ObservedWindow = Window & { cspViolations: Violation[] };

async function ready(page: Page, route: string) {
  await expect(page.locator('main')).toHaveAttribute(
    'data-route',
    route === 'inspector' ? 'dex' : route,
  );
  if (route === 'inspector') {
    await page.getByLabel('Search Pokémon', { exact: true }).fill('Bulbasaur');
    await expect(
      page.getByRole('complementary', { name: 'Bulbasaur collection inspector', exact: true }),
    ).toBeVisible();
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) image.loading = 'eager';
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
  });
}

for (const theme of ['light', 'dark']) {
  test(`production CSP stays clean on every public route in ${theme}, including screenshots and a controlled second load`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const messages: { text: string; location: unknown }[] = [];
    const errors: string[] = [];
    const violations: Violation[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to|violates the following/i.test(message.text()))
        messages.push({ text: message.text(), location: message.location() });
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.exposeFunction('recordCspViolation', (violation: Violation) =>
      violations.push(violation),
    );
    await page.addInitScript((theme) => {
      (window as ObservedWindow).cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        const violation = {
          blockedURI: event.blockedURI,
          directive: event.effectiveDirective,
          source: event.sourceFile,
          line: event.lineNumber,
          column: event.columnNumber,
        };
        (window as ObservedWindow).cspViolations.push(violation);
        void (
          window as unknown as { recordCspViolation(value: Violation): Promise<void> }
        ).recordCspViolation(violation);
      });
      localStorage.setItem('catchgrid:prism:appearance', theme);
    }, theme);
    await page.clock.setFixedTime(new Date('2026-10-17T17:00:00Z'));
    for (const route of [
      'home',
      'dex',
      'progress',
      'search',
      'settings',
      'about',
      'compare',
      'inspector',
    ]) {
      const hash = route === 'inspector' ? 'dex?r=national' : route;
      const response = await page.goto(`/?csp=${route}#${hash}`);
      expect(response?.headers()['content-security-policy'], `${route}: production header`).toBe(
        policy,
      );
      await ready(page, route);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
          timeout: 15_000,
        })
        .toBe(true);
      for (const load of ['first', 'controlled']) {
        if (load === 'controlled') {
          const reloaded = await page.reload();
          expect(reloaded?.fromServiceWorker(), `${route}: reload must be SW controlled`).toBe(
            true,
          );
          expect(
            reloaded?.headers()['content-security-policy'],
            `${route}: controlled header`,
          ).toBe(policy);
          await ready(page, route);
        }
        // Screenshot preparation itself must obey the same policy as the app.
        await page.screenshot({
          path: testInfo.outputPath(`${theme}-${route}-${load}.png`),
          fullPage: true,
          animations: 'disabled',
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        expect
          .soft(
            await page.evaluate(() => (window as ObservedWindow).cspViolations),
            `${route}/${load}: document CSP events`,
          )
          .toEqual([]);
      }
    }
    await testInfo.attach('csp-observations', {
      body: JSON.stringify({ messages, violations, errors }, null, 2),
      contentType: 'application/json',
    });
    expect.soft(messages, 'all CSP console messages, including source locations').toEqual([]);
    expect.soft(violations, 'CSP events across every document').toEqual([]);
    expect(errors, 'all page errors').toEqual([]);
  });
}
