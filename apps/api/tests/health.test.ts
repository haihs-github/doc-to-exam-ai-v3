// Created by Haihs on 11/11/2026
// Tests for /api/health, the contract import and startTestDb.
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '@doc-to-exam/contract';
import { GET } from '../app/api/health/route';
import { call, startTestDb } from './helpers';

describe('GET /api/health', () => {
  // Haihs: Health returns the contract {success,data} envelope (D10) - start
  // đóng code cũ
  // it('returns OK like the source app', async () => {
  //   const { status, body } = await call(GET, { url: 'http://x/api/health' });
  //   expect(status).toBe(200);
  //   expect(body.status).toBe('OK');
  //   expect(body.service).toBe('Doc to Exam AI Backend');
  //   expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  // });
  it('returns OK in the contract envelope', async () => {
    const { status, body } = await call(GET, { url: 'http://x/api/health' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('OK');
    expect(body.data.service).toBe('Doc to Exam AI Backend');
    expect(Number.isNaN(Date.parse(body.data.timestamp))).toBe(false);
  });
  // Haihs: Health returns the contract {success,data} envelope (D10) - end

  it('resolves @doc-to-exam/contract', () => {
    expect(HTTP_STATUS).toBeDefined();
  });
});

describe('startTestDb', () => {
  it('starts, accepts a connection, pings and stops', async () => {
    const db = await startTestDb();
    const conn = await mongoose.createConnection(db.uri).asPromise();
    expect((await conn.db!.admin().ping()).ok).toBe(1);
    await conn.close();
    await db.stop();
  });
});
