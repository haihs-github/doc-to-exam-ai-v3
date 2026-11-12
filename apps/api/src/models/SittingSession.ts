// Created by Haihs on 12/11/2026
// A student's running attempt in a sitting (the server holds the clock); deleted after submit; unique {sittingId, studentId}. Port of server/models/SittingSession.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface ISittingSession {
  sittingId: Types.ObjectId;
  studentId: Types.ObjectId;
  startedAt: Date;
  deadlineAt: Date;
  questionOrder: number[];
  optionsOrder: Map<string, string[]>;
  uploadToken: string;
  expiresAt: Date;
}
interface SessionMethods {
  getRemainingSeconds(now?: Date): number;
}

const SittingSessionSchema = new Schema<
  ISittingSession,
  Model<ISittingSession, object, SessionMethods>,
  SessionMethods
>({
  sittingId: { type: Schema.Types.ObjectId, ref: 'ExamSitting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startedAt: { type: Date, required: true, default: Date.now },
  deadlineAt: { type: Date, required: true },
  questionOrder: { type: [Number], default: [] },
  optionsOrder: { type: Map, of: [String], default: {} },
  uploadToken: { type: String, default: '' }, // only when the sitting has essay questions
  expiresAt: { type: Date, required: true }, // deadlineAt + 30 days (TTL)
});
SittingSessionSchema.index({ sittingId: 1, studentId: 1 }, { unique: true });
SittingSessionSchema.index({ uploadToken: 1 });
SittingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Seconds left (never negative). */
SittingSessionSchema.methods.getRemainingSeconds = function getRemainingSeconds(
  this: ISittingSession,
  now = new Date(),
) {
  return Math.max(0, Math.floor((this.deadlineAt.getTime() - now.getTime()) / 1000));
};

export const SittingSessionModel: Model<ISittingSession, object, SessionMethods> =
  (mongoose.models.SittingSession as Model<ISittingSession, object, SessionMethods> | undefined) ??
  mongoose.model<ISittingSession, Model<ISittingSession, object, SessionMethods>>(
    'SittingSession',
    SittingSessionSchema,
  );
