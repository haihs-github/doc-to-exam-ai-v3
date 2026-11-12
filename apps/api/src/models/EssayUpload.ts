// Created by Haihs on 12/11/2026
// Draft upload of a student's essay (extracted text or a reference to EssayMedia), tied to a session; /submit sends only the uploadId. Port of server/models/EssayUpload.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface IEssayUpload {
  uploadId: string;
  sittingId: Types.ObjectId;
  studentId: Types.ObjectId;
  sessionId: Types.ObjectId;
  questionId: number;
  kind: 'text' | 'media';
  text: string;
  fileName: string;
  mime: string;
  extractedChars: number;
  mediaId: Types.ObjectId | null;
  mediaSize: number;
  submissionId: Types.ObjectId | null;
  createdAt: Date;
  expiresAt: Date;
}

const EssayUploadSchema = new Schema<IEssayUpload>({
  uploadId: { type: String, required: true, unique: true },
  sittingId: { type: Schema.Types.ObjectId, ref: 'ExamSitting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'SittingSession', required: true },
  questionId: { type: Number, required: true },
  kind: { type: String, enum: ['text', 'media'], required: true },
  text: { type: String, default: '' },
  fileName: { type: String, default: '' },
  mime: { type: String, default: '' },
  extractedChars: { type: Number, default: 0 },
  mediaId: { type: Schema.Types.ObjectId, ref: 'EssayMedia', default: null },
  mediaSize: { type: Number, default: 0 },
  submissionId: { type: Schema.Types.ObjectId, ref: 'SittingSubmission', default: null },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
EssayUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EssayUploadSchema.index({ sessionId: 1, questionId: 1 }, { unique: true }); // one upload per (session, question): a re-upload overwrites
EssayUploadSchema.index({ submissionId: 1, questionId: 1 });
EssayUploadSchema.index({ kind: 1 });

export const EssayUploadModel: Model<IEssayUpload> =
  (mongoose.models.EssayUpload as Model<IEssayUpload> | undefined) ??
  mongoose.model<IEssayUpload>('EssayUpload', EssayUploadSchema);
