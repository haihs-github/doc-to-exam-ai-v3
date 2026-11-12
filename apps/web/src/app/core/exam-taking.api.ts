// Created by Haihs on 12/11/2026
// Typed client for /api/me/sittings (student side).
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
}
