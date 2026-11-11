// Created by Haihs on 12/11/2026
// Tests for the Class model: code uniqueness, release on delete, atomic restoreWithCode, validations, hidden invite tokens, indexes.
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { ClassModel } from '../src/models/Class';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb();
  await mongoose.connect(db.uri);
  await ensureIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});
beforeEach(async () => {
  await ClassModel.deleteMany({});
});

const mk = (over: Record<string, unknown> = {}) =>
  ClassModel.create({
    createdBy: new mongoose.Types.ObjectId(),
    name: '10a1',
    code: 'A1',
    startYear: 2024,
    endYear: 2027,
    ...over,
  });
const e11000 = { code: 11000 };

describe('Class model', () => {
  it('upper-cases name and code with Vietnamese letters', async () => {
    const c = await mk({ name: ' lớp đặc biệt ', code: 'ăn1' });
    expect(c.name).toBe('LỚP ĐẶC BIỆT');
    expect(c.code).toBe('ĂN1');
    expect(c.codeKey).toBe('ăn1');
    expect(c.activeCodeKey).toBe('ăn1');
  });

  it('code unique ignoring case and surrounding spaces', async () => {
    await mk({ code: 'A1' });
    await expect(mk({ code: 'a1' })).rejects.toMatchObject(e11000);
    await expect(mk({ code: ' A1 ' })).rejects.toMatchObject(e11000);
    await expect(mk({ code: 'Á1' })).resolves.toBeTruthy(); // diacritics are significant (source: NFC + lowercase)
  });

  it('delete releases the code; a new class can take it', async () => {
    const a = await mk({ code: 'A1' });
    await a.softDelete();
    const raw = await ClassModel.findById(a._id).setOptions({ withDeleted: true });
    expect(raw?.deletedAt).toBeTruthy();
    expect(raw?.activeCodeKey).toBeUndefined();
    await expect(mk({ code: 'A1' })).resolves.toBeTruthy();
  });

  it('restoreWithCode into a taken code -> E11000, class stays deleted', async () => {
    const a = await mk({ code: 'A1' });
    await a.softDelete();
    await mk({ code: 'A1' });
    await expect(ClassModel.restoreWithCode(a._id)).rejects.toMatchObject(e11000);
    expect(await ClassModel.findById(a._id)).toBeNull();
  });

  it('restoreWithCode with a new free code works; $-leading code is literal', async () => {
    const a = await mk({ code: 'A1' });
    await a.softDelete();
    const r = await ClassModel.restoreWithCode(a._id, { code: '$b2' });
    expect(r.modifiedCount).toBe(1);
    const c = await ClassModel.findById(a._id);
    expect(c?.deletedAt).toBeNull();
    expect(c?.code).toBe('$B2');
    expect(c?.codeKey).toBe('$b2');
    expect(c?.activeCodeKey).toBe('$b2');
  });

  it('restoreWithCode without code restores the same code', async () => {
    const a = await mk({ code: 'A1' });
    await a.softDelete();
    await ClassModel.restoreWithCode(a._id);
    expect((await ClassModel.findById(a._id))?.activeCodeKey).toBe('a1');
  });

  it('two parallel restores into the same new code: exactly one wins', async () => {
    const a = await mk({ code: 'A1' });
    const b = await mk({ code: 'B1' });
    await a.softDelete();
    await b.softDelete();
    const res = await Promise.allSettled([
      ClassModel.restoreWithCode(a._id, { code: 'new' }),
      ClassModel.restoreWithCode(b._id, { code: 'new' }),
    ]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject(e11000);
  });

  it('validates limits, years and span', async () => {
    await expect(mk({ name: 'x'.repeat(101) })).rejects.toThrow(/100/);
    await expect(mk({ code: 'x'.repeat(31) })).rejects.toThrow(/30/);
    await expect(mk({ startYear: 1999, endYear: 2003 })).rejects.toThrow();
    await expect(mk({ startYear: 2101, endYear: 2102 })).rejects.toThrow();
    await expect(mk({ endYear: 2113 })).rejects.toThrow();
    await expect(mk({ startYear: 2024.5, endYear: 2027 })).rejects.toThrow();
    await expect(mk({ startYear: 2024, endYear: 2024 })).rejects.toThrow(/1 đến 12/);
    await expect(mk({ startYear: 2024, endYear: 2037 })).rejects.toThrow(/1 đến 12/);
    await expect(mk({ code: 'S12', startYear: 2024, endYear: 2036 })).resolves.toBeTruthy();
    await expect(mk({ status: 'nope' })).rejects.toThrow();
  });

  it('invite tokens are hidden from find() and toJSON/toObject; enabled defaults true', async () => {
    const c = await mk();
    await ClassModel.updateOne(
      { _id: c._id },
      { $set: { 'invite.student.token': 'secret-s', 'invite.teacher.token': 'secret-t' } },
    );
    const found = (await ClassModel.findById(c._id))!;
    expect(found.invite.student.token).toBeUndefined();
    expect(found.invite.student.enabled).toBe(true);
    const withTok = (await ClassModel.findById(c._id).select(
      '+invite.student.token +invite.teacher.token',
    ))!;
    expect(withTok.invite.student.token).toBe('secret-s');
    for (const json of [withTok.toJSON(), withTok.toObject()]) {
      expect(JSON.stringify(json)).not.toMatch(/secret-/);
    }
  });

  it('ensureIndexes builds the unique partial activeCodeKey index', async () => {
    const idx = await ClassModel.collection.indexes();
    const i = idx.find((x) => x.key && 'activeCodeKey' in x.key);
    expect(i?.unique).toBe(true);
    expect(i?.partialFilterExpression).toEqual({ activeCodeKey: { $exists: true } });
  });
});
