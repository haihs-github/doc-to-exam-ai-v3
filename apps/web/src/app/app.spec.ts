// Created by Haihs on 11/11/2026
// Smoke test for the root component.
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Subject, throwError } from 'rxjs'; // Haihs: mock Observable cho test health - start - end
import { ApiClient } from './core/api-client'; // Haihs: mock ApiClient cho test health - start - end

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    TestBed.overrideProvider(ApiClient, { useValue: { get: () => new Subject() } }); // Haihs: tránh gửi request thật - start - end
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    TestBed.overrideProvider(ApiClient, { useValue: { get: () => new Subject() } }); // Haihs: tránh gửi request thật - start - end
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // expect(compiled.querySelector('h1')?.textContent).toContain('Hello, web'); // Haihs: đóng code cũ, placeholder CLI đã bị thay - start - end
    expect(compiled.querySelector('h1')?.textContent).toContain('Doc to Exam'); // Haihs: khớp tiêu đề mới - start - end
  });

  // Haihs: test trạng thái API health (loading / OK / lỗi) - start
  describe('API health', () => {
    const setup = (get: () => unknown) => {
      TestBed.overrideProvider(ApiClient, { useValue: { get } });
      const fixture = TestBed.createComponent(App);
      return { fixture, el: fixture.nativeElement as HTMLElement };
    };

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
        throwError(() => ({ success: false, code: 'INTERNAL', message: 'x', status: 0 })));
      await fixture.whenStable();
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Không kết nối được máy chủ');
    });
  });
  // Haihs: test trạng thái API health (loading / OK / lỗi) - end
});
