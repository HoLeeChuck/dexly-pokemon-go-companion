import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Connect } from 'vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { createBootstrapFixture } from '../fixtures/bootstrap.ts';

const outputDirectory = resolve('dist/e2e-client');

function generatedAssets(directory: string, relative = ''): string[] {
  return readdirSync(resolve(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return generatedAssets(directory, path);
    return path.startsWith('assets/') && /\.(?:css|js)$/.test(entry.name) ? [`/${path}`] : [];
  });
}

function catalogMiddleware(): Connect.NextHandleFunction {
  let serviceWorkerUpdateEnabled = false;
  return (request, response, next) => {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/__test/enable-sw-update' && request.method === 'POST') {
      serviceWorkerUpdateEnabled = true;
      response.statusCode = 204;
      response.setHeader('Cache-Control', 'no-store');
      response.end();
      return;
    }
    if (pathname === '/sw.js' && serviceWorkerUpdateEnabled) {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(
        `${readFileSync(resolve(outputDirectory, 'sw.js'), 'utf8')}\n// e2e-update-v2\n`,
      );
      return;
    }
    if (pathname !== '/api/v1/catalog') return next();
    const fixture = createBootstrapFixture();
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=60');
    response.end(
      JSON.stringify({
        catalogVersion: fixture.catalogVersion,
        categories: fixture.categories,
        catalog: fixture.catalog,
      }),
    );
  };
}

// Browser tests mock the versioned API before navigation. Using the frontend-only
// Vite plugin keeps E2E state ephemeral and leaves Worker/D1 coverage to the Worker suite.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'catchgrid-e2e-production-shell',
      configureServer(server) {
        server.middlewares.use(catalogMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(catalogMiddleware());
      },
      closeBundle() {
        const serviceWorkerPath = resolve(outputDirectory, 'sw.js');
        if (!existsSync(serviceWorkerPath)) return;
        const source = readFileSync(serviceWorkerPath, 'utf8');
        writeFileSync(
          serviceWorkerPath,
          source
            .replace('__CATCHGRID_BUILD_VERSION__', 'e2e-production')
            .replace(
              '/* __CATCHGRID_GENERATED_ASSETS__ */ []',
              JSON.stringify(generatedAssets(outputDirectory).sort()),
            ),
        );
      },
    },
  ],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true,
  },
});
