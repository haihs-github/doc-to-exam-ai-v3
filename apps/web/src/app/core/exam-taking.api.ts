// Created by Haihs on 12/11/2026
// Typed client for /api/me/sittings (student side).
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  MySittingRow,
  SessionClock,
  SittingInfo,
  StartedExam,
  SubmitBody,
  SubmitResult,
} from '@doc-to-exam/contract';
import { ApiClient } from './api-client';
import type { Paged } from './classes.api';

const enc = encodeURIComponent;
const base = (id: string, tail = ''): string => `/api/me/sittings/${enc(id)}${tail}`;

@Injectable({ providedIn: 'root' })
export class ExamTakingApi {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  list(params: { page?: number; limit?: number } = {}): Observable<Paged<MySittingRow>> {
    return this.api.get('/api/me/sittings', params as Record<string, number>);
  }
  resolve(code: string): Observable<SittingInfo> {
    return this.api.post('/api/me/sittings/resolve', { code });
  }
  info(id: string): Observable<SittingInfo> {
    return this.api.get(base(id));
  }
  start(id: string): Observable<StartedExam> {
    return this.api.post(base(id, '/start'));
  }
  session(id: string): Observable<SessionClock> {
    return this.api.get(base(id, '/session'));
  }
  submit(id: string, body: SubmitBody): Observable<SubmitResult> {
    return this.api.post(base(id, '/submit'), body);
  }
  result(id: string): Observable<ResultPayload> {
    return this.api.get(base(id, '/result'));
  }
  /** My own essay photo/PDF after the results are published (blob; the interceptor adds the Bearer token). */
  resultMedia(id: string, questionId: number): Observable<Blob> {
    return this.http.get(base(id, `/result/essay/${questionId}/media`), { responseType: 'blob' });
  }
  /** One essay file of a running session: X-Upload-Token (session) + the Bearer token the interceptor adds. */
  uploadEssay(uploadToken: string, questionId: number, file: File): Observable<UploadedEssay> {
    const form = new FormData();
    form.append('file', file);
    return this.api.postWithHeaders(`/api/essay-uploads?questionId=${questionId}`, form, {
      'X-Upload-Token': uploadToken,
    });
  }
}

export interface ResultPayload {
  sitting: {
    id: string;
    title: string;
    openAt: string;
    closeAt: string;
    resultsPublishedAt: string | null;
  };
  submission: { submittedAt: string; reviewing: boolean };
  summary: {
    score: number;
    maxScore: number;
    mcqScore: number;
    mcqMax: number;
    essayScore: number;
    essayMax: number;
  };
}
export interface UploadedEssay {
  uploadId: string;
  questionId: number;
  kind: 'text' | 'media';
  fileName: string;
  mime: string;
  size?: number;
  extractedChars?: number;
}
