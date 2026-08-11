import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL('./migrations', import.meta.url)),
          ),
        },
      },
    })),
  ],
  test: {
    passWithNoTests: true,
    include: [
      'tests/worker/**/*.{test,spec}.ts',
      'worker/**/*.{test,spec}.ts',
      '**/*.worker.{test,spec}.ts',
    ],
    setupFiles: ['./tests/setup-worker.ts'],
  },
});
