// Created by Haihs on 11/11/2026
// Smoke E2E: home page shows the title and API health status (no database needed).
import { expect, test } from '@playwright/test';

test('home shows title and API OK', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Doc to Exam AI' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('OK');
});

test('home shows Vietnamese error when API is unreachable', async ({ page }) => {
  await page.route('**/api/health', (r) => r.abort());
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Không kết nối được máy chủ');
});
