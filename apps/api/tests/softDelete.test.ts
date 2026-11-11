// Created by Haihs on 12/11/2026
// Tests for the soft-delete plugin: default filtering, withDeleted, update* skipping deleted docs, $lookup limitation.
import mongoose, { Schema, type Model } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  softDeletePlugin,
  type ISoftDelete,
  type ISoftDeleteMethods,
} from '../src/models/plugins/softDelete';
import { startTestDb } from './helpers';

const ThingSchema = new Schema<
  { n: string } & ISoftDelete,
  Model<{ n: string } & ISoftDelete, object, ISoftDeleteMethods>,
  ISoftDeleteMethods
>({ n: String });
ThingSchema.plugin(softDeletePlugin);
const Thing = mongoose.model('SdThing', ThingSchema) as unknown as Model<
  { n: string } & ISoftDelete,
  object,
  ISoftDeleteMethods
>;
const OtherSchema = new Schema({ thingId: Schema.Types.ObjectId });
const Other = mongoose.model('SdOther', OtherSchema);

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb();
  await mongoose.connect(db.uri);
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});
beforeEach(async () => {
  await Thing.deleteMany({});
  await Other.deleteMany({});
  await Thing.insertMany([{ n: 'live' }, { n: 'dead', deletedAt: new Date() }]);
});

describe('softDelete plugin', () => {
  it('filters find, findOne, count, countDocuments, distinct, aggregate', async () => {
    expect(await Thing.find()).toHaveLength(1);
    expect(await Thing.findOne({ n: 'dead' })).toBeNull();
    expect(await Thing.countDocuments()).toBe(1);
    expect(await Thing.find().countDocuments()).toBe(1);
    expect(await Thing.distinct('n')).toEqual(['live']);
    expect(await Thing.aggregate([{ $count: 'c' }])).toEqual([{ c: 1 }]);
  });

  it('withDeleted shows deleted docs (query and aggregate)', async () => {
    expect(await Thing.find().setOptions({ withDeleted: true })).toHaveLength(2);
    expect(await Thing.countDocuments({}, { withDeleted: true })).toBe(2);
    expect(await Thing.aggregate([{ $count: 'c' }]).option({ withDeleted: true })).toEqual([
      { c: 2 },
    ]);
  });

  it('update* does not touch deleted docs by default', async () => {
    const r = await Thing.updateMany({}, { $set: { n: 'x' } });
    expect(r.modifiedCount).toBe(1);
    expect(await Thing.findOneAndUpdate({ n: 'dead' }, { $set: { n: 'y' } })).toBeNull();
    expect((await Thing.updateOne({ n: 'dead' }, { $set: { n: 'y' } })).matchedCount).toBe(0);
    const dead = await Thing.findOne({ deletedAt: { $ne: null } }).setOptions({
      withDeleted: true,
    });
    expect(dead?.n).toBe('dead');
  });

  it('softDelete()/restore() toggle deletedAt', async () => {
    const live = (await Thing.findOne({ n: 'live' }))!;
    await live.softDelete();
    expect(await Thing.findById(live._id)).toBeNull();
    await live.restore();
    expect(await Thing.findById(live._id)).not.toBeNull();
  });

  it('$lookup is NOT filtered (documented limitation)', async () => {
    const dead = (await Thing.findOne({ n: 'dead' }).setOptions({ withDeleted: true }))!;
    await Other.create({ thingId: dead._id });
    const rows = await Other.aggregate([
      { $lookup: { from: 'sdthings', localField: 'thingId', foreignField: '_id', as: 't' } },
    ]);
    expect(rows[0].t).toHaveLength(1);
  });
});
