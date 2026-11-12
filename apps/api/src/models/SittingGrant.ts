// Created by Haihs on 12/11/2026
// Right of one student to enter a sitting (own collection, no name snapshot); unique {sittingId, studentId}. Port of server/models/SittingGrant.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ISittingGrant {
  sittingId: Types.ObjectId;
  studentId: Types.ObjectId;
  classIds: Types.ObjectId[];
  grantedBy: Types.ObjectId;
  grantedAt: Date;
}

const SittingGrantSchema = new Schema<ISittingGrant>({
  sittingId: { type: Schema.Types.ObjectId, ref: 'ExamSitting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  classIds: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
  grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  grantedAt: { type: Date, default: Date.now },
});
SittingGrantSchema.index({ sittingId: 1, studentId: 1 }, { unique: true });
SittingGrantSchema.index({ studentId: 1, grantedAt: -1 });

export const SittingGrantModel: Model<ISittingGrant> =
  (mongoose.models.SittingGrant as Model<ISittingGrant> | undefined) ??
  mongoose.model<ISittingGrant>('SittingGrant', SittingGrantSchema);
