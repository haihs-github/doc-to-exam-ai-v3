// Created by Haihs on 11/11/2026
// Vitest config for the API: forked pool, 2 workers, serial files (resource limits).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // contract is source-only, so point straight at its TS entry
    alias: {
      '@doc-to-exam/contract': fileURLToPath(
        new URL('../../packages/contract/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    pool: 'forks',
    maxWorkers: 2,
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});
