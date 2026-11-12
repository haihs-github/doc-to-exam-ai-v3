// Created by Haihs on 12/11/2026
// Typed client for /api/classes and /api/me/classes (port of the classes group in client/src/services/api.js).
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ClassBody,
  ClassDto,
  ClassMemberDto,
  ImportResultRow,
  ImportSummary,
  InviteDto,
  TempPasswordResult,
} from '@doc-to-exam/contract';
import { ApiClient } from './api-client';

export type InviteKind = 'student' | 'teacher';
export type ClassView = 'active' | 'graduated' | 'deleted' | 'all';
export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
export interface ListParams {
  view?: ClassView;
  q?: string;
  page?: number;
  limit?: number;
}
export interface MemberListParams {
  status?: 'approved' | 'pending';
  q?: string;
  page?: number;
  limit?: number;
  studentId?: string;
}
export interface SearchParams {
  q: string;
  page?: number;
  limit?: number;
}
/** Student's view of one class: names only for classmates. */
export type MyClassDetail = ClassDto & { teachers: string[]; classmates: string[] };
export interface ImportResponse {
  summary: ImportSummary;
  results: ImportResultRow[];
}

const enc = encodeURIComponent;
const cls = (id: string, tail = ''): string => `/api/classes/${enc(id)}${tail}`;
// Drop undefined/null so no "undefined" ever reaches the query string.
const query = (p: object = {}): Record<string, string | number> =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)) as Record<
    string,
    string | number
  >;

@Injectable({ providedIn: 'root' })
export class ClassesApi {
  private readonly api = inject(ApiClient);

  // classes
  list(params?: ListParams): Observable<Paged<ClassDto>> {
    return this.api.get('/api/classes', query(params));
  }
  create(body: ClassBody): Observable<ClassDto> {
    return this.api.post('/api/classes', body);
  }
  get(id: string): Observable<ClassDto> {
    return this.api.get(cls(id));
  }
  update(id: string, body: Partial<ClassBody>): Observable<ClassDto> {
    return this.api.patch(cls(id), body);
  }
  delete(id: string): Observable<unknown> {
    return this.api.delete(cls(id));
  }
  restore(id: string, body: { code?: string } = {}): Observable<ClassDto> {
    return this.api.post(cls(id, '/restore'), body);
  }
  join(token: string): Observable<ClassDto> {
    return this.api.post('/api/classes/join', { token });
  }

  // invite
  invite(id: string): Observable<InviteDto> {
    return this.api.get(cls(id, '/invite'));
  }
  rotateInvite(id: string, kind: InviteKind): Observable<InviteDto> {
    return this.api.post(cls(id, `/invite/${enc(kind)}/rotate`));
  }
  setInviteEnabled(id: string, kind: InviteKind, enabled: boolean): Observable<InviteDto> {
    return this.api.patch(cls(id, `/invite/${enc(kind)}`), { enabled });
  }

  // students
  students(id: string, params?: MemberListParams): Observable<Paged<ClassMemberDto>> {
    return this.api.get(cls(id, '/students'), query(params));
  }
  studentSearch(
    id: string,
    params: SearchParams,
  ): Observable<Paged<ClassMemberDto & { alreadyMember?: boolean }>> {
    return this.api.get(cls(id, '/student-search'), query(params));
  }
  addStudent(
    id: string,
    body: { studentId: string } | { phoneNumber: string },
  ): Observable<ClassMemberDto> {
    return this.api.post(cls(id, '/students'), body);
  }
  approveAllStudents(id: string): Observable<unknown> {
    return this.api.post(cls(id, '/students/approve-all'));
  }
  rejectAllStudents(id: string): Observable<unknown> {
    return this.api.post(cls(id, '/students/reject-all'));
  }
  approveStudent(id: string, userId: string): Observable<ClassMemberDto> {
    return this.api.post(cls(id, `/students/${enc(userId)}/approve`));
  }
  removeStudent(id: string, userId: string): Observable<unknown> {
    return this.api.delete(cls(id, `/students/${enc(userId)}`));
  }
  renameStudent(id: string, userId: string, fullName: string): Observable<ClassMemberDto> {
    return this.api.patch(cls(id, `/students/${enc(userId)}`), { fullName });
  }
  resetStudentPassword(id: string, userId: string): Observable<TempPasswordResult> {
    return this.api.post(cls(id, `/students/${enc(userId)}/reset-password`));
  }

  // teachers
  teachers(id: string, params?: { status?: 'approved' | 'pending' }): Observable<ClassMemberDto[]> {
    return this.api.get(cls(id, '/teachers'), query(params));
  }
  teacherSearch(
    id: string,
    params: SearchParams,
  ): Observable<Paged<ClassMemberDto & { alreadyMember?: boolean }>> {
    return this.api.get(cls(id, '/teacher-search'), query(params));
  }
  addTeacher(
    id: string,
    body: { teacherId: string } | { phoneNumber: string },
  ): Observable<ClassMemberDto> {
    return this.api.post(cls(id, '/teachers'), body);
  }
  approveTeacher(id: string, userId: string): Observable<ClassMemberDto> {
    return this.api.post(cls(id, `/teachers/${enc(userId)}/approve`));
  }
  removeTeacher(id: string, userId: string): Observable<unknown> {
    return this.api.delete(cls(id, `/teachers/${enc(userId)}`));
  }

  /** Multipart: the browser sets the boundary, so no Content-Type header (field name "file" per server). */
  import(classId: string, file: File): Observable<ImportResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post(cls(classId, '/import'), form);
  }

  // student side
  myClasses(): Observable<ClassDto[]> {
    return this.api.get('/api/me/classes');
  }
  myClass(classId: string): Observable<MyClassDetail> {
    return this.api.get(`/api/me/classes/${enc(classId)}`);
  }
  /** Leave a class or cancel a pending request (same endpoint). */
  leaveMyClass(classId: string): Observable<unknown> {
    return this.api.delete(`/api/me/classes/${enc(classId)}`);
  }
}
