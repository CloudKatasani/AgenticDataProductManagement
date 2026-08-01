import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    globalSetup: ['tests/setup/global.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
      AUTH_SECRET: 'test-secret',
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The integration tests share one SQLite file; run them serially.
    fileParallelism: false,
  },
})
