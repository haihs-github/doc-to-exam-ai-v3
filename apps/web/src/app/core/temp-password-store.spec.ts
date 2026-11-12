// Created by Haihs on 12/11/2026
// Specs for TempPasswordStore: in-memory only (never Web Storage), per-class, merged by phone, cleared on logout.
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { AuthUser, ImportResultRow } from '@doc-to-exam/contract';
import { AuthService } from './auth.service';
import { TempPasswordStore } from './temp-password-store';

const row = (phone: string, pw?: string): ImportResultRow => ({
  row: 1,
  status: 'created',
  fullName: 'A',
  phoneNumber: phone,
  temporaryPassword: pw,
});

describe('TempPasswordStore', () => {
  const user = signal<AuthUser | null>({ id: 'u' } as AuthUser);
  let store: TempPasswordStore;
  beforeEach(() => {
    user.set({ id: 'u' } as AuthUser);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
    store = TestBed.inject(TempPasswordStore);
  });
  afterEach(() => vi.restoreAllMocks());

  it('set/get/clear, cô lập theo classId, ghi đè theo sdt, bỏ dòng không có mật khẩu', () => {
    expect(store.get('c1')).toBeNull();
    store.set('c1', [row('0911111111', 'p1')]);
    store.set('c1', [row('0922222222', 'p2'), row('0911111111', 'p3'), row('0933333333')]);
    expect(
      store
        .get('c1')!
        .map((r) => r.temporaryPassword)
        .sort(),
    ).toEqual(['p2', 'p3']);
    expect(store.get('c2')).toBeNull();
    store.set('c2', []);
    expect(store.get('c2')).toBeNull();
    store.clear('c1');
    expect(store.get('c1')).toBeNull();
  });

  it('clearAll xóa mọi lớp', () => {
    store.set('c1', [row('0911111111', 'p1')]);
    store.set('c2', [row('0911111111', 'p1')]);
    store.clearAll();
    expect([store.get('c1'), store.get('c2')]).toEqual([null, null]);
  });

  it('không bao giờ chạm Web Storage', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    store.set('c1', [row('0911111111', 'p1')]);
    store.get('c1');
    store.clear('c1');
    store.clearAll();
    TestBed.tick();
    expect(set).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('tự xóa khi người dùng đăng xuất (user() -> null)', () => {
    TestBed.tick();
    store.set('c1', [row('0911111111', 'p1')]);
    TestBed.tick();
    expect(store.get('c1')).not.toBeNull(); // still logged in
    user.set(null);
    TestBed.tick();
    expect(store.get('c1')).toBeNull();
  });
});
