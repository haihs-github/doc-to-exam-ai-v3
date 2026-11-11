// Created by Haihs on 12/11/2026
// Specs for <app-teacher-classes>: load/empty/error states, tabs, debounced search with latest-wins, paging, create/edit/delete/restore.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import type { ClassDto } from '@doc-to-exam/contract';
import { ClassesApi, Paged } from '../core/classes.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { TeacherClasses } from './teacher-classes';

const mkClass = (id: string, over: Partial<ClassDto> = {}): ClassDto => ({
  id,
  name: `LỚP ${id}`,
  code: `C${id}`,
  startYear: 2023,
  endYear: 2026,
  status: 'active',
  studentCount: 5,
  teacherCount: 1,
  ...over,
});
const paged = (items: ClassDto[], over: Partial<Paged<ClassDto>> = {}): Paged<ClassDto> => ({
  items,
  page: 1,
  limit: 10,
  total: items.length,
  totalPages: 1,
  hasMore: false,
  ...over,
});
const apiErr = (code: string, message = 'm') => ({ success: false, code, message });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const setup = async (
  first: Observable<Paged<ClassDto>> = of(paged([mkClass('1'), mkClass('2')])),
) => {
  const api = {
    list: vi.fn().mockReturnValue(first),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ClassesApi, useValue: api }],
  });
  const alert = TestBed.inject(AlertService);
  const success = vi.spyOn(alert, 'success').mockResolvedValue();
  const error = vi.spyOn(alert, 'error').mockResolvedValue();
  const confirm = vi.spyOn(TestBed.inject(ConfirmService), 'confirm').mockResolvedValue(true);
  const f = TestBed.createComponent(TeacherClasses);
  document.body.appendChild(f.nativeElement);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const flush = () => f.whenStable();
  const btn = (text: string) =>
    [...el.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent!.trim() === text)!;
  const search = async (v: string) => {
    const i = el.querySelector<HTMLInputElement>('input[name="q"]')!;
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await flush();
  };
  const menuAction = async (rowIndex: number, label: string) => {
    el.querySelectorAll<HTMLElement>('app-action-menu button[aria-haspopup]')[rowIndex].click();
    await flush();
    [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((m) => m.textContent!.trim() === label)!
      .click();
    await flush();
  };
  return { f, el, api, success, error, confirm, flush, btn, search, menuAction };
};

describe('TeacherClasses', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows a skeleton while loading, then the rows with link, code, years and count', async () => {
    const pending = new Subject<Paged<ClassDto>>();
    const s = await setup(pending);
    expect(s.el.querySelector('app-skeleton')).not.toBeNull();
    pending.next(paged([mkClass('1')]));
    await s.flush();
    expect(s.el.querySelector('app-skeleton')).toBeNull();
    const link = s.el.querySelector<HTMLAnchorElement>('a[href="/teacher/classes/1"]')!;
    expect(link.textContent).toContain('LỚP 1');
    expect(s.el.textContent).toContain('Mã C1 · 2023-2026 · 5 học sinh');
    expect(s.api.list).toHaveBeenCalledWith({ view: 'active', page: 1, limit: 10, q: undefined });
  });

  it('empty list shows the empty message per tab', async () => {
    const s = await setup(of(paged([])));
    expect(s.el.textContent).toContain('Chưa có lớp nào.');
    s.api.list.mockReturnValue(of(paged([])));
    s.btn('Thùng rác').click();
    await s.flush();
    expect(s.el.textContent).toContain('Không có lớp nào trong thùng rác.');
  });

  it('load error: inline message with Thử lại that reloads; no popup', async () => {
    const s = await setup(throwError(() => new Error('boom')));
    expect(s.el.textContent).toContain('Không tải được danh sách lớp.');
    expect(s.error).not.toHaveBeenCalled();
    s.api.list.mockReturnValue(of(paged([mkClass('1')])));
    s.btn('Thử lại').click();
    await s.flush();
    expect(s.el.textContent).not.toContain('Không tải được danh sách lớp.');
    expect(s.el.textContent).toContain('LỚP 1');
  });

  it('tab switch asks for view=deleted from page 1; deleted rows are not links and offer Khôi phục', async () => {
    const s = await setup();
    s.api.list.mockReturnValue(of(paged([mkClass('9', { deletedAt: '2026-01-01' })])));
    s.btn('Thùng rác').click();
    await s.flush();
    expect(s.api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'deleted', page: 1 }),
    );
    expect(s.el.querySelector('a[href="/teacher/classes/9"]')).toBeNull();
    s.el.querySelector<HTMLElement>('app-action-menu button[aria-haspopup]')!.click();
    await s.flush();
    const items = [...s.el.querySelectorAll('[role="menuitem"]')].map((m) => m.textContent!.trim());
    expect(items).toEqual(['Khôi phục']);
  });

  it('search is debounced: one request with the final text, back on page 1', async () => {
    const s = await setup();
    s.api.list.mockClear();
    await s.search('a');
    await s.search('ab');
    expect(s.api.list).not.toHaveBeenCalled();
    await wait(400);
    await s.flush();
    expect(s.api.list).toHaveBeenCalledTimes(1);
    expect(s.api.list).toHaveBeenCalledWith({ view: 'active', page: 1, limit: 10, q: 'ab' });
  });

  it('latest wins: a slow older search response cannot overwrite the newer one', async () => {
    const s = await setup();
    const a = new Subject<Paged<ClassDto>>();
    const b = new Subject<Paged<ClassDto>>();
    s.api.list.mockReturnValueOnce(a).mockReturnValueOnce(b);
    await s.search('a');
    await wait(400);
    await s.search('ab');
    await wait(400);
    await s.flush();
    expect(s.api.list).toHaveBeenCalledTimes(3);
    b.next(paged([mkClass('B')]));
    await s.flush();
    a.next(paged([mkClass('A')]));
    await s.flush();
    expect(s.el.textContent).toContain('LỚP B');
    expect(s.el.textContent).not.toContain('LỚP A');
  });

  it('latest wins for tabs: a slow response of the previous tab is ignored', async () => {
    const slow = new Subject<Paged<ClassDto>>();
    const s = await setup(slow);
    s.api.list.mockReturnValue(of(paged([mkClass('9', { deletedAt: 'd' })])));
    s.btn('Thùng rác').click();
    await s.flush();
    slow.next(paged([mkClass('ACTIVE')]));
    await s.flush();
    expect(s.el.textContent).toContain('LỚP 9');
    expect(s.el.textContent).not.toContain('LỚP ACTIVE');
  });

  it('create: Tạo lớp opens the form dialog; saved closes it and reloads the active tab', async () => {
    const s = await setup();
    s.btn('Tạo lớp').click();
    await s.flush();
    const form = s.el.querySelector('app-class-form')!;
    expect(form).not.toBeNull();
    s.api.list.mockClear();
    s.api.create.mockReturnValue(of(mkClass('3')));
    const names = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    const set = (n: string, v: string) => {
      const i = form.querySelector<HTMLInputElement>(`input[name="${n}"]`)!;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    set('name', 'x');
    set('code', 'x1');
    set('startYear', '2024');
    set('endYear', '2025');
    expect(names).toBeTruthy();
    form.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await s.flush();
    expect(s.api.create).toHaveBeenCalledTimes(1);
    expect(s.el.querySelector('app-class-form')).toBeNull();
    expect(s.api.list).toHaveBeenCalledTimes(1);
  });

  it('edit opens the form with the class values', async () => {
    const s = await setup();
    await s.menuAction(1, 'Sửa');
    const code = s.el.querySelector<HTMLInputElement>('app-class-form input[name="code"]')!;
    expect(code.value).toBe('C2');
  });

  it('delete asks first; cancel does nothing, confirm deletes and reloads', async () => {
    const s = await setup();
    s.confirm.mockResolvedValueOnce(false);
    await s.menuAction(0, 'Xóa');
    expect(s.api.delete).not.toHaveBeenCalled();
    s.api.delete.mockReturnValue(of(null));
    s.api.list.mockClear();
    await s.menuAction(0, 'Xóa');
    expect(s.confirm).toHaveBeenLastCalledWith(
      expect.stringContaining('Lớp "LỚP 1"'),
      expect.objectContaining({ danger: true, confirmText: 'Xóa lớp' }),
    );
    expect(s.api.delete).toHaveBeenCalledWith('1');
    expect(s.api.list).toHaveBeenCalledTimes(1);
  });

  it('delete failure goes to the popup, list stays', async () => {
    const s = await setup();
    s.api.delete.mockReturnValue(throwError(() => apiErr('FORBIDDEN')));
    await s.menuAction(0, 'Xóa');
    expect(s.error).toHaveBeenCalledWith('Bạn không có quyền thực hiện thao tác này.');
    expect(s.el.textContent).toContain('LỚP 1');
  });

  it('deleting the only row of the last page steps back one page', async () => {
    const s = await setup(of(paged([mkClass('1')], { totalPages: 2, total: 11 })));
    s.api.list.mockReturnValue(of(paged([mkClass('11')], { page: 2, totalPages: 2, total: 11 })));
    s.btn('2').click();
    await s.flush();
    s.api.delete.mockReturnValue(of(null));
    s.api.list.mockReturnValue(of(paged([mkClass('1')], { totalPages: 1, total: 10 })));
    await s.menuAction(0, 'Xóa');
    expect(s.api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('restore success: popup and reload', async () => {
    const s = await setup(of(paged([mkClass('9', { deletedAt: 'd' })])));
    s.api.restore.mockReturnValue(of(mkClass('9')));
    s.api.list.mockClear();
    await s.menuAction(0, 'Khôi phục');
    expect(s.api.restore).toHaveBeenCalledWith('9');
    expect(s.success).toHaveBeenCalledWith('Đã khôi phục lớp.');
    expect(s.api.list).toHaveBeenCalledTimes(1);
  });

  it('restore 409 CLASS_CODE_TAKEN opens the new-code dialog; submitting restores with the code', async () => {
    const s = await setup(of(paged([mkClass('9', { deletedAt: 'd' })])));
    s.api.restore.mockReturnValueOnce(throwError(() => apiErr('CLASS_CODE_TAKEN')));
    await s.menuAction(0, 'Khôi phục');
    expect(s.error).not.toHaveBeenCalled();
    const modal = s.el.querySelector('app-class-restore-code-modal')!;
    expect(modal).not.toBeNull();
    s.api.restore.mockReturnValueOnce(of(mkClass('9')));
    const i = modal.querySelector<HTMLInputElement>('input[name="code"]')!;
    i.value = 'new1';
    i.dispatchEvent(new Event('input'));
    modal.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await s.flush();
    expect(s.api.restore).toHaveBeenLastCalledWith('9', { code: 'NEW1' });
    expect(s.el.querySelector('app-class-restore-code-modal')).toBeNull();
  });

  it('restore other error: popup, no dialog', async () => {
    const s = await setup(of(paged([mkClass('9', { deletedAt: 'd' })])));
    s.api.restore.mockReturnValue(throwError(() => new Error('boom')));
    await s.menuAction(0, 'Khôi phục');
    expect(s.error).toHaveBeenCalledWith('Không khôi phục được lớp.');
    expect(s.el.querySelector('app-class-restore-code-modal')).toBeNull();
  });

  it('pending membership rows are not links and have no actions', async () => {
    const s = await setup(of(paged([mkClass('5', { membershipStatus: 'pending' })])));
    expect(s.el.querySelector('a[href="/teacher/classes/5"]')).toBeNull();
    expect(s.el.querySelector('app-action-menu')).toBeNull();
    expect(s.el.textContent).toContain('Chờ duyệt');
  });
});
