// Created by Haihs on 11/11/2026
// Specs for ConfirmService + <app-confirm-host>: resolves true/false, Esc cancels, queue.
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm-modal';
import { ConfirmHost } from './confirm-modal';

const setup = async () => {
  const f = TestBed.createComponent(ConfirmHost);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const btn = (t: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === t)!;
  return { el, svc: TestBed.inject(ConfirmService), btn, flush: () => f.whenStable() };
};

describe('ConfirmService', () => {
  it('resolves true on confirm and false on cancel (default Vietnamese labels)', async () => {
    const { svc, btn, flush, el } = await setup();
    const p1 = svc.confirm('Xóa?');
    await flush();
    expect(el.querySelector('[role="alertdialog"]')?.getAttribute('aria-modal')).toBe('true');
    btn('Xác nhận').click();
    await expect(p1).resolves.toBe(true);
    await flush();
    const p2 = svc.confirm('Xóa?', { confirmText: 'Xóa', cancelText: 'Ở lại', danger: true });
    await flush();
    expect(btn('Xóa').className).toContain('btn-danger');
    btn('Ở lại').click();
    await expect(p2).resolves.toBe(false);
  });

  it('Escape resolves false; queued confirms show one at a time in order', async () => {
    const { svc, btn, flush, el } = await setup();
    const p1 = svc.confirm('một');
    const p2 = svc.confirm('hai');
    await flush();
    expect(el.querySelectorAll('[role="alertdialog"]').length).toBe(1);
    expect(el.textContent).toContain('một');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(p1).resolves.toBe(false);
    await flush();
    expect(el.textContent).toContain('hai');
    btn('Xác nhận').click();
    await expect(p2).resolves.toBe(true);
  });
});
