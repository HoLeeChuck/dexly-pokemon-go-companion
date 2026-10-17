# Playwright 1.62.1 screenshot CSP patch

`playwright-core@1.62.1.patch` preserves WebKit's screenshot animation synchronization
without inserting the inline `<style>body {}</style>` that violates `style-src 'self'`.
It temporarily adopts an equivalent constructed CSSStyleSheet, forces the same layout
read, and restores the original adopted sheets in `finally`.

The dependency version is unchanged. pnpm applies this pinned patch during frozen-lockfile
installation. No browser CSP bypass, violation filtering, or production policy change is used.
The production-CSP tests capture every public route in both themes with both browser engines
and service workers enabled. Reassess this patch when intentionally upgrading Playwright.

Upstream: [screenshotter.ts, inPagePrepareForScreenshots](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/screenshotter.ts).
