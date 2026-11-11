// Created by Haihs on 12/11/2026
// Class membership (teacher or student) with pending/approved status. Port of server/models/ClassMember.js; leave/remove/reject = delete the row.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface IClassMember {
  classId: Types.ObjectId;
  userId: Types.ObjectId;
  memberRole: string;
  status: 'pending' | 'approved';
  source: 'creator' | 'invite' | 'member_add' | 'csv';
  addedBy: Types.ObjectId | null;
  requestedAt: Date;
  approvedAt: Date | null;
  approvedBy: Types.ObjectId | null;
}

const ClassMemberSchema = new Schema<IClassMember>({
  classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // Role name, no hard enum (a new role only needs a `roles` row); must match user.role at creation.
  memberRole: { type: String, required: true, trim: true, match: /^[a-z_]+$/ },
  status: { type: String, enum: ['pending', 'approved'], required: true },
  source: { type: String, enum: ['creator', 'invite', 'member_add', 'csv'], required: true },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
});

ClassMemberSchema.index({ classId: 1, userId: 1 }, { unique: true }); // repeated join/add is idempotent (catch E11000)
ClassMemberSchema.index({ classId: 1, memberRole: 1, status: 1, requestedAt: 1 }); // lists, counts, queue, updateMany
ClassMemberSchema.index({ userId: 1, status: 1 }); // my classes

export const ClassMemberModel: Model<IClassMember> =
  (mongoose.models.ClassMember as Model<IClassMember> | undefined) ??
  mongoose.model<IClassMember>('ClassMember', ClassMemberSchema);
