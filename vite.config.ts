import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function generatedClientAssets(directory: string, relative = ''): string[] {
  return readdirSync(resolve(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return generatedClientAssets(directory, path);
    return path.startsWith('assets/') && /\.(?:css|js)$/.test(entry.name) ? [`/${path}`] : [];
  });
}

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    {
      name: 'catchgrid-service-worker-version',
      closeBundle() {
        const serviceWorkerPath = resolve('dist/client/sw.js');
        if (!existsSync(serviceWorkerPath)) return;
        const source = readFileSync(serviceWorkerPath, 'utf8');
        writeFileSync(
          serviceWorkerPath,
          source
            .replace('__CATCHGRID_BUILD_VERSION__', gitSha().slice(0, 12))
            .replace(
              '/* __CATCHGRID_GENERATED_ASSETS__ */ []',
              JSON.stringify(generatedClientAssets(resolve('dist/client')).sort()),
            ),
        );
      },
      writeBundle() {
        const clientDirectory = resolve('dist/client');
        if (!existsSync(clientDirectory)) return;
        mkdirSync(resolve(clientDirectory, 'icons'), { recursive: true });
        const copiedAssets = [
          'app-bootstrap.js',
          'catchgrid-social.png',
          'legal.css',
          'manifest.webmanifest',
          'offline.html',
          'robots.txt',
          'sitemap.xml',
          'sw.js',
        ];
        for (const asset of copiedAssets) {
          copyFileSync(resolve('public', asset), resolve(clientDirectory, asset));
        }
        for (const icon of ['catchgrid-192.png', 'catchgrid-512.png']) {
          copyFileSync(resolve('public/icons', icon), resolve(clientDirectory, 'icons', icon));
        }
        for (const legalPage of ['notices', 'privacy', 'security']) {
          mkdirSync(resolve(clientDirectory, legalPage), { recursive: true });
          copyFileSync(
            resolve('public', legalPage, 'index.html'),
            resolve(clientDirectory, legalPage, 'index.html'),
          );
        }
      },
    },
  ],
  define: {
    __BUILD_SHA__: JSON.stringify(gitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_ENVIRONMENT__: JSON.stringify(process.env.CLOUDFLARE_ENV || 'production'),
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
