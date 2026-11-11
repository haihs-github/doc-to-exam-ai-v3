// Created by Haihs on 11/11/2026
// Specs for <app-api-health>: the M0 health-status tests moved here from app.spec.ts (intent unchanged).
import { TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { ApiClient } from '../core/api-client';
import { ApiHealth } from './api-health';

describe('ApiHealth', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApiHealth] }).compileComponents();
  });

  const setup = (get: () => unknown) => {
    TestBed.overrideProvider(ApiClient, { useValue: { get } });
    const fixture = TestBed.createComponent(ApiHealth);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('should create and render the title', async () => {
    const { fixture, el } = setup(() => new Subject());
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain('Doc to Exam');
  });

  it('shows loading before the API answers', async () => {
    const s$ = new Subject<unknown>();
    const { fixture, el } = setup(() => s$);
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Đang kiểm tra');
    expect(el.querySelector('h1')?.textContent).toBe('Doc to Exam AI');
  });

  it('shows OK when status is OK', async () => {
    const s$ = new Subject<unknown>();
    const { fixture, el } = setup(() => s$);
    s$.next({ status: 'OK', timestamp: 't', service: 's' });
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('OK');
    expect(el.querySelector('h1')?.textContent).toBe('Doc to Exam AI');
  });

  it('shows not-ready when status is not OK', async () => {
    const s$ = new Subject<unknown>();
    const { fixture, el } = setup(() => s$);
    s$.next({ status: 'DOWN', timestamp: 't', service: 's' });
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('không sẵn sàng');
  });

  it('unsubscribes when destroyed', () => {
    const s$ = new Subject<unknown>();
    const { fixture } = setup(() => s$);
    expect(s$.observed).toBe(true);
    fixture.destroy();
    expect(s$.observed).toBe(false);
    expect(() => s$.next({ status: 'OK' })).not.toThrow();
  });

  it('shows a Vietnamese message on error without throwing', async () => {
    const { fixture, el } = setup(() =>
      throwError(() => ({ success: false, code: 'INTERNAL', message: 'x', status: 0 })),
    );
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'Không kết nối được máy chủ',
    );
  });
});
