// Created by Haihs on 11/11/2026
// Tests for fail/ok/parsePage/pageResult/toObjectId (ported from source apiResponse.field.test.js + plan Review Focus).
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { fail, ok, pageResult, parsePage, toObjectId } from '../src/lib/apiResponse';

const json = async (r: Response) => ({ status: r.status, body: await r.json() });

describe('fail', () => {
  it('maps code to HTTP_STATUS with 3 keys when no extra', async () => {
    expect(await json(fail('NOT_FOUND', 'm'))).toEqual({ status: 404, body: { success: false, code: 'NOT_FOUND', message: 'm' } });
  });
  it('adds field and data only when given', async () => {
    const r = await json(fail('CONFLICT', 'm', { field: 'code', data: { a: 1 } }));
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ success: false, code: 'CONFLICT', message: 'm', field: 'code', data: { a: 1 } });
  });
});

describe('ok', () => {
  it('defaults to 200 {success,data}', async () => {
    expect(await json(ok({ x: 1 }))).toEqual({ status: 200, body: { success: true, data: { x: 1 } } });
  });
  it('supports status and message', async () => {
    expect(await json(ok(null, { status: 201, message: 'done' }))).toEqual({ status: 201, body: { success: true, data: null, message: 'done' } });
  });
});

describe('parsePage', () => {
  const p = (q: string, o?: { defaultLimit?: number; maxLimit?: number }) => parsePage(new URLSearchParams(q), o);
  it('garbage falls back to defaults', () => {
    expect(p('page=-3&limit=abc', { defaultLimit: 20, maxLimit: 100 })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
  it('clamps limit to maxLimit and page to 100000', () => {
    expect(p('limit=99999', { maxLimit: 50 }).limit).toBe(50);
    expect(p('page=9999999').page).toBe(100000);
  });
  it('computes skip', () => {
    expect(p('page=3&limit=10')).toEqual({ page: 3, limit: 10, skip: 20 });
  });
});

describe('pageResult', () => {
  it('totalPages = ceil(total/limit); total 0 -> 0', () => {
    expect(pageResult([1], 21, { page: 1, limit: 10 })).toEqual({ items: [1], total: 21, page: 1, limit: 10, totalPages: 3 });
    expect(pageResult([], 0, { page: 1, limit: 10 }).totalPages).toBe(0);
  });
});

describe('toObjectId', () => {
  it('invalid -> null, valid -> ObjectId', () => {
    expect(toObjectId('zzz')).toBeNull();
    expect(toObjectId(123)).toBeNull();
    const id = '507f1f77bcf86cd799439011';
    expect(toObjectId(id)).toBeInstanceOf(Types.ObjectId);
    expect(toObjectId(id)!.toString()).toBe(id);
  });
});
