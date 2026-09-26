import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Connect } from 'vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Frontend-only production build for browser tests. The public app bundles its catalog and
// keeps collections in browser storage, so no Worker or D1 is needed here.
const outputDirectory = resolve('dist/e2e-client');

function generatedAssets(directory: string, relative = ''): string[] {
  return readdirSync(resolve(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return generatedAssets(directory, path);
    return path.startsWith('assets/') && /\.(?:css|js)$/.test(entry.name) ? [`/${path}`] : [];
  });
}

/** Lets the PWA test publish a changed service worker on demand. */
function serviceWorkerUpdate(): Connect.NextHandleFunction {
  let updateEnabled = false;
  return (request, response, next) => {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/__test/enable-sw-update' && request.method === 'POST') {
      updateEnabled = true;
      response.statusCode = 204;
      response.end();
      return;
    }
    if (pathname === '/sw.js' && updateEnabled) {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(
        `${readFileSync(resolve(outputDirectory, 'sw.js'), 'utf8')}\n// e2e-update-v2\n`,
      );
      return;
    }
    next();
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'catchgrid-e2e-production-shell',
      configureServer(server) {
        server.middlewares.use(serviceWorkerUpdate());
      },
      configurePreviewServer(server) {
        server.middlewares.use(serviceWorkerUpdate());
      },
      closeBundle() {
        const serviceWorkerPath = resolve(outputDirectory, 'sw.js');
        if (!existsSync(serviceWorkerPath)) return;
        writeFileSync(
          serviceWorkerPath,
          readFileSync(serviceWorkerPath, 'utf8')
            .replace('__CATCHGRID_BUILD_VERSION__', 'e2e-production')
            .replace(
              '/* __CATCHGRID_GENERATED_ASSETS__ */ []',
              JSON.stringify(generatedAssets(outputDirectory).sort()),
            ),
        );
      },
    },
  ],
  build: { outDir: outputDirectory, emptyOutDir: true },
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
});
