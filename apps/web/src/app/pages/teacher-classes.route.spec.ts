// Created by Haihs on 12/11/2026
// Route spec: /teacher/classes is teacher-only (guest -> teacher login with state.from, student -> /).
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import type { AuthUser } from '@doc-to-exam/contract';
import { routes } from '../app.routes';
import { AuthService } from '../core/auth.service';
import { ClassesApi } from '../core/classes.api';

const mk = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '1',
  phoneNumber: '0912345678',
  fullName: 'Cô B',
  role: 'teacher',
  mustChangePassword: false,
  ...over,
});

const setup = async () => {
  const user = signal<AuthUser | null>(null);
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: { user, isLoading: signal(false), loadError: signal(''), reload: vi.fn() },
      },
      {
        provide: ClassesApi,
        useValue: {
          list: () =>
            of({ items: [], page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false }),
        },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  const go = async () => {
    await harness.navigateByUrl('/teacher/classes');
    await harness.fixture.whenStable();
    return router.url;
  };
  return { user, harness, router, go };
};

describe('route /teacher/classes', () => {
  it('guest -> /teacher/login remembering where they came from', async () => {
    const s = await setup();
    expect(await s.go()).toBe('/teacher/login');
    expect(s.router.lastSuccessfulNavigation()?.extras.state).toEqual({ from: '/teacher/classes' });
  });

  it('student -> /', async () => {
    const s = await setup();
    s.user.set(mk({ role: 'student' }));
    // expect(await s.go()).toBe('/'); // Haihs: đóng code cũ M8 trang chủ theo vai trò (TEACHER_HOME, / chuyển hướng) - start - end
    expect(await s.go()).toBe('/sittings'); // Haihs: M8 trang chủ theo vai trò (TEACHER_HOME, / chuyển hướng) - start - end
  });

  it('teacher sees the page', async () => {
    const s = await setup();
    s.user.set(mk());
    expect(await s.go()).toBe('/teacher/classes');
    expect(s.harness.routeNativeElement?.tagName).toBe('APP-TEACHER-CLASSES');
  });
});
