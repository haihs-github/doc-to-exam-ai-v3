// Created by Haihs on 11/11/2026
// Specs for ApiActivity (in-flight request counter).
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiActivity } from './api-activity';
import { authInterceptor } from './auth.interceptor';

describe('ApiActivity', () => {
  it('counts begin/end and never goes below 0', () => {
    const a = TestBed.inject(ApiActivity);
    a.begin('GET');
    a.begin('POST');
    expect(a.pending()).toBe(2);
    expect(a.writing()).toBe(1);
    expect(a.isBusy()).toBe(true);
    a.end('POST');
    a.end('GET');
    a.end('GET');
    expect(a.pending()).toBe(0);
    expect(a.writing()).toBe(0);
    expect(a.isBusy()).toBe(false);
  });

  describe('via interceptor', () => {
    let http: HttpClient;
    let ctl: HttpTestingController;
    let a: ApiActivity;
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([authInterceptor])),
          provideHttpClientTesting(),
        ],
      });
      http = TestBed.inject(HttpClient);
      ctl = TestBed.inject(HttpTestingController);
      a = TestBed.inject(ApiActivity);
    });

    it('ends exactly once on success, error and cancel', () => {
      http.get('/api/a').subscribe();
      http.post('/api/b', {}).subscribe({ error: () => undefined });
      const c = http.get('/api/c').subscribe();
      expect(a.pending()).toBe(3);
      expect(a.writing()).toBe(1);
      ctl.expectOne('/api/a').flush({});
      expect(a.pending()).toBe(2);
      ctl.expectOne('/api/b').flush({}, { status: 500, statusText: 'x' });
      expect(a.pending()).toBe(1);
      expect(a.writing()).toBe(0);
      c.unsubscribe();
      expect(a.pending()).toBe(0);
      expect(ctl.expectOne('/api/c').cancelled).toBe(true);
    });
  });
});
