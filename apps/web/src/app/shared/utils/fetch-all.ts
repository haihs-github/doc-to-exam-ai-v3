// Created by Haihs on 12/11/2026
// Reads every page of a paged endpoint (page 1..totalPages, capped). Source: fetchAllPages in client/src/services/api.js.
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import type { Paged } from '../../core/classes.api';

export function fetchAll<T>(
  page: (n: number) => Observable<Paged<T>>,
  maxPages = 20,
): Observable<T[]> {
  return page(1).pipe(
    expand((r) => (r.page < r.totalPages && r.page < maxPages ? page(r.page + 1) : EMPTY)),
    map((r) => r.items),
    reduce((all, items) => all.concat(items), [] as T[]),
  );
}
