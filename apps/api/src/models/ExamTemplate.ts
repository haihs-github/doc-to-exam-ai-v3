// Created by Haihs on 12/11/2026
// Teacher's exam template (questions, no schedule). Name unique per owner among live templates; trash with TTL purge. Port of server/models/ExamTemplate.js.
import mongoose, { Schema, type Model, type Types } from 'mongoose';
import { computeScoring } from '../lib/examValidation';
import { LIMITS, normalizeString } from '../lib/textUtils';
import { QuestionSchema } from './schemas/question';
import { softDeletePlugin, type ISoftDelete } from './plugins/softDelete';

export interface IExamTemplate extends ISoftDelete {
  createdBy: Types.ObjectId;
  title: string;
  titleKey: string;
  activeTitleKey?: string;
  purgeAt: Date | null;
  description: string;
  totalQuestions: number;
  questions: Record<string, unknown>[];
  scoring: { mcqMax: number; essayMax: number };
  createdAt: Date;
  updatedAt: Date;
}
type Res = ReturnType<Model<IExamTemplate>['updateOne']>;
type ExamTemplateModelType = Model<IExamTemplate> & {
  /** ONE atomic update of {_id, createdBy, live}: not found / not owner / already deleted match nothing. */
  softDeleteOwned(id: Types.ObjectId, createdBy: Types.ObjectId, now?: Date): Res;
  /** ONE atomic restore of a trashed template (before purgeAt); optional new title. A taken title throws E11000. */
  restoreOwned(
    id: Types.ObjectId,
    createdBy: Types.ObjectId,
    opts?: { title?: string; now?: Date },
  ): Res;
};

const ExamTemplateSchema = new Schema<IExamTemplate, ExamTemplateModelType>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: {
      type: String,
      required: [true, 'Tên đề mẫu là bắt buộc'],
      trim: true,
      maxlength: [LIMITS.TITLE_MAX, `Tên đề mẫu tối đa ${LIMITS.TITLE_MAX} ký tự.`],
    },
    titleKey: { type: String, required: true },
    // Name lock of LIVE templates only (dropped on soft delete) so a trashed template does not hold the name.
    activeTitleKey: { type: String },
    purgeAt: { type: Date, default: null }, // deletedAt + trash days; null while live
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
  },
  { timestamps: true },
);
ExamTemplateSchema.plugin(softDeletePlugin);

ExamTemplateSchema.pre('validate', function deriveKeys() {
  if (this.title) this.titleKey = normalizeString(this.title);
  this.activeTitleKey = this.deletedAt ? undefined : this.titleKey;
});
ExamTemplateSchema.pre('save', function deriveTotals() {
  this.totalQuestions = Array.isArray(this.questions) ? this.questions.length : 0;
  const { mcqMax, essayMax } = computeScoring(this.questions as unknown[]);
  this.scoring = { mcqMax, essayMax };
});

ExamTemplateSchema.index({ createdBy: 1, createdAt: -1 });
ExamTemplateSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 }); // Mongo's TTL monitor lags by minutes: the trash view also filters purgeAt > now
ExamTemplateSchema.index(
  { createdBy: 1, activeTitleKey: 1 },
  { unique: true, partialFilterExpression: { activeTitleKey: { $exists: true } } },
);
ExamTemplateSchema.index({ createdBy: 1, deletedAt: 1, createdAt: -1 });

const TRASH_DAYS_DEFAULT = 30;
const TRASH_DAYS_MAX = 3650; // keeps purgeAt a valid date
const DAY_MS = 24 * 60 * 60 * 1000;
const trashDays = (): number => {
  const n = Number(process.env.TEMPLATE_TRASH_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, TRASH_DAYS_MAX) : TRASH_DAYS_DEFAULT;
};

ExamTemplateSchema.statics.softDeleteOwned = function softDeleteOwned(
  this: Model<IExamTemplate>,
  id: Types.ObjectId,
  createdBy: Types.ObjectId,
  now = new Date(),
) {
  const purgeAt = new Date(now.getTime() + trashDays() * DAY_MS);
  return this.updateOne(
    { _id: id, createdBy },
    [{ $set: { deletedAt: now, purgeAt } }, { $unset: 'activeTitleKey' }],
    { timestamps: false, updatePipeline: true },
  );
};

ExamTemplateSchema.statics.restoreOwned = function restoreOwned(
  this: Model<IExamTemplate>,
  id: Types.ObjectId,
  createdBy: Types.ObjectId,
  { title, now = new Date() }: { title?: string; now?: Date } = {},
) {
  const newTitle = typeof title === 'string' ? title.trim() : '';
  // $literal: a title starting with `$` would otherwise be read as a field path
  const rename = newTitle
    ? { title: { $literal: newTitle }, titleKey: { $literal: normalizeString(newTitle) } }
    : {};
  return this.updateOne(
    { _id: id, createdBy, deletedAt: { $ne: null }, purgeAt: { $gt: now } },
    [
      { $set: { deletedAt: null, purgeAt: null, ...rename } },
      { $set: { activeTitleKey: '$titleKey' } },
    ],
    { timestamps: false, updatePipeline: true },
  ).setOptions({ withDeleted: true });
};

export const ExamTemplateModel: ExamTemplateModelType =
  (mongoose.models.ExamTemplate as ExamTemplateModelType | undefined) ??
  mongoose.model<IExamTemplate, ExamTemplateModelType>('ExamTemplate', ExamTemplateSchema);
