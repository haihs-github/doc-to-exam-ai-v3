// Created by Haihs on 12/11/2026
// Original photo/PDF of a student's essay: one Mongo document per file (no GridFS), TTL by expiresAt, re-read by the teacher when grading. Port of server/models/EssayMedia.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface IEssayMedia {
  data: Buffer;
  mime: string;
  size: number;
  fileName: string;
  sittingId: Types.ObjectId;
  questionId: number;
  submissionId: Types.ObjectId | null;
  attached: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const EssayMediaSchema = new Schema<IEssayMedia>({
  data: { type: Buffer, required: true },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  fileName: { type: String, default: '' },
  sittingId: { type: Schema.Types.ObjectId, ref: 'ExamSitting', required: true },
  questionId: { type: Number, required: true },
  submissionId: { type: Schema.Types.ObjectId, ref: 'SittingSubmission', default: null },
  attached: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
EssayMediaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EssayMediaSchema.index({ submissionId: 1, questionId: 1 });
EssayMediaSchema.index({ attached: 1, createdAt: 1, sittingId: 1, questionId: 1, _id: 1 });

export const EssayMediaModel: Model<IEssayMedia> =
  (mongoose.models.EssayMedia as Model<IEssayMedia> | undefined) ??
  mongoose.model<IEssayMedia>('EssayMedia', EssayMediaSchema);
