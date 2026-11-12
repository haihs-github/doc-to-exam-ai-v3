// Created by Haihs on 12/11/2026
// Specs for <app-pager>: summary text, page buttons with gaps, prev/next bounds, pageChange output.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Pager, pageButtons } from './pager';

@Component({
  imports: [Pager],
  template: `<app-pager
    [page]="page()"
    [totalPages]="totalPages()"
    [total]="45"
    [disabled]="disabled()"
    (pageChange)="got.push($event)"
  />`,
})
class Host {
  page = signal(1);
  totalPages = signal(5);
  disabled = signal(false);
  got: number[] = [];
}

const setup = async () => {
  const f = TestBed.createComponent(Host);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const btn = (t: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === t)!;
  return { f, el, btn };
};

describe('pageButtons', () => {
  it('returns [] for <=1 page, windows around current with null gaps', () => {
    expect(pageButtons(1, 1)).toEqual([]);
    expect(pageButtons(1, 3)).toEqual([1, 2, 3]);
    expect(pageButtons(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageButtons(2, 10)).toEqual([1, 2, 3, null, 10]);
  });
});

describe('Pager', () => {
  it('shows the summary and disables Trước on the first page', async () => {
    const { el, btn } = await setup();
    expect(el.textContent).toContain('Tổng 45 lớp · Trang 1/5');
    expect(btn('Trước').disabled).toBe(true);
    expect(btn('Sau').disabled).toBe(false);
  });

  it('emits pageChange for Sau, a number, and marks the current page', async () => {
    const { f, el, btn } = await setup();
    btn('Sau').click();
    btn('5').click();
    expect(f.componentInstance.got).toEqual([2, 5]);
    expect(btn('1').getAttribute('aria-current')).toBe('page');
    expect(btn('1').disabled).toBe(false); // stays focusable
    btn('1').click();
    expect(f.componentInstance.got).toEqual([2, 5]); // no-op
    expect(el.querySelector('nav')!.getAttribute('aria-label')).toBe('Phân trang');
  });

  it('disables Sau on the last page and renders a gap', async () => {
    const { f, el, btn } = await setup();
    f.componentInstance.totalPages.set(10);
    f.componentInstance.page.set(10);
    await f.whenStable();
    expect(btn('Sau').disabled).toBe(true);
    expect(el.textContent).toContain('…');
  });

  it('hides the buttons for a single page and disables all when disabled', async () => {
    const { f, el, btn } = await setup();
    f.componentInstance.disabled.set(true);
    await f.whenStable();
    expect(btn('Sau').disabled).toBe(true);
    f.componentInstance.totalPages.set(1);
    await f.whenStable();
    expect(el.querySelectorAll('button').length).toBe(0);
    expect(el.textContent).toContain('Trang 1/1');
  });
});
