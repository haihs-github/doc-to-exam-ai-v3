// Created by Haihs on 11/11/2026
// Tests for ApiClient: unwrap ApiOk.data, throw ApiError for contract failures, INTERNAL for non-contract bodies, status 0 marking.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '@doc-to-exam/contract';
import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('get unwraps data and sends params', async () => {
    const p = firstValueFrom(api.get<{ id: number }>('/api/x', { a: 1, b: 'z' }));
    const req = http.expectOne((r) => r.url === '/api/x');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('a')).toBe('1');
    expect(req.request.params.get('b')).toBe('z');
    req.flush({ success: true, data: { id: 7 } });
    expect(await p).toEqual({ id: 7 });
  });

  it('post/put/delete unwrap data with the right method and body', async () => {
    const post = firstValueFrom(api.post<string>('/api/x', { n: 1 }));
    const r1 = http.expectOne('/api/x');
    expect(r1.request.method).toBe('POST');
    expect(r1.request.body).toEqual({ n: 1 });
    r1.flush({ success: true, data: 'p' });
    expect(await post).toBe('p');

    const put = firstValueFrom(api.put<string>('/api/x', { n: 2 }));
    const r2 = http.expectOne('/api/x');
    expect(r2.request.method).toBe('PUT');
    r2.flush({ success: true, data: 'u', message: 'ok' });
    expect(await put).toBe('u');

    const del = firstValueFrom(api.delete<null>('/api/x'));
    const r3 = http.expectOne('/api/x');
    expect(r3.request.method).toBe('DELETE');
    r3.flush({ success: true, data: null });
    expect(await del).toBeNull();
  });

  it('contract error body -> throws ApiError', async () => {
    const p = firstValueFrom(api.get('/api/x'));
    http.expectOne('/api/x').flush(
      { success: false, code: 'NOT_FOUND', message: 'Không tìm thấy', field: 'id' }, { status: 404, statusText: 'Not Found' });
    const e = await p.catch((x) => x);
    expect(isApiError(e)).toBe(true);
    expect(e).toMatchObject({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy', field: 'id', status: 404 });
  });

  it('HTML body -> INTERNAL with generic Vietnamese message', async () => {
    const p = firstValueFrom(api.get('/api/x'));
    http.expectOne('/api/x').flush('<html>502</html>', { status: 502, statusText: 'Bad Gateway' });
    const e = await p.catch((x) => x);
    expect(e).toMatchObject({ success: false, code: 'INTERNAL', status: 502 });
    expect(isApiError(e)).toBe(true);
    expect((e as Error).message).not.toContain('html');
  });

  it('null body on error -> INTERNAL; Retry-After kept for 503', async () => {
    const p = firstValueFrom(api.get('/api/x'));
    http.expectOne('/api/x').flush(null, { status: 503, statusText: 'x', headers: { 'Retry-After': '4' } });
    const e = await p.catch((x) => x);
    expect(e).toMatchObject({ code: 'INTERNAL', status: 503, retryAfter: '4' });
  });

  it('2xx with non-contract body -> INTERNAL', async () => {
    const p = firstValueFrom(api.get('/api/x'));
    http.expectOne('/api/x').flush(null);
    const e = await p.catch((x) => x);
    expect(e).toMatchObject({ success: false, code: 'INTERNAL' });
  });

  it('network failure -> INTERNAL with status 0', async () => {
    const p = firstValueFrom(api.get('/api/x'));
    http.expectOne('/api/x').error(new ProgressEvent('error'));
    const e = await p.catch((x) => x);
    expect(e).toMatchObject({ success: false, code: 'INTERNAL', status: 0 });
  });
});
