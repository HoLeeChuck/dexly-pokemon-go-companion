import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function publicClientAssets(directory: string): string[] {
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  const initial = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:css|js))"/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
  const assetsDirectory = resolve(directory, 'assets');
  if (!existsSync(assetsDirectory)) return initial;
  const modules: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:css|js)$/.test(entry.name)) {
        modules.push(`/${relative(directory, path).replaceAll('\\', '/')}`);
      }
    }
  };
  visit(assetsDirectory);
  return [...new Set([...initial, ...modules])];
}

export default defineConfig({
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: {
            app: resolve('index.html'),
            owner: resolve('cody/index.html'),
          },
        },
      },
    },
  },
  plugins: [
    react(),
    cloudflare(),
    {
      name: 'catchgrid-service-worker-version',
      closeBundle() {
        if (this.environment.name !== 'client') return;
        const serviceWorkerPath = resolve('dist/client/sw.js');
        if (!existsSync(serviceWorkerPath)) return;
        const source = readFileSync(serviceWorkerPath, 'utf8');
        const buildId = createHash('sha256')
          .update(readFileSync(resolve('dist/client/index.html')))
          .update(publicClientAssets(resolve('dist/client')).sort().join('\n'))
          .update(readFileSync(resolve('dist/client/prism-bootstrap.js')))
          .update(readFileSync(resolve('dist/client/pwa-bootstrap.js')))
          .update(source)
          .digest('hex')
          .slice(0, 16);
        writeFileSync(
          serviceWorkerPath,
          source
            .replace('__CATCHGRID_BUILD_VERSION__', buildId)
            .replace(
              '/* __CATCHGRID_GENERATED_ASSETS__ */ []',
              JSON.stringify(publicClientAssets(resolve('dist/client')).sort()),
            ),
        );
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
    // Playwright rewrites reports while the local app is open; they are not app source.
    watch: { ignored: ['**/playwright-report/**', '**/test-results/**'] },
  },
  preview: {
    host: '127.0.0.1',
  },
});
