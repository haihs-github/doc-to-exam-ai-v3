// Created by Haihs on 12/11/2026
// Shared Mongoose soft-delete plugin (port of server/models/plugins/softDelete.js): hides deleted docs by default, `withDeleted` bypasses.
import type { HydratedDocument, Schema } from 'mongoose';

export interface ISoftDelete {
  deletedAt: Date | null;
}
export interface ISoftDeleteMethods {
  softDelete(): Promise<unknown>;
  restore(): Promise<unknown>;
}

// Filtered: find, findOne (findById/populate), findOneAndUpdate, updateOne, updateMany, count*, distinct, aggregate.
// shortcut: estimatedDocumentCount uses collection metadata and counts deleted docs (verified by test); use countDocuments when exactness matters.
// NOT filtered: deleteOne/deleteMany/findOneAndDelete/replaceOne, doc.save(), raw driver (Model.collection).
const QUERY_OPS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'countDocuments',
  'distinct',
] as const;

export function softDeletePlugin(schema: Schema): void {
  schema.add({ deletedAt: { type: Date, default: null, index: true } });

  schema.pre(
    [...QUERY_OPS] as never,
    { query: true, document: false },
    function hideDeleted(this: {
      getOptions(): { withDeleted?: boolean };
      where(f: object): unknown;
    }) {
      if (this.getOptions().withDeleted) return;
      this.where({ deletedAt: null });
    },
  );

  schema.pre('aggregate', function hideDeletedInAggregate() {
    const opts = this.options as { withDeleted?: boolean };
    const { withDeleted } = opts;
    delete opts.withDeleted; // do not send an unknown option to the driver
    if (withDeleted) return;
    // shortcut: $lookup targets are not filtered (callers add their own $match deletedAt:null); upgrade if a lookup into a soft-deleted collection appears
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.methods.softDelete = function softDelete(this: HydratedDocument<ISoftDelete>) {
    return (this.constructor as import('mongoose').Model<ISoftDelete>).updateOne(
      { _id: this._id },
      { $set: { deletedAt: new Date() } },
    );
  };
  schema.methods.restore = function restore(this: HydratedDocument<ISoftDelete>) {
    return (this.constructor as import('mongoose').Model<ISoftDelete>)
      .updateOne({ _id: this._id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } })
      .setOptions({ withDeleted: true });
  };
}
