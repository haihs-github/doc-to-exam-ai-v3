// Created by Haihs on 12/11/2026
// UI E2E (M3-M7): the teacher builds a template and a sitting in the browser, a student writes an essay, the teacher grades it by hand.
import { expect as baseExpect, test, type APIRequestContext, type Page } from '@playwright/test';

test.describe.configure({ timeout: 180_000 }); // `next dev` compiles each route on its first hit
const expect = baseExpect.configure({ timeout: 30_000 }); // configure() returns a NEW expect

const SECRET = process.env.E2E_TEACHER_SECRET_KEY ?? 'e2e-teacher-secret';
const PASSWORD = 'Passw0rd!1';
let seq = 0;
const newPhone = () =>
  `09${String(Date.now() % 1e6).padStart(6, '0')}${String(seq++ % 100).padStart(2, '0')}`;
const uniq = () => `${Date.now() % 1e6}${seq++}`;
const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const dialog = (page: Page) => page.getByRole('alertdialog');
const ok = (page: Page) => dialog(page).getByRole('button', { name: 'OK' });
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const vn = (d: Date) => {
  const v = new Date(d.getTime() + 7 * 3600_000); // UTC+7
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`;
};

async function register(
  api: APIRequestContext,
  kind: 'teacher' | 'student',
  phone: string,
  name: string,
) {
  const res = await api.post(`/api/auth/${kind}/register`, {
    data: {
      phoneNumber: phone,
      fullName: name,
      password: PASSWORD,
      ...(kind === 'teacher' ? { secretKey: SECRET } : {}),
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as { token: string; user: { id: string } };
}
async function login(page: Page, kind: 'teacher' | 'student', phone: string) {
  await page.goto(kind === 'teacher' ? '/teacher/login' : '/login');
  await field(page, 'phoneNumber').fill(phone);
  await field(page, 'password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng Nhập Ngay' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** A teacher with an active class holding one approved student. */
async function world(api: APIRequestContext) {
  const teacherPhone = newPhone();
  const studentPhone = newPhone();
  const teacher = await register(api, 'teacher', teacherPhone, 'Giao Vien UI');
  const student = await register(api, 'student', studentPhone, 'Hoc Sinh UI');
  const th = auth(teacher.token);
  const cls = (
    await (
      await api.post('/api/classes', {
        headers: th,
        data: { name: 'Lop UI', code: `UI${uniq()}`, startYear: 2025, endYear: 2026 },
      })
    ).json()
  ).data;
  const invite = (await (await api.get(`/api/classes/${cls.id}/invite`, { headers: th })).json())
    .data;
  await api.post('/api/classes/join', {
    headers: auth(student.token),
    data: { token: invite.student.token },
  });
  await api.post(`/api/classes/${cls.id}/students/${student.user.id}/approve`, { headers: th });
  return { teacherPhone, studentPhone, cls, th };
}

test('teacher builds a template and a sitting in the UI', async ({ page, request }) => {
  const { teacherPhone, cls } = await world(request);
  await login(page, 'teacher', teacherPhone);

  // template: one mcq question
  await page.goto('/teacher/templates/new');
  const title = `Đề UI ${uniq()}`;
  await field(page, 'title').fill(title);
  await page.getByLabel('Nội dung câu hỏi').first().fill('Thủ đô của Việt Nam?');
  await page.getByLabel('Phương án A của câu 1').fill('Hà Nội');
  await page.getByLabel('Phương án B của câu 1').fill('Huế');
  await page.getByRole('radio', { name: 'Chọn A là đáp án đúng' }).check();
  await page.getByRole('button', { name: 'Lưu đề mẫu' }).click();
  await ok(page).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // a blank form is refused with a message
  await page.goto('/teacher/templates/new');
  await page.getByRole('button', { name: 'Lưu đề mẫu' }).click();
  await expect(dialog(page)).toContainText('Vui lòng nhập tên đề mẫu');
  await dialog(page).getByRole('button', { name: 'Đã hiểu' }).click();

  // sitting from that template
  await page.goto('/teacher/sittings/new');
  await page
    .getByLabel('Đề mẫu', { exact: false })
    .first()
    .selectOption({ label: new RegExp(title) as never })
    .catch(async () => {
      await page.locator('select[name="templateId"]').selectOption({ index: 1 });
    });
  const now = Date.now();
  await field(page, 'openAt').fill(vn(new Date(now - 60_000)).replace(/\D/g, ''));
  await field(page, 'closeAt').fill(vn(new Date(now + 3_600_000)).replace(/\D/g, ''));
  await page.getByLabel(`Lớp Lop UI`).check();
  await page.getByRole('button', { name: 'Tạo ca thi' }).click();
  await ok(page).click();
  await expect(page.getByText('Mã ca và link')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Kết quả' })).toBeVisible();
  expect(cls.id).toBeTruthy();
});

test('student writes an essay, teacher grades it', async ({ page, browser, baseURL, request }) => {
  const { teacherPhone, studentPhone, cls, th } = await world(request);
  const template = (
    await (
      await request.post('/api/templates', {
        headers: th,
        data: {
          title: `De tu luan ${uniq()}`,
          questions: [
            {
              id: 1,
              type: 'essay',
              questionText: 'Viet ve mua he',
              rubric: [
                { key: 'k1', label: 'Bo cuc', max: 1 },
                { key: 'k2', label: 'Noi dung', max: 1.5 },
              ],
              maxScore: 2.5,
            },
          ],
        },
      })
    ).json()
  ).data;
  const now = Date.now();
  const sit = await request.post('/api/sittings', {
    headers: th,
    data: {
      templateId: template.id,
      openAt: new Date(now - 60_000).toISOString(),
      closeAt: new Date(now + 3_600_000).toISOString(),
      durationMinutes: 30,
      classIds: [cls.id],
      allInClasses: true,
      excludeStudentIds: [],
    },
  });
  const { id, code } = (await sit.json()).data as { id: string; code: string };

  await login(page, 'student', studentPhone);
  await page.goto(`/ca/${code}`);
  await page.getByRole('link', { name: 'Bắt đầu làm bài' }).click();
  await page.getByLabel('Bài làm câu 1').fill('Mua he la mua cua bien xanh va tieng ve.');
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page.getByRole('heading', { name: 'Nộp bài thành công!' })).toBeVisible();

  const ctx = await browser.newContext({ baseURL });
  const t = await ctx.newPage();
  await login(t, 'teacher', teacherPhone);
  await t.goto(`/teacher/sittings/${id}?tab=results`);
  await t.getByRole('button', { name: /Xem bài của Hoc Sinh/ }).click({ timeout: 60_000 });
  await expect(t.getByText('Mua he la mua cua bien xanh')).toBeVisible();
  await t.getByLabel('Điểm Bo cuc').fill('1');
  await t.getByLabel('Điểm Noi dung').fill('1.5');
  await t.getByRole('button', { name: 'Lưu điểm câu này' }).click();
  await expect(dialog(t)).toContainText('Đã lưu điểm');
  await ok(t).click();
  await t.getByRole('button', { name: 'Đóng' }).click();
  await expect(t.getByRole('cell', { name: '2.5/2.5', exact: true })).toBeVisible();
  await t.getByRole('button', { name: 'Công bố kết quả' }).click();
  await dialog(t).getByRole('button', { name: 'Công bố' }).click();
  await expect(t.getByText(/Đã công bố lúc/)).toBeVisible();
  await ctx.close();

  await page.goto(`/ca/${code}/result`);
  await expect(page.getByLabel('Điểm số')).toHaveText('2.5/2.5');
});
