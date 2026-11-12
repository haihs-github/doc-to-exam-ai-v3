// Created by Haihs on 12/11/2026
// Shared DTO/body types for exam templates and their questions (M3).

export type QuestionType = 'mcq' | 'essay';
export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface RubricItem {
  key: string;
  label: string;
  max: number;
}

export interface QuestionDto {
  id: number;
  type?: QuestionType; // missing = 'mcq' (old data)
  context: string;
  questionText: string;
  options?: Record<OptionKey, string>;
  correctAnswer?: OptionKey;
  explanation: string;
  requirements?: string;
  rubric?: RubricItem[];
  maxScore?: number;
  /** Set by the AI parser when the type could not be told; the server refuses to save while the data is still incomplete. */
  needsReview?: boolean;
}

export interface Scoring {
  mcqMax: number;
  essayMax: number;
}

export interface TemplateSummary {
  id: string;
  title: string;
  description: string;
  totalQuestions: number;
  scoring: Scoring;
  createdAt: string;
  updatedAt: string;
  sittingCount: number;
  /** Trash view only. */
  deletedAt?: string;
  purgeAt?: string;
  daysLeft?: number;
}

export interface TemplateDetail extends TemplateSummary {
  questions: QuestionDto[];
}

export interface TemplateBody {
  title: string;
  description?: string;
  questions: QuestionDto[];
}

/** POST /api/templates/parse result (nothing is saved). */
export interface ParsedExam {
  questions: QuestionDto[];
  totalQuestions: number;
  skippedQuestions: number;
  needsReviewQuestions: number;
  model?: string;
}
