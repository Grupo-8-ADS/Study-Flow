import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.expo/**',
      '**/build/**',
      '**/tests/integration/**',
      '**/e2e/**',
      '**/.stryker-tmp/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      // Piso de regressão: a CI falha se a cobertura cair abaixo destes valores.
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 75,
        lines: 85,
      },
      include: [
        'packages/shared/src/**/*.ts',
        'frontend/src/lib/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        // Coberto pela suíte de integração (tests/integration/api/gmail), com Google e Supabase mockados via MSW.
        'frontend/src/lib/gmail-server.ts',
      ],
    },
    alias: {
      '@studyflow/shared': path.resolve(__dirname, './packages/shared/src'),
      '@': path.resolve(__dirname, './frontend/src'),
    },
  },
});
