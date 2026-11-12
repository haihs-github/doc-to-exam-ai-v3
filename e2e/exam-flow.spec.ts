// Created by Haihs on 13/11/2026
// Exam flow E2E (M3-M7): API-seeded teacher/class/template/sitting, then the student takes the exam in the UI, the teacher sees and publishes the result. Selectors by role/label only.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const SECRET = process.env.E2E_TEACHER_SECRET_KEY ?? 'e2e-teacher-secret';
const PASSWORD = 'Passw0rd!1';

let seq = 0;
const newPhone = () =>
  `09${String(Date.now() % 1e6).padStart(6, '0')}${String(seq++ % 100).padStart(2, '0')}`;
const uniq = () => `${Date.now() % 1e6}${seq++}`;
const field = (page: Page, name: string) => page.locator(`input[name="${name}"]`);
const dialog = (page: Page) => page.getByRole('alertdialog');

type Auth = { token: string; user: { id: string } };
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function register(
  api: APIRequestContext,
  kind: 'teacher' | 'student',
  phone: string,
  name: string,
): Promise<Auth> {
  const res = await api.post(`/api/auth/${kind}/register`, {
    data: {
      phoneNumber: phone,
      fullName: name,
      password: PASSWORD,
      ...(kind === 'teacher' ? { secretKey: SECRET } : {}),
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data as Auth;
}

/** Teacher + student + approved class + template + OPEN sitting granted to the student. Returns the sitting code and the student's phone. */
async function seed(api: APIRequestContext) {
  const teacher = await register(api, 'teacher', newPhone(), 'Giao Vien Thi');
  const studentPhone = newPhone();
  const student = await register(api, 'student', studentPhone, 'Hoc Sinh Thi');
  const th = auth(teacher.token);

  const cls = (
    await (
      await api.post('/api/classes', {
        headers: th,
        data: { name: 'Lop Thi', code: `E2E${uniq()}`, startYear: 2025, endYear: 2026 },
      })
    ).json()
  ).data;
  const invite = (await (await api.get(`/api/classes/${cls.id}/invite`, { headers: th })).json())
    .data;
  const join = await api.post('/api/classes/join', {
    headers: auth(student.token),
    data: { token: invite.student.token },
  });
  expect(join.ok()).toBeTruthy();
  const approve = await api.post(`/api/classes/${cls.id}/students/${student.user.id}/approve`, {
    headers: th,
  });
  expect(approve.ok()).toBeTruthy();

  const questions = [1, 2].map((id) => ({
    id,
    questionText: `Cau hoi ${id}`,
    options: { A: 'Dap an A', B: 'Dap an B', C: 'Dap an C', D: 'Dap an D' },
    correctAnswer: 'B',
    explanation: '',
    context: '',
  }));
  const template = (
    await (
      await api.post('/api/templates', {
        headers: th,
        data: { title: `De ${uniq()}`, description: '', questions },
      })
    ).json()
  ).data;
  const now = Date.now();
  const sitting = await api.post('/api/sittings', {
    headers: th,
    data: {
      templateId: template.id,
      openAt: new Date(now - 60_000).toISOString(),
      closeAt: new Date(now + 60 * 60_000).toISOString(),
      durationMinutes: 30,
      classIds: [cls.id],
      allInClasses: true,
      excludeStudentIds: [],
    },
  });
  expect(sitting.status()).toBe(201);
  const created = (await sitting.json()).data as { id: string; code: string };
  return {
    teacherPhone: (await (await api.get('/api/auth/me', { headers: th })).json()).data
      .phoneNumber as string,
    studentPhone,
    code: created.code,
    sittingId: created.id,
  };
}

async function login(page: Page, kind: 'teacher' | 'student', phone: string) {
  await page.goto(kind === 'teacher' ? '/teacher/login' : '/login');
  await field(page, 'phoneNumber').fill(phone);
  await field(page, 'password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng Nhập Ngay' }).click();
  await expect(page).not.toHaveURL(/\/login$/); // wait for the login to finish before navigating away
}

test('student takes the exam, teacher sees the submission and publishes, student sees the score', async ({
  page,
  browser,
  baseURL,
  request,
}) => {
  test.setTimeout(180_000); // many routes are compiled on their first hit by `next dev`
  const { teacherPhone, studentPhone, code, sittingId } = await seed(request);

  // student: enter by code, answer both questions B (the correct one), submit
  await login(page, 'student', studentPhone);
  await expect(page).toHaveURL(/\/sittings$/);
  await page.goto(`/ca/${code}`);
  await page.getByRole('link', { name: 'Bắt đầu làm bài' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  for (const n of [1, 2])
    await page
      .getByRole('radiogroup', { name: `Đáp án câu ${n}` })
      .getByLabel(/^B\./)
      .check();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Nộp bài' }).click();
  await expect(page.getByRole('heading', { name: 'Nộp bài thành công!' })).toBeVisible();

  // a second submit is impossible: back to the entry shows it as submitted
  await page.goto(`/ca/${code}`);
  await expect(page.getByText(/Đã nộp lúc/)).toBeVisible();

  // teacher: results tab shows one submission with 10/10, then publishes
  const ctx = await browser.newContext({ baseURL });
  const t = await ctx.newPage();
  await login(t, 'teacher', teacherPhone);
  await t.goto(`/teacher/sittings/${sittingId}?tab=results`);
  // the first hit of each route compiles it on demand in `next dev`: allow for that
  await expect(t.getByRole('cell', { name: 'Hoc Sinh Thi', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(t.getByRole('cell', { name: '10/10', exact: true })).toBeVisible();
  await t.getByRole('button', { name: 'Công bố kết quả' }).click();
  await dialog(t).getByRole('button', { name: 'Công bố' }).click();
  await expect(t.getByText(/Đã công bố lúc/)).toBeVisible();
  await ctx.close();

  // student: the result is visible
  await page.goto(`/ca/${code}/result`);
  await expect(page.getByLabel('Điểm số')).toHaveText('10/10', { timeout: 60_000 });
});

test('a student without a grant cannot enter the sitting', async ({ page, request }) => {
  const { code } = await seed(request);
  const outsider = newPhone();
  await register(request, 'student', outsider, 'Nguoi La');
  await login(page, 'student', outsider);
  await page.goto(`/ca/${code}`);
  await expect(page.getByText('Bạn chưa được cấp quyền vào ca thi này')).toBeVisible();
});
