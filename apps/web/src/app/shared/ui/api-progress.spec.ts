// Created by Haihs on 11/11/2026
// Specs for <app-api-progress>: bar visible only while busy (150ms delay), reduced motion, write-time click blocking.
import { TestBed } from '@angular/core/testing';
import { ApiActivity } from '../../core/api-activity';
import { ApiProgress } from './api-progress';

const setup = async () => {
  const f = TestBed.createComponent(ApiProgress);
  f.detectChanges(); // whenStable() would hang on the faked timers
  return { f, el: f.nativeElement as HTMLElement, api: TestBed.inject(ApiActivity) };
};
// effects only run on change detection: flush them, let timers elapse, render the result
const tick = async (f: { detectChanges(): void }, ms: number) => {
  f.detectChanges();
  await vi.advanceTimersByTimeAsync(ms);
  f.detectChanges();
};
const bar = (el: HTMLElement) => el.querySelector('[data-api-progress]');

describe('ApiProgress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-api-busy');
  });

  it('shows the bar only while busy, after a 150ms delay; fast requests never flash', async () => {
    const { f, el, api } = await setup();
    expect(bar(el)).toBeNull();
    api.begin('GET');
    await tick(f, 100);
    expect(bar(el)).toBeNull();
    api.end('GET'); // finished before 150ms
    await tick(f, 200);
    expect(bar(el)).toBeNull();
    api.begin('GET');
    await tick(f, 200);
    expect(bar(el)).not.toBeNull();
    api.end('GET');
    await tick(f, 0);
    expect(bar(el)).toBeNull();
  });

  it('is decorative (aria-hidden, no progressbar role) and respects prefers-reduced-motion', async () => {
    const { f, el, api } = await setup();
    api.begin('GET');
    await tick(f, 200);
    const b = bar(el)!;
    expect(b.getAttribute('aria-hidden')).toBe('true');
    expect(b.hasAttribute('role')).toBe(false);
    expect(b.firstElementChild!.className).toContain('motion-reduce:animate-none');
    expect(b.firstElementChild!.className).toContain('animate-progress');
  });

  it('blocks button clicks and form submits while a WRITE is pending, except inside [data-allow-busy]', async () => {
    const { f, api } = await setup();
    const host = document.createElement('div');
    host.innerHTML = `<button id="a">a</button><div data-allow-busy><button id="b">b</button></div><form id="f"><button id="s">s</button></form>`;
    document.body.appendChild(host);
    const hits: string[] = [];
    host
      .querySelectorAll('button')
      .forEach((b) => b.addEventListener('click', () => hits.push(b.id)));
    host.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      hits.push('submit');
    });
    const click = (id: string) => host.querySelector<HTMLElement>('#' + id)!.click();

    api.begin('GET'); // read only: nothing blocked
    f.detectChanges();
    click('a');
    expect(hits).toEqual(['a']);
    api.end('GET');

    api.begin('POST');
    f.detectChanges();
    expect(document.documentElement.dataset['apiBusy']).toBe('write');
    expect(document.body.getAttribute('aria-busy')).toBe('true');
    click('a');
    click('s'); // would submit the form
    click('b');
    expect(hits).toEqual(['a', 'b']);

    api.end('POST');
    f.detectChanges();
    expect(document.documentElement.dataset['apiBusy']).toBeUndefined();
    expect(document.body.hasAttribute('aria-busy')).toBe(false);
    click('a');
    expect(hits).toEqual(['a', 'b', 'a']);
    host.remove();
  });

  it('removes the click guard on destroy', async () => {
    const { f, api } = await setup();
    const b = document.createElement('button');
    document.body.appendChild(b);
    const fn = vi.fn();
    b.addEventListener('click', fn);
    api.begin('PUT');
    f.detectChanges();
    f.destroy();
    b.click();
    expect(fn).toHaveBeenCalledTimes(1);
    b.remove();
  });
});
