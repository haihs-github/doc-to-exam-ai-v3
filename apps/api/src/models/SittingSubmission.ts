// Created by Haihs on 12/11/2026
// A submitted attempt (studentId + class snapshot, no name); unique {sittingId, studentId}. Port of server/models/SittingSubmission.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';

export interface IEssayAnswer {
  questionId: number;
  text: string;
  source: 'text' | 'file-text' | 'file-media';
  fileName: string;
  fileMime: string;
  extractedChars: number;
  mediaRef: Types.ObjectId | null;
}
export interface IEssayResult {
  questionId: number;
  criteria: { key: string; score: number; comment: string }[];
  total: number;
  feedback: string;
  gradedAt: Date | null;
  source: 'teacher';
  teacherOverride: boolean;
}
export interface ISittingSubmission {
  sittingId: Types.ObjectId;
  studentId: Types.ObjectId;
  classIds: Types.ObjectId[];
  answers: Map<string, string>;
  score: number;
  mcqScore?: number;
  essayScore: number;
  maxScore: number;
  essayAnswers: IEssayAnswer[];
  essayResults: IEssayResult[];
  gradingStatus: 'none' | 'pending' | 'done';
  essayStale: boolean;
  byTeacher: boolean;
  essayStaleAt: Date | null;
  correctCount: number;
  totalQuestions: number;
  startedAt: Date | null;
  timeSpentSeconds: number;
  isAutoSubmitted: boolean;
  questionOrder: number[];
  optionsOrder: Map<string, string[]>;
  tabViolations: { at: Date; reason: string }[];
  submittedAt: Date;
}

const SittingSubmissionSchema = new Schema<ISittingSubmission>({
  sittingId: { type: Schema.Types.ObjectId, ref: 'ExamSitting', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  classIds: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
  answers: { type: Map, of: String, default: {} }, // {"1": "A", ...}: key = the stable question id
  score: { type: Number, default: 0 },
  mcqScore: { type: Number, default: undefined },
  essayScore: { type: Number, default: 0 },
  maxScore: { type: Number, default: 10 },
  essayAnswers: {
    type: [
      new Schema(
        {
          questionId: { type: Number, required: true },
          text: { type: String, default: '' },
          source: { type: String, enum: ['text', 'file-text', 'file-media'], default: 'text' },
          fileName: { type: String, default: '' },
          fileMime: { type: String, default: '' },
          extractedChars: { type: Number, default: 0 },
          mediaRef: { type: Schema.Types.ObjectId, ref: 'EssayMedia', default: null },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  essayResults: {
    type: [
      new Schema(
        {
          questionId: { type: Number, required: true },
          criteria: {
            type: [
              new Schema(
                {
                  key: { type: String, required: true },
                  score: { type: Number, default: 0 },
                  comment: { type: String, default: '' },
                },
                { _id: false },
              ),
            ],
            default: [],
          },
          total: { type: Number, default: 0 },
          feedback: { type: String, default: '' },
          gradedAt: { type: Date, default: null },
          source: { type: String, enum: ['teacher'], default: 'teacher' },
          teacherOverride: { type: Boolean, default: false },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  // none = no essay, pending = waiting for the teacher, done = every essay graded
  gradingStatus: { type: String, enum: ['none', 'pending', 'done'], default: 'none' },
  essayStale: { type: Boolean, default: false },
  byTeacher: { type: Boolean, default: false }, // the owner tried the sitting: hidden from results/stats/lock by default
  essayStaleAt: { type: Date, default: null },
  correctCount: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  timeSpentSeconds: { type: Number, default: 0, min: 0 },
  isAutoSubmitted: { type: Boolean, default: false },
  questionOrder: { type: [Number], default: [] },
  optionsOrder: { type: Map, of: [String], default: {} },
  tabViolations: {
    type: [{ at: { type: Date, required: true }, reason: { type: String, required: true } }],
    default: [],
  },
  submittedAt: { type: Date, default: Date.now },
});
SittingSubmissionSchema.index({ sittingId: 1, studentId: 1 }, { unique: true });
SittingSubmissionSchema.index({ studentId: 1, submittedAt: -1 });
SittingSubmissionSchema.index({ sittingId: 1, classIds: 1 });
SittingSubmissionSchema.index({ 'essayAnswers.mediaRef': 1 });

export const SittingSubmissionModel: Model<ISittingSubmission> =
  (mongoose.models.SittingSubmission as Model<ISittingSubmission> | undefined) ??
  mongoose.model<ISittingSubmission>('SittingSubmission', SittingSubmissionSchema);
