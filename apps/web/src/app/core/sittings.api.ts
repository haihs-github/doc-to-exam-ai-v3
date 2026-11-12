// Created by Haihs on 12/11/2026
// Typed client for /api/sittings (teacher side) (port of the sittings group in client/src/services/api.js).
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
}
