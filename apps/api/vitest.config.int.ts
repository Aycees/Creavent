import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // All files share one database, so they run one at a time.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
