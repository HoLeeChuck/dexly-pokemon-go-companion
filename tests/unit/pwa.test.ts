import { describe, expect, it } from 'vitest';
import bootstrap from '../../public/app-bootstrap.js?raw';
import serviceWorker from '../../public/sw.js?raw';
import viteConfig from '../../vite.config.ts?raw';
import { ACCENT_THEMES } from '../../src/lib/theme';

describe('offline and update safety', () => {
  it('keeps the pre-React bootstrap accent allowlist aligned with the application', () => {
    const bootstrapAllowlist = bootstrap.match(/const allowedAccents = \[([^\]]+)]/)?.[1];
    expect(bootstrapAllowlist).toBeDefined();
    expect(bootstrapAllowlist?.split(',').map((value) => value.trim().replaceAll("'", ''))).toEqual(
      [...ACCENT_THEMES],
    );
  });

  it('versions shell caches and provides an offline navigation fallback', () => {
    expect(serviceWorker).toContain(
      "const CACHE_VERSION = 'catchgrid-__CATCHGRID_BUILD_VERSION__'",
    );
    expect(serviceWorker).toContain("caches.match('/offline.html')");
    expect(serviceWorker).toContain("url.pathname === '/api/v1/catalog'");
    expect(serviceWorker).toContain('...GENERATED_ASSETS');
    expect(serviceWorker).toContain("cache.put('/api/v1/catalog'");
  });

  it('includes every built JavaScript and CSS route chunk without precaching artwork', () => {
    expect(viteConfig).toContain('readdirSync(current, { withFileTypes: true })');
    expect(viteConfig).toContain('/\\.(?:css|js)$/.test(entry.name)');
    expect(viteConfig).toContain('publicClientAssets');
    expect(viteConfig).not.toContain("resolve(directory, 'artwork')");
  });

  it('purges and bypasses PWA caches in local Vite development', () => {
    expect(serviceWorker).toContain('const IS_DEVELOPMENT = GENERATED_ASSETS.length === 0');
    expect(serviceWorker).toContain("key.startsWith('catchgrid-')");
    expect(serviceWorker).toContain('if (IS_DEVELOPMENT) return;');
  });

  it('never intercepts or shares private API responses', () => {
    expect(serviceWorker).toContain("if (url.pathname.startsWith('/api/')) return;");
    expect(serviceWorker).not.toMatch(/cache\.put\([^\n]*api\/v1\/bootstrap/);
    expect(serviceWorker).not.toMatch(/cache\.put\([^\n]*api\/v1\/collection/);
  });

  it('announces controlled updates and applies them only after user action', () => {
    expect(bootstrap).toContain("'catchgrid:update-ready'");
    expect(bootstrap).toContain("'catchgrid:apply-update'");
    expect(serviceWorker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(serviceWorker).not.toContain('self.skipWaiting();');
  });
});
