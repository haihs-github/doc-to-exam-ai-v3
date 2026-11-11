// Created by Haihs on 12/11/2026
// Specs for <app-class-restore-code-modal>: new class code on 409, inline errors, single-flight, popups.
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { ClassDto } from '@doc-to-exam/contract';
import { ClassesApi } from '../../core/classes.api';
import { AlertService } from './alert.service';
import { ClassRestoreCodeModal } from './class-restore-code-modal';

const cls: ClassDto = {
  id: 'c1',
  name: 'LỚP 10A1',
  code: '10A1',
  startYear: 2023,
  endYear: 2026,
  status: 'active',
  deletedAt: '2026-01-01',
  studentCount: 0,
  teacherCount: 1,
};

const setup = async () => {
  const api = { restore: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: ClassesApi, useValue: api }] });
  const alert = TestBed.inject(AlertService);
  const success = vi.spyOn(alert, 'success').mockResolvedValue();
  const error = vi.spyOn(alert, 'error').mockResolvedValue();
  const f = TestBed.createComponent(ClassRestoreCodeModal);
  f.componentRef.setInput('cls', cls);
  const restored = vi.fn();
  const cancelled = vi.fn();
  f.componentInstance.restored.subscribe(restored);
  f.componentInstance.cancelled.subscribe(cancelled);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('input[name="code"]')!;
  const type = async (v: string) => {
    input.value = v;
    input.dispatchEvent(new Event('input'));
    await f.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await f.whenStable();
  };
  return { f, el, api, success, error, restored, cancelled, input, type, submit };
};

describe('ClassRestoreCodeModal', () => {
  it('is a labelled dialog that names the taken code and focuses the input', async () => {
    const s = await setup();
    expect(s.el.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(s.el.textContent).toContain('Mã "10A1" đã được lớp khác sử dụng.');
    expect(document.activeElement).toBe(s.input);
  });

  it('empty code: inline error, no request', async () => {
    const s = await setup();
    await s.submit();
    expect(s.api.restore).not.toHaveBeenCalled();
    expect(s.el.textContent).toContain('Hãy nhập mã lớp mới.');
  });

  it('restores with the trimmed upper-case code, emits restored, success popup', async () => {
    const s = await setup();
    s.api.restore.mockReturnValue(of(cls));
    await s.type(' 10b2 ');
    await s.submit();
    expect(s.api.restore).toHaveBeenCalledWith('c1', { code: '10B2' });
    expect(s.restored).toHaveBeenCalledTimes(1);
    expect(s.success).toHaveBeenCalledWith('Đã khôi phục lớp.');
  });

  it('409 CLASS_CODE_TAKEN again: message under the input, focus back, stays open', async () => {
    const s = await setup();
    s.api.restore.mockReturnValue(
      throwError(() => ({ success: false, code: 'CLASS_CODE_TAKEN', message: 'x', field: 'code' })),
    );
    await s.type('B2');
    await s.submit();
    expect(s.el.textContent).toContain('Mã này cũng đã được lớp khác sử dụng, hãy nhập mã khác.');
    expect(document.activeElement).toBe(s.input);
    expect(s.restored).not.toHaveBeenCalled();
    expect(s.error).not.toHaveBeenCalled();
  });

  it('other error: popup, modal stays, can retry', async () => {
    const s = await setup();
    s.api.restore.mockReturnValue(throwError(() => new Error('boom')));
    await s.type('B2');
    await s.submit();
    expect(s.error).toHaveBeenCalledWith('Không khôi phục được lớp.');
    expect(s.restored).not.toHaveBeenCalled();
    expect(s.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('single-flight', async () => {
    const s = await setup();
    s.api.restore.mockReturnValue(new Subject<ClassDto>());
    await s.type('B2');
    await s.submit();
    await s.submit();
    expect(s.api.restore).toHaveBeenCalledTimes(1);
  });

  it('Esc cancels', async () => {
    const s = await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(s.cancelled).toHaveBeenCalledTimes(1);
  });
});
