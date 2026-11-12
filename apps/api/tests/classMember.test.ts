// Created by Haihs on 12/11/2026
// Tests for the ClassMember model: unique pair, enum/regex validation, indexes.
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { ClassMemberModel } from '../src/models/ClassMember';
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
  await ClassMemberModel.deleteMany({});
});

const oid = () => new mongoose.Types.ObjectId();
const mk = (over: Record<string, unknown> = {}) =>
  ClassMemberModel.create({
    classId: oid(),
    userId: oid(),
    memberRole: 'student',
    status: 'pending',
    source: 'invite',
    ...over,
  });

describe('ClassMember model', () => {
  it('applies defaults', async () => {
    const m = await mk();
    expect(m.requestedAt).toBeInstanceOf(Date);
    expect(m.approvedAt).toBeNull();
    expect(m.addedBy).toBeNull();
    expect(m.approvedBy).toBeNull();
  });

  it('unique {classId,userId}', async () => {
    const m = await mk();
    await expect(mk({ classId: m.classId, userId: m.userId })).rejects.toMatchObject({
      code: 11000,
    });
    await expect(mk({ classId: m.classId })).resolves.toBeTruthy();
  });

  it('rejects invalid memberRole, status, source', async () => {
    await expect(mk({ memberRole: 'Student' })).rejects.toThrow(/memberRole/);
    await expect(mk({ memberRole: 'a-b' })).rejects.toThrow(/memberRole/);
    await expect(mk({ memberRole: 'teaching_assistant' })).resolves.toBeTruthy();
    await expect(mk({ status: 'rejected' })).rejects.toThrow(
      /`rejected` is not a valid enum value/,
    );
    await expect(mk({ source: 'x' })).rejects.toThrow(/`x` is not a valid enum value/);
  });

  it('builds the declared indexes', async () => {
    const keys = (await ClassMemberModel.collection.indexes()).map((i) => JSON.stringify(i.key));
    expect(keys).toContain('{"classId":1,"userId":1}');
    expect(keys).toContain('{"classId":1,"memberRole":1,"status":1,"requestedAt":1}');
    expect(keys).toContain('{"userId":1,"status":1}');
  });
});
