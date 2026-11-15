// Created by Haihs on 12/11/2026
// Classes E2E (M2): teacher creates a class and an invite link, student joins and is approved, reset password, trash/restore.
import { expect as baseExpect, test, type Browser, type Page } from '@playwright/test';

const SECRET = process.env.E2E_TEACHER_SECRET_KEY ?? 'e2e-teacher-secret'; // same default as playwright.config.ts
const PASSWORD = 'Passw0rd!1';
const STUDENT_NAME = 'Tran Thi Hoc Sinh';

// `next dev` compiles every route on its first hit, which can take seconds: generous timeouts
test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 }); // configure() returns a NEW expect

let seq = 0;
/** Unique 10-digit phone per call: Date.now() tail + in-process counter. */
const newPhone = () =>
  `09${String(Date.now() % 1e6).padStart(6, '0')}${String(seq++ % 100).padStart(2, '0')}`;
const uniq = () => `${Date.now() % 1e6}${seq++}`;

const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const dialog = (page: Page) => page.getByRole('alertdialog');

async function register(page: Page, kind: 'teacher' | 'student', phone: string, name: string) {
  await page.goto(kind === 'teacher' ? '/teacher/register' : '/register');
  await field(page, 'fullName').fill(name);
  await field(page, 'phoneNumber').fill(phone);
  await field(page, 'password').fill(PASSWORD);
  if (kind === 'teacher') await field(page, 'secretKey').fill(SECRET);
  await page.getByRole('button', { name: 'Đăng Ký Tài Khoản' }).click();
  await expect(page).not.toHaveURL(/\/register$/); // registered: the app moved on to the role home
}

/** A separate browser context = a separate device (own localStorage). */
async function newDevice(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, page: await context.newPage() };
}

async function createClass(page: Page, name: string, code: string) {
  await page.goto('/teacher/classes');
  await page.getByRole('button', { name: 'Tạo lớp' }).click();
  await field(page, 'name').fill(name);
  await field(page, 'code').fill(code.toLowerCase()); // the code is upper-cased as you type
  await field(page, 'startYear').fill('2025');
  await field(page, 'endYear').fill('2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo lớp' }).click();
  await dialog(page).getByRole('button', { name: 'OK' }).click(); // the success popup must be dismissed first
  await expect(page.getByRole('link', { name: name.toUpperCase() })).toBeVisible(); // names are upper-cased
}

test('duplicate class code is reported under the field', async ({ page }) => {
  await register(page, 'teacher', newPhone(), 'Giao Vien A');
  const code = `DUP${uniq()}`;
  await createClass(page, `Lop ${code}`, code);

  await page.getByRole('button', { name: 'Tạo lớp' }).click();
  await field(page, 'name').fill('Lop khac');
  await field(page, 'code').fill(code);
  await field(page, 'startYear').fill('2025');
  await field(page, 'endYear').fill('2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo lớp' }).click();
  await expect(page.getByRole('dialog')).toContainText('Mã lớp đã được lớp khác sử dụng');
});

test('invite link -> student joins (pending) -> teacher approves -> student sees the class', async ({
  page,
  browser,
  baseURL,
}) => {
  await register(page, 'teacher', newPhone(), 'Giao Vien B');
  const code = `INV${uniq()}`;
  const className = `Lop ${code}`;
  await createClass(page, className, code);

  await page.getByRole('link', { name: className.toUpperCase() }).click();
  await page.getByRole('tab', { name: 'Mời tham gia' }).click();
  // Haihs: link mời luôn hiện trong ô chỉ-đọc như bản gốc - start
  // đóng code cũ
  // await page.getByRole('button', { name: 'Hiện link' }).first().click();
  // const link = (await page.locator('p.font-mono').first().innerText()).trim();
  // Haihs: chữ mục Đã xoá của lớp giống bản gốc - start
  // đóng code cũ
  // const link = (await page.getByRole('textbox', { name: /Link Mời học sinh/i }).inputValue()).trim();
  const link = (
    await page.getByRole('textbox', { name: /Link Mời học sinh/i }).inputValue()
  ).trim();
  // Haihs: chữ mục Đã xoá của lớp giống bản gốc - end
  // Haihs: link mời luôn hiện trong ô chỉ-đọc như bản gốc - end
  expect(link).toContain('/join/');

  const student = await newDevice(browser, baseURL);
  const studentPhone = newPhone();
  await register(student.page, 'student', studentPhone, STUDENT_NAME);
  await student.page.goto(link);
  await expect(student.page.getByRole('status')).toContainText('chờ giáo viên duyệt');

  await page.getByRole('tab', { name: 'Học sinh' }).click();
  await page.getByRole('button', { name: 'Chờ duyệt' }).click();
  await page.getByRole('button', { name: 'Thao tác với Tran Thi Hoc Sinh' }).click();
  await page.getByRole('menuitem', { name: 'Duyệt' }).click();
  await expect(dialog(page)).toContainText('Đã duyệt học sinh'); // the POST has finished (cold-compiled)
  await dialog(page).getByRole('button', { name: 'OK' }).click();

  await student.page.goto('/classes');
  await expect(student.page.getByRole('link', { name: className.toUpperCase() })).toBeVisible();
  await student.context.close();
});

test('teacher resets a password; the student must change it', async ({
  page,
  browser,
  baseURL,
}) => {
  await register(page, 'teacher', newPhone(), 'Giao Vien C');
  const code = `RST${uniq()}`;
  await createClass(page, `Lop ${code}`, code);
  await page.getByRole('link', { name: `LOP ${code}` }).click();
  const studentPhone = newPhone();

  // the student joins through the invite link
  await page.getByRole('tab', { name: 'Mời tham gia' }).click();
  await page.getByRole('button', { name: 'Hiện link' }).first().click();
  const link = (await page.locator('p.font-mono').first().innerText()).trim();
  const student = await newDevice(browser, baseURL);
  await register(student.page, 'student', studentPhone, STUDENT_NAME);
  await student.page.goto(link);
  await expect(student.page.getByRole('status')).toContainText('chờ giáo viên duyệt'); // the join has finished

  await page.getByRole('tab', { name: 'Học sinh' }).click();
  await page.getByRole('button', { name: 'Chờ duyệt' }).click();
  await page.getByRole('button', { name: 'Duyệt tất cả' }).click();
  await dialog(page).getByRole('button', { name: 'Duyệt tất cả' }).click();
  await expect(dialog(page)).toContainText('Đã duyệt tất cả');
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Đã duyệt' }).click();
  await page.getByRole('button', { name: 'Thao tác với Tran Thi Hoc Sinh' }).click();
  await page.getByRole('menuitem', { name: 'Đặt lại mật khẩu' }).click();
  await dialog(page).getByRole('button', { name: 'Đặt lại' }).click();
  const temp = (await page.getByLabel('Mật khẩu tạm', { exact: true }).innerText()).trim();
  expect(temp).toMatch(/^[A-Z2-9]{10}$/);
  await page.getByRole('button', { name: 'Đã lưu, đóng' }).click();

  const fresh = await newDevice(browser, baseURL);
  await fresh.page.goto('/login');
  await field(fresh.page, 'phoneNumber').fill(studentPhone);
  await field(fresh.page, 'password').fill(temp);
  await fresh.page.getByRole('button', { name: 'Đăng Nhập Ngay' }).click();
  await expect(fresh.page).toHaveURL(/\/change-password$/);
  await fresh.context.close();
  await student.context.close();
});

test('delete moves the class to the trash and restore brings it back', async ({ page }) => {
  await register(page, 'teacher', newPhone(), 'Giao Vien D');
  const code = `DEL${uniq()}`;
  const name = `Lop ${code}`;
  await createClass(page, name, code);

  await page.getByRole('button', { name: `Thao tác với lớp ${name.toUpperCase()}` }).click();
  await page.getByRole('menuitem', { name: 'Xóa' }).click();
  await dialog(page).getByRole('button', { name: 'Xóa lớp' }).click();
  await expect(page.getByRole('link', { name: name.toUpperCase() })).toHaveCount(0); // the DELETE (cold-compiled by `next dev`) has finished
  // Haihs: chữ mục Đã xoá của lớp giống bản gốc - start
  // đóng code cũ
  // await page.getByRole('button', { name: 'Thùng rác' }).click();
  await page.getByRole('button', { name: 'Đã xoá' }).click();
  // Haihs: chữ mục Đã xoá của lớp giống bản gốc - end
  await expect(page.getByText(name.toUpperCase())).toBeVisible();

  await page.getByRole('button', { name: `Thao tác với lớp ${name.toUpperCase()}` }).click();
  await page.getByRole('menuitem', { name: 'Khôi phục' }).click();
  await expect(dialog(page)).toContainText('Đã khôi phục lớp');
  await dialog(page).getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Đang hoạt động' }).click();
  await expect(page.getByRole('link', { name: name.toUpperCase() })).toBeVisible();
});
