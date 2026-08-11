import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{src,shared,tests}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'tests/worker/**', '**/*.worker.test.ts', '**/*.worker.spec.ts'],
  },
});
