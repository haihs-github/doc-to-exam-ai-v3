// Created by Haihs on 11/11/2026
// Smoke E2E: home page shows the title and API health status (no database needed).
import { expect, test } from '@playwright/test';

// Haihs: health nằm ở /about (guest vào / bị chuyển về /about, tiêu đề cũ không còn) - start
// đóng code cũ
// test('home shows title and API OK', async ({ page }) => {
//   await page.goto('/');
//   await expect(page.getByRole('heading', { name: 'Doc to Exam AI' })).toBeVisible();
//   await expect(page.getByRole('status')).toContainText('OK');
// });
test('about shows system status API OK', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'Trạng thái hệ thống' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('OK');
});
// Haihs: health nằm ở /about (guest vào / bị chuyển về /about, tiêu đề cũ không còn) - end

// Haihs: kiểm tra lỗi API ở /about thay vì / - start
// đóng code cũ
// test('home shows Vietnamese error when API is unreachable', async ({ page }) => {
//   await page.route('**/api/health', (r) => r.abort());
//   await page.goto('/');
//   await expect(page.getByRole('status')).toContainText('Không kết nối được máy chủ');
// });
test('about shows Vietnamese error when API is unreachable', async ({ page }) => {
  await page.route('**/api/health', (r) => r.abort());
  await page.goto('/about');
  await expect(page.getByRole('status')).toContainText('Không kết nối được máy chủ');
});
// Haihs: kiểm tra lỗi API ở /about thay vì / - end
