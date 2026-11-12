// Created by Haihs on 11/11/2026
// Vitest runner config for Angular's unit-test builder: caps workers (resource limits).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    maxWorkers: 2,
  },
});
