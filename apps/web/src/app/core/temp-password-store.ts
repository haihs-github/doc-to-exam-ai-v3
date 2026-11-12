// Created by Haihs on 12/11/2026
// In-memory (never Web Storage) store of one-time temporary passwords per class; cleared on logout.
import { Injectable, effect, inject } from '@angular/core';
import type { ImportResultRow } from '@doc-to-exam/contract';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TempPasswordStore {
  private readonly byClass = new Map<string, Map<string, ImportResultRow>>(); // classId -> phone -> row

  constructor() {
    const auth = inject(AuthService);
    effect(() => {
      if (auth.user() === null) this.clearAll();
    });
  }

  /** Merge rows that carry a temporary password (by phone); call as soon as the server answers. */
  set(classId: string, rows: ImportResultRow[]): void {
    const byPhone = this.byClass.get(classId) ?? new Map<string, ImportResultRow>();
    for (const r of rows) if (r.temporaryPassword) byPhone.set(r.phoneNumber, r);
    if (byPhone.size) this.byClass.set(classId, byPhone);
  }

  get(classId: string): ImportResultRow[] | null {
    const m = this.byClass.get(classId);
    return m ? [...m.values()] : null;
  }

  clear(classId: string): void {
    this.byClass.delete(classId);
  }

  clearAll(): void {
    this.byClass.clear();
  }
}
