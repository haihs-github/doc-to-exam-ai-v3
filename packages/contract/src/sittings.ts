// Created by Haihs on 12/11/2026
// Shared DTO/body types for exam sittings, grants and candidates (M4).
import type { QuestionDto, Scoring } from './templates';

export type SittingStatus = 'not_started' | 'open' | 'ended';
export type TemplateStatus = 'active' | 'deleted' | 'purged';

export interface SittingSummary {
  id: string;
  title: string;
  description: string;
  templateId: string | null;
  templateTitle: string;
  classIds: string[];
  openAt: string;
  closeAt: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  antiCheat: boolean;
  code: string;
  link: string; // '/ca/<code>'
  totalQuestions: number;
  scoring: Scoring;
  status: SittingStatus;
  resultsPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** List only. */
  grantedCount?: number;
  submittedCount?: number;
}

export interface SittingClassRef {
  id: string;
  name: string;
  status: 'active' | 'graduated' | null;
  deleted: boolean;
}

export interface SittingDetail extends SittingSummary {
  questions: QuestionDto[];
  templateStatus: TemplateStatus;
  locked: boolean;
  lockReason: 'HAS_SUBMISSIONS' | 'ACTIVE_SESSIONS' | null;
  activeSessionCount: number;
  ungrantedInClassCount: number;
  classes: SittingClassRef[];
  /** PUT only. */
  affectedSessions?: number;
  updatedSubmissionsCount?: number;
}

export interface SittingCreateBody {
  templateId: string;
  title?: string;
  description?: string;
  openAt: string;
  closeAt: string;
  durationMinutes: number;
  shuffleQuestions?: boolean;
  antiCheat?: boolean;
  classIds: string[];
  /** Either every approved student of the classes except `excludeStudentIds`, or exactly `studentIds`. */
  allInClasses?: boolean;
  excludeStudentIds?: string[];
  studentIds?: string[];
}

export interface SittingCreated {
  id: string;
  code: string;
  link: string;
}

export interface CandidateDto {
  id: string;
  fullName: string;
  classIds: string[];
}

export interface GrantRow {
  studentId: string;
  fullName: string;
  classIds: string[];
  classNames: string[];
  submitted: boolean;
  hasSession: boolean;
  inClass: boolean;
}
