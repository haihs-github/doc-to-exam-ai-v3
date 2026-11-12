// Created by Haihs on 12/11/2026
// Typed client for /api/sittings (teacher side) (port of the sittings group in client/src/services/api.js).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CandidateDto,
  GrantRow,
  SittingCreateBody,
  SittingCreated,
  SittingDetail,
  SittingStatus,
  SittingSummary,
} from '@doc-to-exam/contract';
import { ApiClient } from './api-client';
import type { Paged } from './classes.api';

const enc = encodeURIComponent;
const query = (p: object = {}): Record<string, string | number> =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)) as Record<
    string,
    string | number
  >;
const sit = (id: string, tail = ''): string => `/api/sittings/${enc(id)}${tail}`;

export interface SittingUpdateBody {
  title?: string;
  description?: string;
  openAt?: string;
  closeAt?: string;
  durationMinutes?: number;
  shuffleQuestions?: boolean;
  antiCheat?: boolean;
  questions?: unknown[];
}

@Injectable({ providedIn: 'root' })
export class SittingsApi {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  list(params?: {
    classId?: string;
    status?: SittingStatus;
    page?: number;
    limit?: number;
  }): Observable<Paged<SittingSummary>> {
    return this.api.get('/api/sittings', query(params));
  }
  candidates(
    classIds: string[],
    params?: { q?: string; page?: number; limit?: number },
  ): Observable<Paged<CandidateDto>> {
    return this.api.get(
      '/api/sittings/candidates',
      query({ classIds: classIds.join(','), ...params }),
    );
  }
  create(body: SittingCreateBody): Observable<SittingCreated> {
    return this.api.post('/api/sittings', body);
  }
  get(id: string): Observable<SittingDetail> {
    return this.api.get(sit(id));
  }
  update(id: string, body: SittingUpdateBody): Observable<SittingDetail> {
    return this.api.put(sit(id), body);
  }
  delete(id: string): Observable<unknown> {
    return this.api.delete(sit(id));
  }
  regenerateCode(id: string): Observable<{ code: string; link: string }> {
    return this.api.post(sit(id, '/regenerate-code'));
  }
  setClasses(
    id: string,
    classIds: string[],
  ): Observable<{
    classIds: string[];
    addedClassIds: string[];
    removedGrants: number;
    removedSessions: number;
  }> {
    return this.api.put(sit(id, '/classes'), { classIds });
  }
  grants(
    id: string,
    params?: { q?: string; page?: number; limit?: number },
  ): Observable<Paged<GrantRow>> {
    return this.api.get(sit(id, '/grants'), query(params));
  }
  addGrants(
    id: string,
    body: { allInClasses?: boolean; excludeStudentIds?: string[]; studentIds?: string[] },
  ): Observable<{ granted: number; alreadyGranted: number }> {
    return this.api.post(sit(id, '/grants'), body);
  }
  revokeGrants(
    id: string,
    studentIds: string[],
  ): Observable<{ revoked: number; removedSessions: number; skippedSubmitted: number }> {
    return this.api.post(sit(id, '/grants/revoke'), { studentIds });
  }
  // ---- results, grading, publication (M6/M7)
  results(id: string, params: ResultsParams = {}): Observable<ResultsData> {
    return this.api.get(sit(id, '/results'), query(params));
  }
  exportJson(id: string, classId?: string): Observable<unknown> {
    return this.api.get(sit(id, '/results/export'), query({ classId }));
  }
  /** .xlsx download: a blob (the shared client unwraps JSON only). The interceptor adds the Bearer token. */
  exportXlsx(id: string, classId?: string): Observable<Blob> {
    return this.http.get(sit(id, '/results/export.xlsx'), {
      params: query({ classId }),
      responseType: 'blob',
    });
  }
  gradingProgress(id: string): Observable<GradingProgress> {
    return this.api.get(sit(id, '/grading-progress'));
  }
  publication(id: string): Observable<Publication> {
    return this.api.get(sit(id, '/publication'));
  }
  publish(id: string): Observable<{ publishedAt: string; alreadyPublished: boolean }> {
    return this.api.post(sit(id, '/results/publish'));
  }
  unpublish(id: string): Observable<{ publishedAt: null }> {
    return this.api.post(sit(id, '/results/unpublish'));
  }
  gradeEssay(
    id: string,
    submissionId: string,
    questionId: number,
    body: GradeBody,
  ): Observable<unknown> {
    return this.api.put(sit(id, `/submissions/${enc(submissionId)}/essay/${questionId}`), body);
  }
  essayMedia(id: string, submissionId: string, questionId: number): Observable<Blob> {
    return this.http.get(sit(id, `/submissions/${enc(submissionId)}/essay/${questionId}/media`), {
      responseType: 'blob',
    });
  }
  deleteViolation(
    id: string,
    submissionId: string,
    index: number,
    at?: string,
  ): Observable<{ tabViolations: { at: string; reason: string }[] }> {
    return this.api.delete(
      `${sit(id, `/submissions/${enc(submissionId)}/violations/${index}`)}${at ? `?at=${enc(at)}` : ''}`,
    );
  }
}

export interface ResultsParams {
  classId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  dir?: string;
  status?: string;
  includeTeacher?: string;
  notSubmittedPage?: number;
}
export interface EssayResultRow {
  questionId: number;
  criteria: { key: string; score: number; comment: string }[];
  total: number;
  feedback: string;
  gradedAt: string | null;
}
export interface SubmissionRow {
  _id: string;
  studentId: string;
  studentName: string;
  classNames: string[];
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  essayStale: boolean;
  gradingStatus: string;
  hasEssay: boolean;
  essayGraded: boolean;
  essayGradedCount: number;
  essayQuestionCount: number;
  totalScore: number | null;
  gradingLabel: string;
  violationCount: number;
  isAutoSubmitted: boolean;
  byTeacher?: boolean;
  submittedAt: string;
  timeSpentSeconds: number;
  essayResults: EssayResultRow[];
  essayAnswers?: { questionId: number; text: string; source: string; fileName: string }[];
  tabViolations?: { at: string; reason: string }[];
}
export interface ResultsData {
  exam: { id: string; title: string; questions: import('@doc-to-exam/contract').QuestionDto[] };
  classes: { id: string; name: string }[];
  stats: {
    totalSubmissions: number;
    gradedSubmissions: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
  };
  submissions: SubmissionRow[];
  pagination: { page: number; totalPages: number; total: number };
  notSubmitted: {
    studentId: string;
    studentName: string;
    phoneNumber?: string;
    hasSession: boolean;
    inClass: boolean;
  }[];
  notSubmittedPagination: { page: number; totalPages: number; total: number };
}
export interface GradingProgress {
  essaySubmissions: number;
  finished: number;
  pendingManualCount: number;
  staleCount: number;
}
export interface Publication {
  publishedAt: string | null;
  submittedCount: number;
  readyCount: number;
  ungradedCount: number;
  staleCount: number;
  notSubmittedCount: number;
  hiddenCount: number;
  canPublish: boolean;
  leak: { otherOpenSittings: number; items: { id: string; title: string; status: string }[] };
}
export interface GradeBody {
  criteria?: { key: string; score?: number; comment?: string }[];
  feedback?: string;
  baseGradedAt?: string | null;
}
