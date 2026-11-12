// Created by Haihs on 12/11/2026
// Exam sitting: a COPY of the template questions plus schedule, classes and code; owner = createdBy. Port of server/models/ExamSitting.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { examCache } from '../lib/examCache';
import { computeScoring } from '../lib/examValidation';
import { LIMITS } from '../lib/textUtils';
import { QuestionSchema } from './schemas/question';

export interface IExamSitting {
  createdBy: Types.ObjectId;
  templateId: Types.ObjectId | null;
  templateTitle: string;
  title: string;
  description: string;
  totalQuestions: number;
  questions: Record<string, unknown>[];
  scoring: { mcqMax: number; essayMax: number };
  classIds: Types.ObjectId[];
  openAt: Date;
  closeAt: Date;
  durationMinutes: number;
  shuffleQuestions: boolean;
  antiCheat: boolean;
  code: string;
  resultsPublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSittingSchema = new Schema<IExamSitting>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    templateId: { type: Schema.Types.ObjectId, default: null },
    templateTitle: { type: String, default: '' },
    title: {
      type: String,
      required: [true, 'Tên ca thi là bắt buộc'],
      trim: true,
      maxlength: [LIMITS.TITLE_MAX, `Tên ca thi tối đa ${LIMITS.TITLE_MAX} ký tự.`], // NOT unique in the DB (per teacher in the use case)
    },
    description: {
      type: String,
      default: '',
      maxlength: [LIMITS.DESCRIPTION_MAX, `Mô tả tối đa ${LIMITS.DESCRIPTION_MAX} ký tự.`],
    },
    totalQuestions: { type: Number, default: 0 },
    questions: [QuestionSchema],
    scoring: {
      mcqMax: { type: Number, default: 10 },
      essayMax: { type: Number, default: 0 },
    },
    classIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 1,
        message: 'Ca thi phải được gán ít nhất một lớp',
      },
    },
    openAt: { type: Date, required: [true, 'Giờ mở ca là bắt buộc'] },
    closeAt: {
      type: Date,
      required: [true, 'Giờ đóng ca là bắt buộc'],
      validate: {
        validator(this: unknown, value: Date) {
          const openAt = (this as { openAt?: Date }).openAt;
          if (!openAt || !value) return true; // a query update has no openAt: skip
          return value > openAt;
        },
        message: 'Giờ đóng ca phải sau giờ mở ca',
      },
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Thời gian làm bài là bắt buộc'],
      min: [1, 'Thời gian làm bài tối thiểu là 1 phút'],
      validate: { validator: Number.isInteger, message: 'Thời gian làm bài phải là số nguyên' },
    },
    shuffleQuestions: { type: Boolean, default: false },
    antiCheat: { type: Boolean, default: false },
    code: { type: String, required: true },
    resultsPublishedAt: { type: Date, default: null }, // null = not published / withdrawn
  },
  { timestamps: true },
);

ExamSittingSchema.pre('save', function deriveTotals() {
  this.totalQuestions = Array.isArray(this.questions) ? this.questions.length : 0;
  const { mcqMax, essayMax } = computeScoring(this.questions as unknown[]);
  this.scoring = { mcqMax, essayMax };
});

// Any write clears the in-RAM sitting cache.
const invalidate = () => examCache.clear();
ExamSittingSchema.post('save', invalidate);
ExamSittingSchema.post('insertMany', invalidate);
ExamSittingSchema.post(['updateOne', 'deleteOne'], { document: true, query: true }, invalidate);
ExamSittingSchema.post(
  [
    'updateMany',
    'deleteMany',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'replaceOne',
  ],
  invalidate,
);
ExamSittingSchema.post('bulkWrite', invalidate); // e.g. a code change

ExamSittingSchema.index({ code: 1 }, { unique: true });
ExamSittingSchema.index({ createdBy: 1, createdAt: -1 });
ExamSittingSchema.index({ createdBy: 1, classIds: 1 });
ExamSittingSchema.index({ templateId: 1 });

export const ExamSittingModel: Model<IExamSitting> =
  (mongoose.models.ExamSitting as Model<IExamSitting> | undefined) ??
  mongoose.model<IExamSitting>('ExamSitting', ExamSittingSchema);
