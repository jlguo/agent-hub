import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: '../coverage/unit',
      include: ['**/*.ts'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/lib/prisma.ts', '**/index.ts'],
      thresholds: {
        global: {
          branches: 20,
          functions: 25,
          lines: 25,
          statements: 25,
        },
      },
    },
    setupFiles: ['./test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    pool: 'forks',
    maxWorkers: 1,
  },
});
