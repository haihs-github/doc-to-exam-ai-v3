// Created by Haihs on 12/11/2026
// Specs for <app-class-form>: upper-case code, validation + focus, server field errors, single-flight submit, create/edit.
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { ClassDto } from '@doc-to-exam/contract';
import { ClassesApi } from '../../core/classes.api';
import { AlertService } from './alert.service';
import { ClassForm } from './class-form';

const cls: ClassDto = {
  id: 'c1',
  name: 'LỚP 10A1',
  code: '10A1',
  startYear: 2023,
  endYear: 2026,
  status: 'active',
  studentCount: 0,
  teacherCount: 1,
};
const apiErr = (code: string, message: string, field?: string) => ({
  success: false,
  code,
  message,
  field,
});

const setup = async (initial: ClassDto | null = null) => {
  const api = { create: vi.fn(), update: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: ClassesApi, useValue: api }] });
  const alert = TestBed.inject(AlertService);
  const success = vi.spyOn(alert, 'success').mockResolvedValue();
  const error = vi.spyOn(alert, 'error').mockResolvedValue();
  const f = TestBed.createComponent(ClassForm);
  f.componentRef.setInput('cls', initial);
  const saved = vi.fn();
  const cancelled = vi.fn();
  f.componentInstance.saved.subscribe(saved);
  f.componentInstance.cancelled.subscribe(cancelled);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const input = (n: string) => el.querySelector<HTMLInputElement>(`input[name="${n}"]`)!;
  const type = async (n: string, v: string) => {
    input(n).value = v;
    input(n).dispatchEvent(new Event('input'));
    await f.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await f.whenStable();
  };
  const fill = async () => {
    await type('name', 'lớp 11b');
    await type('code', 'b1');
    await type('startYear', '2024');
    await type('endYear', '2027');
  };
  return { f, el, api, success, error, saved, cancelled, input, type, submit, fill };
};

describe('ClassForm', () => {
  it('upper-cases name and code as you type', async () => {
    const s = await setup();
    await s.type('code', 'ab1đ');
    expect(s.input('code').value).toBe('AB1Đ');
  });

  it('empty submit: errors under the fields, first one focused, no request', async () => {
    const s = await setup();
    await s.submit();
    expect(s.api.create).not.toHaveBeenCalled();
    expect(s.el.textContent).toContain('Vui lòng nhập tên lớp.');
    expect(s.el.textContent).toContain('Vui lòng nhập mã lớp.');
    expect(document.activeElement).toBe(s.input('name'));
  });

  it('create: sends numeric years, emits saved, shows the success popup', async () => {
    const s = await setup();
    s.api.create.mockReturnValue(of(cls));
    await s.fill();
    await s.submit();
    expect(s.api.create).toHaveBeenCalledWith({
      name: 'LỚP 11B',
      code: 'B1',
      startYear: 2024,
      endYear: 2027,
    });
    expect(s.saved).toHaveBeenCalledTimes(1);
    expect(s.success).toHaveBeenCalledWith('Đã tạo lớp.');
  });

  it('edit: prefilled, PATCHes by id, success text differs', async () => {
    const s = await setup(cls);
    expect(s.input('code').value).toBe('10A1');
    s.api.update.mockReturnValue(of(cls));
    await s.submit();
    expect(s.api.update).toHaveBeenCalledWith('c1', {
      name: 'LỚP 10A1',
      code: '10A1',
      startYear: 2023,
      endYear: 2026,
    });
    expect(s.success).toHaveBeenCalledWith('Đã lưu lớp.');
  });

  it('server error with field=code shows under the code input and focuses it, no popup', async () => {
    const s = await setup();
    s.api.create.mockReturnValue(throwError(() => apiErr('CLASS_CODE_TAKEN', 'x', 'code')));
    await s.fill();
    await s.submit();
    expect(s.el.textContent).toContain('Mã lớp đã được lớp khác sử dụng.');
    expect(document.activeElement).toBe(s.input('code'));
    expect(s.error).not.toHaveBeenCalled();
    expect(s.saved).not.toHaveBeenCalled();
  });

  it('other server error goes to the popup and keeps the form open', async () => {
    const s = await setup();
    s.api.create.mockReturnValue(throwError(() => new Error('boom')));
    await s.fill();
    await s.submit();
    expect(s.error).toHaveBeenCalledWith('Không tạo được lớp.');
    expect(s.saved).not.toHaveBeenCalled();
  });

  it('single-flight: a second submit while the request is pending sends nothing', async () => {
    const s = await setup();
    const pending = new Subject<ClassDto>();
    s.api.create.mockReturnValue(pending);
    await s.fill();
    await s.submit();
    await s.submit();
    expect(s.api.create).toHaveBeenCalledTimes(1);
    expect(s.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    pending.next(cls);
    pending.complete();
    await s.f.whenStable();
    expect(s.saved).toHaveBeenCalledTimes(1);
  });

  it('Esc and Hủy emit cancelled', async () => {
    const s = await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await s.f.whenStable();
    expect(s.cancelled).toHaveBeenCalledTimes(1);
    [...s.el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Hủy')!.click();
    expect(s.cancelled).toHaveBeenCalledTimes(2);
  });
});
