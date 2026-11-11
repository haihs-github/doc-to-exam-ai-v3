// Created by Haihs on 11/11/2026
// Playwright smoke E2E config: Chromium only, starts API (3000) and web (4200) dev servers.
import { defineConfig, devices } from '@playwright/test';

// Haihs: hằng số cho env E2E của API - start
const E2E_TEACHER_SECRET_KEY = process.env.E2E_TEACHER_SECRET_KEY ?? 'e2e-teacher-secret';
const RATE_LIMITS = [
  'LOGIN',
  'REGISTER',
  'STUDENT_REGISTER',
  'REGISTER_PHONE',
  'STUDENT_LOGIN',
  'LOGIN_IP_FAIL',
  'LOGIN_ACCOUNT',
  'LOGIN_PHONE_GLOBAL',
  'CHANGE_PASSWORD',
  'STUDENT_API',
];
// Haihs: hằng số cho env E2E của API - end

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4200' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w apps/api',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      // Haihs: env E2E cho API (secret giáo viên, nới rate limit, DB in-memory) và timeout 240s cho lần tải binary mongodb-memory-server đầu tiên - start
      // đóng code cũ
      // timeout: 120_000,
      timeout: 240_000,
      env: {
        TEACHER_SECRET_KEY: E2E_TEACHER_SECRET_KEY,
        // Empty on purpose: no MONGODB_URI means the dev in-memory MongoDB fallback is used (even if .env.local sets one).
        MONGODB_URI: '',
        ALLOW_IN_MEMORY_DB: 'true',
        ...Object.fromEntries(RATE_LIMITS.map((n) => [`RATE_LIMIT_${n}_MAX`, '100000'])),
      },
      // Haihs: env E2E cho API (secret giáo viên, nới rate limit, DB in-memory) và timeout 240s cho lần tải binary mongodb-memory-server đầu tiên - end
    },
    {
      command: 'npm run dev -w apps/web',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
