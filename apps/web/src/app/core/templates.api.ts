// Created by Haihs on 12/11/2026
// Typed client for /api/templates (port of the templates group in client/src/services/api.js).
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ParsedExam,
  TemplateBody,
  TemplateDetail,
  TemplateSummary,
} from '@doc-to-exam/contract';
import { ApiClient } from './api-client';
import type { Paged } from './classes.api';

export interface TemplateListParams {
  view?: 'active' | 'deleted';
  q?: string;
  page?: number;
  limit?: number;
}
const enc = encodeURIComponent;
const query = (p: object = {}): Record<string, string | number> =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)) as Record<
    string,
    string | number
  >;

@Injectable({ providedIn: 'root' })
export class TemplatesApi {
  private readonly api = inject(ApiClient);

  list(params?: TemplateListParams): Observable<Paged<TemplateSummary>> {
    return this.api.get('/api/templates', query(params));
  }
  get(id: string): Observable<TemplateDetail> {
    return this.api.get(`/api/templates/${enc(id)}`);
  }
  create(body: TemplateBody): Observable<TemplateSummary> {
    return this.api.post('/api/templates', body);
  }
  update(id: string, body: Partial<TemplateBody>): Observable<TemplateDetail> {
    return this.api.put(`/api/templates/${enc(id)}`, body);
  }
  delete(
    id: string,
  ): Observable<{ sittingCount: number; deletedAt: string; purgeAt: string | null }> {
    return this.api.delete(`/api/templates/${enc(id)}`);
  }
  duplicate(id: string): Observable<TemplateSummary> {
    return this.api.post(`/api/templates/${enc(id)}/duplicate`);
  }
  restore(id: string, body: { title?: string } = {}): Observable<TemplateSummary> {
    return this.api.post(`/api/templates/${enc(id)}/restore`, body);
  }
  purge(id: string): Observable<unknown> {
    return this.api.delete(`/api/templates/${enc(id)}/purge`);
  }
  /** Multipart (field "file"); nothing is saved on the server. */
  parse(file: File): Observable<ParsedExam> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post('/api/templates/parse', form);
  }
}
