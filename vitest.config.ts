import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // Legacy test files using Node's built-in test runner
      'src/tests/reviewAggregates.test.ts',
      'src/tests/booking/timeSlotUtils.test.ts',
      // Pure unit tests (no mongo) — run via vitest.unit.config.ts
      'src/tests/unit/**',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    isolate: false, // Vitest 4: replaces poolOptions.forks.singleFork
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'src/tests/**',
        '**/*.d.ts',
      ],
    },
  },
});
