// Created by Haihs on 12/11/2026
// Specs for ClassesApi: exact URL/method/body per route, encoded ids, no undefined params, FormData import, ApiFailure passthrough.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, firstValueFrom } from 'rxjs';
import { ClassesApi } from './classes.api';

const ok = <T>(data: T) => ({ success: true, data });

describe('ClassesApi', () => {
  let api: ClassesApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ClassesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const cases: [string, () => Observable<unknown>, string, string, unknown?][] = [
    [
      'create',
      () => api.create({ name: 'A', code: 'B', startYear: 2023, endYear: 2026 }),
      'POST',
      '/api/classes',
      { name: 'A', code: 'B', startYear: 2023, endYear: 2026 },
    ],
    ['get', () => api.get('c1'), 'GET', '/api/classes/c1'],
    ['update', () => api.update('c1', { name: 'N' }), 'PATCH', '/api/classes/c1', { name: 'N' }],
    ['delete', () => api.delete('c1'), 'DELETE', '/api/classes/c1'],
    [
      'restore',
      () => api.restore('c1', { code: 'X' }),
      'POST',
      '/api/classes/c1/restore',
      { code: 'X' },
    ],
    ['restore no code', () => api.restore('c1'), 'POST', '/api/classes/c1/restore', {}],
    ['invite', () => api.invite('c1'), 'GET', '/api/classes/c1/invite'],
    [
      'rotateInvite',
      () => api.rotateInvite('c1', 'student'),
      'POST',
      '/api/classes/c1/invite/student/rotate',
    ],
    [
      'setInviteEnabled',
      () => api.setInviteEnabled('c1', 'teacher', false),
      'PATCH',
      '/api/classes/c1/invite/teacher',
      { enabled: false },
    ],
    ['join', () => api.join('tok'), 'POST', '/api/classes/join', { token: 'tok' }],
    [
      'addStudent phone',
      () => api.addStudent('c1', { phoneNumber: '0911111111' }),
      'POST',
      '/api/classes/c1/students',
      { phoneNumber: '0911111111' },
    ],
    [
      'addStudent id',
      () => api.addStudent('c1', { studentId: 's1' }),
      'POST',
      '/api/classes/c1/students',
      { studentId: 's1' },
    ],
    [
      'approveAllStudents',
      () => api.approveAllStudents('c1'),
      'POST',
      '/api/classes/c1/students/approve-all',
    ],
    [
      'rejectAllStudents',
      () => api.rejectAllStudents('c1'),
      'POST',
      '/api/classes/c1/students/reject-all',
    ],
    [
      'approveStudent',
      () => api.approveStudent('c1', 'u1'),
      'POST',
      '/api/classes/c1/students/u1/approve',
    ],
    ['removeStudent', () => api.removeStudent('c1', 'u1'), 'DELETE', '/api/classes/c1/students/u1'],
    [
      'renameStudent',
      () => api.renameStudent('c1', 'u1', 'Tên Mới'),
      'PATCH',
      '/api/classes/c1/students/u1',
      { fullName: 'Tên Mới' },
    ],
    [
      'resetStudentPassword',
      () => api.resetStudentPassword('c1', 'u1'),
      'POST',
      '/api/classes/c1/students/u1/reset-password',
    ],
    [
      'addTeacher',
      () => api.addTeacher('c1', { teacherId: 't1' }),
      'POST',
      '/api/classes/c1/teachers',
      { teacherId: 't1' },
    ],
    [
      'approveTeacher',
      () => api.approveTeacher('c1', 't1'),
      'POST',
      '/api/classes/c1/teachers/t1/approve',
    ],
    ['removeTeacher', () => api.removeTeacher('c1', 't1'), 'DELETE', '/api/classes/c1/teachers/t1'],
    ['myClasses', () => api.myClasses(), 'GET', '/api/me/classes'],
    ['myClass', () => api.myClass('c1'), 'GET', '/api/me/classes/c1'],
    ['leaveMyClass', () => api.leaveMyClass('c1'), 'DELETE', '/api/me/classes/c1'],
  ];

  it.each(cases)('%s -> %s %s', async (_n, call, method, url, body) => {
    const p = firstValueFrom(call());
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe(method);
    expect(req.request.params.keys()).toEqual([]);
    if (body === undefined) expect(req.request.body ?? null).toBeNull();
    else expect(req.request.body).toEqual(body);
    req.flush(ok({ done: true }));
    expect(await p).toEqual({ done: true });
  });

  it('list/students/teachers/search send only defined params', async () => {
    const check = async (call: Promise<unknown>, url: string, want: Record<string, string>) => {
      const req = http.expectOne((r) => r.url === url);
      expect(req.request.method).toBe('GET');
      const got = Object.fromEntries(
        req.request.params.keys().map((k) => [k, req.request.params.get(k)]),
      );
      expect(got).toEqual(want);
      req.flush(ok({ items: [] }));
      await call;
    };
    await check(
      firstValueFrom(api.list({ view: 'deleted', q: 'x', page: 2, limit: undefined })),
      '/api/classes',
      { view: 'deleted', q: 'x', page: '2' },
    );
    await check(firstValueFrom(api.list()), '/api/classes', {});
    await check(
      firstValueFrom(api.students('c1', { status: 'pending', q: undefined, studentId: 's' })),
      '/api/classes/c1/students',
      { status: 'pending', studentId: 's' },
    );
    await check(
      firstValueFrom(api.studentSearch('c1', { q: 'abc', page: 1 })),
      '/api/classes/c1/student-search',
      { q: 'abc', page: '1' },
    );
    await check(
      firstValueFrom(api.teachers('c1', { status: undefined })),
      '/api/classes/c1/teachers',
      {},
    );
    await check(
      firstValueFrom(api.teacherSearch('c1', { q: 'abc' })),
      '/api/classes/c1/teacher-search',
      { q: 'abc' },
    );
  });

  it('ids and kind are URL-encoded', async () => {
    const p = firstValueFrom(api.removeStudent('a/b?c', 'u#1'));
    const req = http.expectOne('/api/classes/a%2Fb%3Fc/students/u%231');
    req.flush(ok({}));
    await p;
    const q = firstValueFrom(api.rotateInvite('c1', '../x' as never));
    http.expectOne('/api/classes/c1/invite/..%2Fx/rotate').flush(ok({}));
    await q;
  });

  it('import posts a FormData with the file under "file" and returns summary + results', async () => {
    const f = new File(['a'], 'ds.csv', { type: 'text/csv' });
    const p = firstValueFrom(api.import('c1', f));
    const req = http.expectOne('/api/classes/c1/import');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBe(f);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    const data = {
      summary: { total: 0, created: 0, added: 0, alreadyMember: 0, errors: 0 },
      results: [],
    };
    req.flush(ok(data));
    expect(await p).toEqual(data);
  });

  it('4xx error is thrown as the ApiFailure unchanged', async () => {
    const p = firstValueFrom(api.restore('c1', { code: 'X' }));
    http
      .expectOne('/api/classes/c1/restore')
      .flush(
        { success: false, code: 'CLASS_CODE_TAKEN', message: 'trùng', field: 'code' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(p).rejects.toMatchObject({
      code: 'CLASS_CODE_TAKEN',
      field: 'code',
      status: 409,
      message: 'trùng',
    });
  });
});
