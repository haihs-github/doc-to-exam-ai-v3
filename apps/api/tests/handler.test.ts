// Created by Haihs on 11/11/2026
// Tests for readJson, HttpError and withErrors (safe error handling).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, readJson, withErrors } from '../src/lib/handler';
import { call } from './helpers';

afterEach(() => vi.restoreAllMocks());

const post = (body: string) => new Request('http://x/', { method: 'POST', body, headers: { 'content-type': 'application/json' } });

describe('readJson', () => {
  it('parses valid JSON', async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
  });
  it.each(['{bad', ''])('throws HttpError VALIDATION for %j', async (b) => {
    await expect(readJson(post(b))).rejects.toMatchObject({ name: 'HttpError', code: 'VALIDATION' });
  });
});

// Haihs: readJson trần byte và HttpError message tiếng Việt - start
describe('readJson size cap', () => {
  it('body 1 MiB + 1 -> 413 PAYLOAD_TOO_LARGE (actual length, no Content-Length)', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(1_048_576) });
    await expect(readJson(post(big))).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });
  it('declared Content-Length over the cap -> 413 without reading', async () => {
    const req = new Request('http://x/', { method: 'POST', body: '{}', headers: { 'content-length': '2000000' } });
    await expect(readJson(req)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });
  it('custom maxBytes is honoured', async () => {
    await expect(readJson(post('{"a":"xxxxxxxx"}'), 5)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });
  it('413 via withErrors', async () => {
    const h = withErrors(async (req) => { await readJson(req, 5); return Response.json({}); });
    const r = await call(h, { method: 'POST', body: '{"a":"xxxxxxxx"}' });
    expect(r.status).toBe(413);
    expect(r.body.message).toBe('Dữ liệu gửi lên quá lớn');
  });
});

describe('HttpError message', () => {
  it('Vietnamese message passes through withErrors', async () => {
    const h = withErrors(async () => { throw new HttpError('NOT_FOUND', 'Không tìm thấy'); });
    expect(await call(h)).toEqual({ status: 404, body: { success: false, code: 'NOT_FOUND', message: 'Không tìm thấy' } });
  });
});
// Haihs: readJson trần byte và HttpError message tiếng Việt - end

describe('withErrors', () => {
  it('passes through the handler response', async () => {
    const r = await call(withErrors(async () => Response.json({ a: 1 })));
    expect(r).toEqual({ status: 200, body: { a: 1 } });
  });
  it('maps HttpError to fail() with field', async () => {
    const h = withErrors(async () => { throw new HttpError('NOT_FOUND', 'nope', { field: 'id' }); });
    expect(await call(h)).toEqual({ status: 404, body: { success: false, code: 'NOT_FOUND', message: 'nope', field: 'id' } });
  });
  it('malformed JSON body -> 400 VALIDATION, not 500', async () => {
    const h = withErrors(async (req) => { await readJson(req); return Response.json({}); });
    const r = await call(h, { method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION');
  });
  it('unexpected error -> 500 INTERNAL, nothing leaked, logged server-side', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await withErrors(async () => { throw new Error('secret stack'); })(new Request('http://x/'), {});
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ success: false, code: 'INTERNAL', message: 'Lỗi máy chủ' });
    expect(text).not.toMatch(/secret|stack/);
    expect(spy).toHaveBeenCalled();
  });
});
