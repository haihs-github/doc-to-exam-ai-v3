// Created by Haihs on 11/11/2026
// Tests for the User model: hidden fields, unique phone, immutable role, nameSearch, encrypted Gemini key, toAuthUser.
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/lib/handler';
import { inspect } from 'node:util';
import { UserModel, resetWarned } from '../src/models/User';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb();
  await mongoose.connect(db.uri);
  await UserModel.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
  vi.restoreAllMocks();
  resetWarned();
});

const mk = (over: Record<string, unknown> = {}) =>
  UserModel.create({
    phoneNumber: '0901234567',
    fullName: 'nguyễn văn ánh',
    password: 'hash-hash-hash',
    role: 'teacher',
    ...over,
  });

describe('User model', () => {
  it('toJSON hides geminiApiKey, password, nameSearch, tokenVersion', async () => {
    const u = await mk();
    u.setGeminiApiKey('AIza-secret-1234');
    await u.save();
    const json = u.toJSON() as unknown as Record<string, unknown>;
    for (const k of ['geminiApiKey', 'password', 'nameSearch', 'tokenVersion'])
      expect(json).not.toHaveProperty(k);
    expect(json.fullName).toBe('Nguyễn Văn Ánh');
  });

  it('rejects a duplicate phone with E11000', async () => {
    await mk();
    await expect(mk()).rejects.toMatchObject({ code: 11000 });
  });

  it('role is immutable (save and update both ignored)', async () => {
    const u = await mk();
    u.role = 'admin';
    await u.save();
    await UserModel.updateOne({ _id: u._id }, { role: 'admin' });
    await UserModel.findOneAndUpdate({ _id: u._id }, { $set: { role: 'admin' } });
    expect((await UserModel.collection.findOne({ _id: u._id }))?.role).toBe('teacher');
  });

  it('nameSearch is accent-stripped and follows fullName on save', async () => {
    const u = await mk({ fullName: 'Nguyễn Văn Ánh' });
    expect(u.nameSearch).toBe('nguyen van anh');
    u.fullName = 'Đặng thị lụa';
    await u.save();
    expect((await UserModel.findById(u._id))?.nameSearch).toBe('dang thi lua');
  });

  it('stores geminiApiKey encrypted and the getter returns plain', async () => {
    const u = await mk();
    u.setGeminiApiKey('  AIza-plain-key  ');
    await u.save();
    const raw = await UserModel.collection.findOne({ _id: u._id });
    expect(raw?.geminiApiKey).toMatch(/^enc:v1:/);
    expect(JSON.stringify(raw)).not.toContain('AIza-plain-key');
    expect((await UserModel.findById(u._id))?.geminiApiKey).toBe('AIza-plain-key');
  });

  it('getter returns "" on decrypt failure, warns once without data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const u = await mk();
    await UserModel.collection.updateOne(
      { _id: u._id },
      { $set: { geminiApiKey: 'enc:v1:AAAA:AAAA:AAAA' } },
    );
    const loaded = await UserModel.findById(u._id);
    expect(loaded?.geminiApiKey).toBe('');
    expect(loaded?.geminiApiKey).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('AAAA');
    expect(loaded?.toAuthUser().hasApiKey).toBe(false);
  });

  it('setGeminiApiKey rejects enc:v1: input with VALIDATION and "" clears', async () => {
    const u = await mk();
    let err: unknown;
    try {
      u.setGeminiApiKey('enc:v1:a:b:c');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ code: 'VALIDATION', extra: { field: 'geminiApiKey' } });
    u.setGeminiApiKey('abcd1234');
    u.setGeminiApiKey('');
    expect(u.geminiApiKey).toBe('');
  });

  it('toAuthUser: teacher has hasApiKey/apiKeyLast4, student does not', async () => {
    const t = await mk();
    expect(t.toAuthUser()).toMatchObject({
      role: 'teacher',
      hasApiKey: false,
      mustChangePassword: false,
      phoneNumber: '0901234567',
    });
    t.setGeminiApiKey('AIza-wxyz-9876');
    expect(t.toAuthUser()).toMatchObject({
      id: String(t._id),
      hasApiKey: true,
      apiKeyLast4: '9876',
    });
    const s = await mk({ phoneNumber: '0900000001', role: 'student' });
    const a = s.toAuthUser();
    expect(a).not.toHaveProperty('hasApiKey');
    expect(a).not.toHaveProperty('apiKeyLast4');
  });
});

describe('User model hardening', () => {
  it('toObject, JSON.stringify and util.inspect leak no sensitive field or value', async () => {
    const u = await mk();
    u.setGeminiApiKey('AIza-leak-check-5555');
    await u.save();
    const dump = [
      Object.keys(u.toObject()).join(','),
      JSON.stringify(u),
      inspect(u, { depth: 5 }),
    ].join('\n');
    for (const bad of [
      'AIza-leak-check-5555',
      'hash-hash-hash',
      'tokenVersion',
      'nameSearch',
      'geminiApiKey',
      'password',
    ])
      expect(dump).not.toContain(bad);
    expect(u.toObject()).toHaveProperty('id');
  });

  it('updateOne / findOneAndUpdate / updateMany on fullName recompute nameSearch', async () => {
    const u = await mk();
    await UserModel.updateOne({ _id: u._id }, { $set: { fullName: 'Lê Đình Ân' } });
    expect((await UserModel.collection.findOne({ _id: u._id }))?.nameSearch).toBe('le dinh an');
    await UserModel.findOneAndUpdate({ _id: u._id }, { fullName: 'Phạm Thị Bưởi' });
    expect((await UserModel.collection.findOne({ _id: u._id }))?.nameSearch).toBe('pham thi buoi');
    await UserModel.updateMany({}, { $set: { fullName: 'Trần Văn Ơn' } });
    expect((await UserModel.collection.findOne({ _id: u._id }))?.nameSearch).toBe('tran van on');
  });

  it('updateOne $set geminiApiKey stores enc:v1: in the raw doc', async () => {
    const u = await mk();
    await UserModel.updateOne({ _id: u._id }, { $set: { geminiApiKey: 'AIza-upd-key' } });
    const raw = await UserModel.collection.findOne({ _id: u._id });
    expect(raw?.geminiApiKey).toMatch(/^enc:v1:/);
    expect((await UserModel.findById(u._id))?.geminiApiKey).toBe('AIza-upd-key');
  });

  it('the schema itself rejects enc:v1: values on create and update', async () => {
    await expect(mk({ geminiApiKey: 'enc:v1:junk' })).rejects.toBeDefined();
    const u = await mk();
    await expect(
      UserModel.updateOne({ _id: u._id }, { $set: { geminiApiKey: 'enc:v1:junk' } }),
    ).rejects.toBeDefined();
    expect((await UserModel.collection.findOne({ _id: u._id }))?.geminiApiKey).toBe('');
  });

  it('rejects a phone with spaces', async () => {
    await expect(mk({ phoneNumber: '090 123 4567' })).rejects.toBeDefined();
  });
});
