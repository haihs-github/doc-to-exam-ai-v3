// Created by Haihs on 12/11/2026
// Shared types of the student side: my sittings, resolve/start/session/submit payloads (M5).
import type { OptionKey } from './templates';

export type MyState = 'not_started' | 'open' | 'in_progress' | 'submitted' | 'missed';

export interface SittingInfo {
  id: string;
  code: string;
  title: string;
  description: string;
  openAt: string;
  closeAt: string;
  durationMinutes: number;
  totalQuestions: number;
  shuffleQuestions: boolean;
  antiCheat: boolean;
  status: 'not_started' | 'open' | 'ended';
  myState: MyState;
  submittedAt?: string;
  /** Only when the results are published: "x/y". */
  result?: { score: number; maxScore: number };
  serverTime?: string;
}

export interface MySittingRow {
  id: string;
  code: string;
  title: string;
  openAt: string;
  closeAt: string;
  durationMinutes: number;
  status: 'not_started' | 'open' | 'ended';
  myState: MyState;
  submittedAt?: string;
  result?: { score: number; maxScore: number };
}

/** A question as a student sees it: no correct answer, no explanation, no rubric. */
export interface StudentQuestion {
  id: number;
  type?: 'essay';
  context: string;
  questionText: string;
  requirements?: string;
  maxScore: number;
  options?: Record<OptionKey, string>;
}

export interface StartedExam {
  sittingId: string;
  title: string;
  description: string;
  durationMinutes: number;
  openAt: string;
  closeAt: string;
  totalQuestions: number;
  shuffleQuestions: boolean;
  antiCheat: boolean;
  startedAt: string;
  deadlineAt: string;
  remainingSeconds: number;
  serverTime: string;
  questionOrder: number[];
  /** { [questionId]: ['B','D','A','C'] } display position -> original key. */
  optionsOrder: Record<string, string[]>;
  uploadToken?: string;
  questions: StudentQuestion[];
}

export interface SessionClock {
  deadlineAt: string;
  remainingSeconds: number;
  serverTime: string;
}

export interface TabViolation {
  at: string;
  reason: string;
}

export interface SubmitBody {
  answers: Record<string, string>;
  essayAnswers?: Record<string, string | { text?: string; uploadId?: string }>;
  isAutoSubmit?: boolean;
  tabViolations?: TabViolation[];
}

export interface SubmitResult {
  submittedAt: string;
  warnings?: string[];
}
