// Created by Haihs on 11/11/2026
// Specs for authInterceptor: Bearer attachment (API urls only), 401 and 403 MUST_CHANGE_PASSWORD events.
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TokenStore } from './token-store';
import {
  authInterceptor,
  MUST_CHANGE_PASSWORD_EVENT,
  UNAUTHENTICATED_EVENT,
} from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let tokens: TokenStore;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
  });
  afterEach(() => {
    ctl.verify();
    localStorage.clear();
  });

  const events = (name: string) => {
    const spy = vi.fn();
    window.addEventListener(name, spy);
    return { spy, off: () => window.removeEventListener(name, spy) };
  };

  it('adds Bearer to /api requests when a token exists', () => {
    tokens.set('tok123');
    http.get('/api/x').subscribe();
    expect(ctl.expectOne('/api/x').request.headers.get('Authorization')).toBe('Bearer tok123');
  });

  it('sends no header without a token', () => {
    http.get('/api/x').subscribe();
    expect(ctl.expectOne('/api/x').request.headers.has('Authorization')).toBe(false);
  });

  it('does not attach the token to cross-origin or non-/api urls', () => {
    tokens.set('tok123');
    http.get('https://evil.example.com/api/x').subscribe();
    http.get('/assets/x.json').subscribe();
    http.get('/apiary').subscribe();
    for (const u of ['https://evil.example.com/api/x', '/assets/x.json', '/apiary']) {
      expect(ctl.expectOne(u).request.headers.has('Authorization')).toBe(false);
    }
  });

  it('attaches to same-origin absolute /api urls', () => {
    tokens.set('tok123');
    const u = `${location.origin}/api/x`;
    http.get(u).subscribe();
    expect(ctl.expectOne(u).request.headers.get('Authorization')).toBe('Bearer tok123');
  });

  it('401 clears the token and dispatches auth:unauthenticated', () => {
    const e = events(UNAUTHENTICATED_EVENT);
    tokens.set('tok123');
    http.get('/api/x').subscribe({ error: () => undefined });
    ctl
      .expectOne('/api/x')
      .flush(
        { success: false, code: 'UNAUTHENTICATED', message: 'm' },
        { status: 401, statusText: 'x' },
      );
    expect(tokens.get()).toBeNull();
    expect(e.spy).toHaveBeenCalledTimes(1);
    e.off();
    expect(UNAUTHENTICATED_EVENT).toBe('auth:unauthenticated');
  });

  it('403 MUST_CHANGE_PASSWORD dispatches auth:must-change-password and keeps the token', () => {
    const e = events(MUST_CHANGE_PASSWORD_EVENT);
    const u = events(UNAUTHENTICATED_EVENT);
    tokens.set('tok123');
    http.get('/api/x').subscribe({ error: () => undefined });
    ctl
      .expectOne('/api/x')
      .flush(
        { success: false, code: 'MUST_CHANGE_PASSWORD', message: 'm' },
        { status: 403, statusText: 'x' },
      );
    expect(tokens.get()).toBe('tok123');
    expect(e.spy).toHaveBeenCalledTimes(1);
    expect(u.spy).not.toHaveBeenCalled();
    e.off();
    u.off();
    expect(MUST_CHANGE_PASSWORD_EVENT).toBe('auth:must-change-password');
  });

  it('other 403/500 errors change nothing; the error still propagates', () => {
    const e = events(MUST_CHANGE_PASSWORD_EVENT);
    const u = events(UNAUTHENTICATED_EVENT);
    tokens.set('tok123');
    const err = vi.fn();
    http.get('/api/x').subscribe({ error: err });
    ctl
      .expectOne('/api/x')
      .flush({ success: false, code: 'FORBIDDEN', message: 'm' }, { status: 403, statusText: 'x' });
    http.get('/api/y').subscribe({ error: err });
    ctl.expectOne('/api/y').flush('boom', { status: 500, statusText: 'x' });
    expect(err).toHaveBeenCalledTimes(2);
    expect(tokens.get()).toBe('tok123');
    expect(e.spy).not.toHaveBeenCalled();
    expect(u.spy).not.toHaveBeenCalled();
    e.off();
    u.off();
  });
});
