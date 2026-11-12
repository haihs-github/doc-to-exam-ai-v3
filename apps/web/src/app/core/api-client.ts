// Created by Haihs on 11/11/2026
// Typed HTTP client: unwraps ApiOk.data and throws contract ApiError objects (decision D10).
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiError, isApiError } from '@doc-to-exam/contract';

/**
 * ApiError plus transport info for the retry util and errorMessage:
 * status 0 = network failure (no response), retryAfter = raw Retry-After header.
 */
export type ApiFailure = ApiError & { status: number; retryAfter?: string | null };

const GENERIC = 'Có lỗi xảy ra. Vui lòng thử lại!';
const internal = (status: number, retryAfter?: string | null): ApiFailure => ({
  success: false, code: 'INTERNAL', message: GENERIC, status, retryAfter,
});

type Params = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Params): Observable<T> {
    return this.wrap(this.http.get<unknown>(url, { params }));
  }
  post<T>(url: string, body?: unknown): Observable<T> {
    return this.wrap(this.http.post<unknown>(url, body));
  }
  put<T>(url: string, body?: unknown): Observable<T> {
    return this.wrap(this.http.put<unknown>(url, body));
  }
  // Haihs: M2 Task 9 - ClassesApi cần PATCH (sửa lớp, đổi tên học sinh, bật/tắt link mời) - start
  patch<T>(url: string, body?: unknown): Observable<T> {
    return this.wrap(this.http.patch<unknown>(url, body));
  }
  // Haihs: M2 Task 9 - ClassesApi cần PATCH (sửa lớp, đổi tên học sinh, bật/tắt link mời) - end
  delete<T>(url: string): Observable<T> {
    return this.wrap(this.http.delete<unknown>(url));
  }

  private wrap<T>(source: Observable<unknown>): Observable<T> {
    return source.pipe(
      map((body) => {
        const b = body as { success?: unknown; data?: T } | null;
        if (b?.success !== true) throw internal(200);
        return b.data as T;
      }),
      catchError((e: unknown) => {
        if (!(e instanceof HttpErrorResponse)) return throwError(() => e); // already an ApiFailure from map
        const retryAfter = e.headers.get('Retry-After');
        const failure: ApiFailure = isApiError(e.error)
          ? { ...e.error, status: e.status, retryAfter }
          : internal(e.status, retryAfter);
        return throwError(() => failure);
      }),
    );
  }
}
