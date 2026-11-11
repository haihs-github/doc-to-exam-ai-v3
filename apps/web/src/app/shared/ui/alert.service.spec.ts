// Created by Haihs on 11/11/2026
// Specs for AlertService + <app-alert-host>: FIFO queue, duplicate merge, one at a time, resolve on close, Esc, focus.
import { TestBed } from '@angular/core/testing';
import { AlertService } from './alert.service';
import { AlertHost } from './alert-modal';

const setup = async () => {
  const f = TestBed.createComponent(AlertHost);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const svc = TestBed.inject(AlertService);
  const dialogs = () => el.querySelectorAll('[role="alertdialog"]');
  const msg = () => el.querySelector('[role="alertdialog"] p')?.textContent?.trim();
  const flush = () => f.whenStable();
  return { el, svc, dialogs, msg, flush };
};
const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('AlertService + AlertHost', () => {
  it('shows one popup at a time, FIFO, and each promise resolves only when its popup closes', async () => {
    const { el, svc, dialogs, msg, flush } = await setup();
    const order: string[] = [];
    void svc.error('first').then(() => order.push('first'));
    void svc.warning('second').then(() => order.push('second'));
    await flush();
    expect(dialogs().length).toBe(1);
    expect(msg()).toBe('first');
    expect(el.querySelector('[role="alertdialog"]')?.getAttribute('aria-modal')).toBe('true');
    el.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    await flush();
    expect(order).toEqual(['first']);
    expect(msg()).toBe('second');
    el.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    await flush();
    expect(order).toEqual(['first', 'second']);
    expect(dialogs().length).toBe(0);
  });

  it('merges consecutive duplicates (one popup, both promises resolve) but not non-consecutive ones', async () => {
    const { el, svc, msg, flush } = await setup();
    let a = 0;
    let b = 0;
    let c = 0;
    void svc.error('dup').then(() => a++);
    void svc.error('dup').then(() => b++);
    void svc.error('other').then(() => c++);
    void svc.error('dup'); // not consecutive with the first: a separate popup
    await flush();
    el.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    await flush();
    expect([a, b, c]).toEqual([1, 1, 0]);
    expect(msg()).toBe('other');
    el.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    await flush();
    expect(msg()).toBe('dup');
  });

  it('same message with a different variant is not merged', async () => {
    const { svc, msg, flush, el } = await setup();
    void svc.error('m');
    void svc.success('m');
    await flush();
    el.querySelector<HTMLButtonElement>('[data-autofocus]')!.click();
    await flush();
    expect(msg()).toBe('m');
    expect(el.querySelector('[role="alertdialog"] h3')?.textContent?.trim()).toBe('Đã lưu');
  });

  it('Escape closes the popup, resolves, and returns focus to the opener', async () => {
    const { svc, dialogs, flush } = await setup();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    let done = false;
    void svc.success('ok').then(() => (done = true));
    await flush();
    expect(document.activeElement?.closest('[role="alertdialog"]')).not.toBeNull();
    esc();
    await flush();
    expect(done).toBe(true);
    expect(dialogs().length).toBe(0);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('Tab is trapped inside the dialog', async () => {
    const { svc, el, flush } = await setup();
    void svc.warning('m', { secondaryLabel: 'Làm gì đó' });
    await flush();
    const btns = el.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button');
    btns[btns.length - 1].focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btns[0]);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    document.dispatchEvent(back);
    expect(document.activeElement).toBe(btns[btns.length - 1]);
  });

  it('secondary button closes the popup then calls onSecondary', async () => {
    const { svc, el, dialogs, flush } = await setup();
    const onSecondary = vi.fn();
    let done = false;
    void svc
      .warning('m', { title: 'T', secondaryLabel: 'Đi tới', onSecondary })
      .then(() => (done = true));
    await flush();
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('T');
    const sec = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Đi tới'))!;
    sec.click();
    await flush();
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(done).toBe(true);
    expect(dialogs().length).toBe(0);
  });

  it('backdrop click closes, click inside does not', async () => {
    const { svc, el, dialogs, flush } = await setup();
    void svc.error('m');
    await flush();
    el.querySelector<HTMLElement>('[role="alertdialog"]')!.click();
    await flush();
    expect(dialogs().length).toBe(1);
    el.querySelector<HTMLElement>('[role="alertdialog"]')!.parentElement!.click();
    await flush();
    expect(dialogs().length).toBe(0);
  });
});
