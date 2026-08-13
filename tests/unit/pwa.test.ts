import { describe, expect, it } from 'vitest';
import bootstrap from '../../public/app-bootstrap.js?raw';
import serviceWorker from '../../public/sw.js?raw';

describe('offline and update safety', () => {
  it('versions shell caches and provides an offline navigation fallback', () => {
    expect(serviceWorker).toContain(
      "const CACHE_VERSION = 'catchgrid-__CATCHGRID_BUILD_VERSION__'",
    );
    expect(serviceWorker).toContain("caches.match('/offline.html')");
    expect(serviceWorker).toContain("url.pathname === '/api/v1/catalog'");
    expect(serviceWorker).toContain('...GENERATED_ASSETS');
    expect(serviceWorker).toContain("cache.put('/api/v1/catalog'");
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
