// Created by Haihs on 11/11/2026
// Specs for stacked modals (Alert over Confirm), focus fallback, host destroy, and click-through while a write is pending.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiActivity } from '../../core/api-activity';
import { AlertHost } from './alert-modal';
import { AlertService } from './alert.service';
import { ApiProgress } from './api-progress';
import { ConfirmHost, ConfirmService } from './confirm-modal';

@Component({
  imports: [AlertHost, ConfirmHost, ApiProgress],
  template: `<app-alert-host /><app-confirm-host /><app-api-progress />`,
})
class Shell {}

const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const setup = async () => {
  const f = TestBed.createComponent(Shell);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const confirm = () => el.querySelector('app-confirm-host [role="alertdialog"]');
  const alert = () => el.querySelector('app-alert-host [role="alertdialog"]');
  return {
    f,
    el,
    confirm,
    alert,
    a: TestBed.inject(AlertService),
    c: TestBed.inject(ConfirmService),
  };
};

describe('stacked modals', () => {
  it('one Esc closes only the top layer; the lower stays open, inert until it is top again', async () => {
    const { f, confirm, alert, a, c } = await setup();
    const cp = c.confirm('xóa?');
    await f.whenStable();
    void a.error('lỗi'); // alert opens ABOVE the confirm
    await f.whenStable();
    expect(alert()!.parentElement!.hasAttribute('inert')).toBe(false);
    expect(confirm()!.parentElement!.hasAttribute('inert')).toBe(true);
    expect(Number(alert()!.parentElement!.style.zIndex)).toBeGreaterThan(
      Number(confirm()!.parentElement!.style.zIndex),
    );
    esc();
    await f.whenStable();
    expect(alert()).toBeNull();
    expect(confirm()).not.toBeNull();
    expect(confirm()!.parentElement!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.closest('[role="alertdialog"]')).toBe(confirm());
    esc();
    await expect(cp).resolves.toBe(false);
    await f.whenStable();
    expect(confirm()).toBeNull();
  });

  it('Tab trap keeps focus inside the top layer only', async () => {
    const { f, confirm, alert, a, c } = await setup();
    void c.confirm('xóa?');
    await f.whenStable();
    void a.warning('m');
    await f.whenStable();
    const lowerFocused = vi.fn();
    confirm()!
      .querySelectorAll('button')
      .forEach((b) => b.addEventListener('focus', lowerFocused));
    const btn = alert()!.querySelector('button')!;
    btn.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(ev);
    expect(alert()!.contains(document.activeElement)).toBe(true);
    expect(confirm()!.contains(document.activeElement)).toBe(false);
    expect(lowerFocused).not.toHaveBeenCalled(); // the lower layer's trap must not grab focus
    // focus escaped to the lower layer somehow: Tab pulls it back into the top one
    confirm()!.querySelector('button')!.focus();
    lowerFocused.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(alert()!.contains(document.activeElement)).toBe(true);
    expect(lowerFocused).not.toHaveBeenCalled();
  });

  it('opener removed from the DOM: focus falls back to <main> (made focusable)', async () => {
    const { f, a } = await setup();
    const main = document.createElement('main');
    const opener = document.createElement('button');
    main.appendChild(opener);
    document.body.appendChild(main);
    opener.focus();
    void a.error('m');
    await f.whenStable();
    opener.remove();
    esc();
    await f.whenStable();
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
    main.remove();
  });

  it('destroying the hosts settles queued promises (alert resolves, confirm resolves false)', async () => {
    const { f, a, c } = await setup();
    let alerted = 0;
    const onSecondary = vi.fn();
    void a.error('m1').then(() => alerted++);
    void a.error('m2', { secondaryLabel: 'x', onSecondary }).then(() => alerted++);
    const p1 = c.confirm('một');
    const p2 = c.confirm('hai');
    await f.whenStable();
    f.destroy();
    await expect(p1).resolves.toBe(false);
    await expect(p2).resolves.toBe(false);
    await Promise.resolve();
    expect(alerted).toBe(2);
    expect(onSecondary).not.toHaveBeenCalled();
  });

  it('dialog buttons still work while a WRITE is pending (data-allow-busy)', async () => {
    const { f, el, a, c } = await setup();
    TestBed.inject(ApiActivity).begin('POST');
    await f.whenStable();
    let closed = false;
    void a.success('ok').then(() => (closed = true));
    await f.whenStable();
    el.querySelector<HTMLButtonElement>('app-alert-host [data-autofocus]')!.click();
    await f.whenStable();
    expect(closed).toBe(true);
    const p = c.confirm('?');
    await f.whenStable();
    el.querySelector<HTMLButtonElement>('app-confirm-host [data-autofocus]')!.click();
    await expect(p).resolves.toBe(true);
    TestBed.inject(ApiActivity).end('POST');
  });
});
