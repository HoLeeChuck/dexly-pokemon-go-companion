import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      '.wrangler',
      'node_modules',
      'playwright-report',
      'test-results',
      'worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['worker/**/*.ts', 'tests/worker/**/*.ts', 'tests/setup-worker.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.worker,
    },
  },
  {
    files: [
      '*.config.{js,ts,mjs}',
      'eslint.config.js',
      'scripts/**/*.{js,mjs,cjs,ts}',
      'tests/unit/**/*.{ts,tsx}',
      'tests/e2e/**/*.{ts,tsx}',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
);
