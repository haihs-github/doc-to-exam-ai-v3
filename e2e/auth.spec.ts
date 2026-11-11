// Created by Haihs on 12/11/2026
// Auth E2E (M1): register/login/logout, change password, logout-all, role guard, API key; each test owns its users.
import { expect, test, type Browser, type Page } from '@playwright/test';

const SECRET = process.env.E2E_TEACHER_SECRET_KEY ?? 'e2e-teacher-secret'; // same default as playwright.config.ts
const PASSWORD = 'Passw0rd!1';
const NAME = 'Nguyen Van A';

let seq = 0;
/** Unique 10-digit phone per call: Date.now() tail + in-process counter. */
const newPhone = () =>
  `09${String(Date.now() % 1e6).padStart(6, '0')}${String(seq++ % 100).padStart(2, '0')}`;

const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const dialog = (page: Page) => page.getByRole('alertdialog');
const home = (page: Page) => page.getByRole('heading', { name: `Xin chào, ${NAME}` });

async function register(page: Page, kind: 'teacher' | 'student', phone: string) {
  await page.goto(kind === 'teacher' ? '/teacher/register' : '/register');
  await field(page, 'fullName').fill(NAME);
  await field(page, 'phoneNumber').fill(phone);
  await field(page, 'password').fill(PASSWORD);
  if (kind === 'teacher') await field(page, 'secretKey').fill(SECRET);
  await page.getByRole('button', { name: 'Đăng Ký Tài Khoản' }).click();
}

async function login(page: Page, kind: 'teacher' | 'student', phone: string, password = PASSWORD) {
  await page.goto(kind === 'teacher' ? '/teacher/login' : '/login');
  await field(page, 'phoneNumber').fill(phone);
  await field(page, 'password').fill(password);
  await page.getByRole('button', { name: 'Đăng Nhập Ngay' }).click();
}

async function logout(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Đăng xuất' }).click();
  await dialog(page).getByRole('button', { name: 'Đăng xuất' }).click();
}

/** A separate browser context = a separate device (own localStorage). */
async function newDevice(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, page: await context.newPage() };
}

test('teacher registers with the secret key, logs out, logs in again', async ({ page }) => {
  const phone = newPhone();
  await register(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();

  await logout(page);
  await expect(page).toHaveURL(/\/teacher\/login$/);

  await login(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();
});

test('wrong password shows the Vietnamese error', async ({ page }) => {
  const phone = newPhone();
  await register(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();
  await logout(page);

  await login(page, 'teacher', phone, 'SaiMatKhau!9');
  await expect(dialog(page)).toContainText('Số điện thoại hoặc mật khẩu không chính xác.');
  await expect(page).toHaveURL(/\/teacher\/login$/);
});

test('student registers and is logged in', async ({ page }) => {
  await register(page, 'student', newPhone());
  await expect(home(page)).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Cài đặt API Key' }),
  ).toHaveCount(0);
});

test('duplicate phone is rejected with the Vietnamese message', async ({
  page,
  browser,
  baseURL,
}) => {
  const phone = newPhone();
  await register(page, 'student', phone);
  await expect(home(page)).toBeVisible();

  const other = await newDevice(browser, baseURL);
  try {
    await register(other.page, 'student', phone);
    // 409 PHONE_TAKEN is shown in the error popup (not as a field error) by the page.
    await expect(dialog(other.page)).toContainText('Số điện thoại này đã được đăng ký tài khoản.');
  } finally {
    await other.context.close();
  }
});

test('voluntary password change clears the fields and the new password works', async ({
  page,
  browser,
  baseURL,
}) => {
  const phone = newPhone();
  const next = 'NewPassw0rd!2';
  await register(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();

  await page.getByRole('banner').getByRole('link', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeVisible();
  await field(page, 'currentPassword').fill(PASSWORD);
  await field(page, 'newPassword').fill(next);
  await field(page, 'confirmPassword').fill(next);
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();

  await expect(dialog(page)).toContainText('Đã đổi mật khẩu.');
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  for (const n of ['currentPassword', 'newPassword', 'confirmPassword'])
    await expect(field(page, n)).toHaveValue('');

  const other = await newDevice(browser, baseURL);
  try {
    await login(other.page, 'teacher', phone, next);
    await expect(home(other.page)).toBeVisible();
  } finally {
    await other.context.close();
  }
});

test('logout-all on one device sends the other device to the login page', async ({
  page,
  browser,
  baseURL,
}) => {
  const phone = newPhone();
  await register(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();

  const other = await newDevice(browser, baseURL);
  try {
    await login(other.page, 'teacher', phone);
    await expect(home(other.page)).toBeVisible();

    await page.getByRole('banner').getByRole('link', { name: 'Đổi mật khẩu' }).click();
    await page.getByRole('button', { name: 'Đăng xuất mọi thiết bị' }).click();
    await dialog(page).getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/teacher\/login$/);

    // Full reload on the other device: its token is revoked, so the protected page bounces to a login page
    // (/change-password has no audience, so the guard picks the student login).
    await other.page.goto('/change-password');
    await expect(other.page).toHaveURL(/\/(teacher\/)?login$/);
  } finally {
    await other.context.close();
  }
});

test('revoked session is sent to login by its next API call (no page reload)', async ({
  page,
  browser,
  baseURL,
}) => {
  const phone = newPhone();
  await register(page, 'teacher', phone);
  await expect(home(page)).toBeVisible();

  const other = await newDevice(browser, baseURL);
  try {
    await login(other.page, 'teacher', phone);
    await expect(home(other.page)).toBeVisible();

    await page.getByRole('banner').getByRole('link', { name: 'Đổi mật khẩu' }).click();
    await page.getByRole('button', { name: 'Đăng xuất mọi thiết bị' }).click();
    await dialog(page).getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/teacher\/login$/);

    // The other device still shows the logged-in home; saving an API key is its next API call and gets a 401.
    await other.page.getByRole('banner').getByRole('button', { name: 'Cài đặt API Key' }).click();
    await field(other.page, 'geminiApiKey').fill('AIzaSyE2E-revoked-0000');
    await other.page.getByRole('dialog').getByRole('button', { name: 'Lưu key' }).click();
    await expect(other.page).toHaveURL(/\/teacher\/login$/);
  } finally {
    await other.context.close();
  }
});

test('unknown teacher route falls back to home', async ({ page }) => {
  await register(page, 'student', newPhone());
  await expect(home(page)).toBeVisible();

  // M1 has no /teacher/* routes yet: the router's `**` sends everything unknown to `/` (the role guard is unit-tested).
  await page.goto('/teacher/templates');
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(home(page)).toBeVisible();
});

test('teacher saves an API key and afterwards sees only its last 4 characters', async ({
  page,
}) => {
  const key = 'AIzaSyE2E-secret-key-1234';
  await register(page, 'teacher', newPhone());
  await expect(home(page)).toBeVisible();

  const nav = page.getByRole('banner');
  await nav.getByRole('button', { name: 'Cài đặt API Key' }).click();
  const modal = page.getByRole('dialog', { name: 'Cài đặt Gemini API Key' });
  await field(page, 'geminiApiKey').fill(key);
  const [saved] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/api-key') && r.request().method() === 'PUT',
    ),
    modal.getByRole('button', { name: 'Lưu key' }).click(),
  ]);
  const savedText = await saved.text();
  expect(savedText).toContain('1234');
  expect(savedText).not.toContain('AIzaSyE2E');
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  await expect(modal).toBeHidden();

  // A fresh /me (after reload) must not carry the key either, only the last 4 characters.
  const [me] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/me')),
    page.reload(),
  ]);
  const meText = await me.text();
  expect(meText).toContain('1234');
  expect(meText).not.toContain('AIzaSyE2E');
  await expect(home(page)).toBeVisible();

  await nav.getByRole('button', { name: 'Gemini API: Đã có Key' }).click();
  await expect(modal).toContainText('Đã lưu: ••••1234');
  await expect(field(page, 'geminiApiKey')).toHaveValue('');
  await expect(field(page, 'geminiApiKey')).not.toHaveValue(/AIza/);
  await expect(page.locator('body')).not.toContainText('AIzaSyE2E');
});

test('guest visiting /change-password is redirected to login', async ({ page }) => {
  await page.goto('/change-password');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Đăng Nhập Học Sinh' })).toBeVisible();
});
