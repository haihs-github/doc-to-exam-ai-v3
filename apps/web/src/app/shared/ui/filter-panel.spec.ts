// Created by Haihs on 17/11/2026
// Specs for <app-filter-panel>: closed by default, toggle opens, count badge, close button.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterPanel } from './filter-panel';

@Component({
  imports: [FilterPanel],
  template: `<app-filter-panel [count]="count"><p id="body">nội dung lọc</p></app-filter-panel>`,
})
class Host {
  count = 0;
}

const setup = async (count = 0) => {
  const f = TestBed.createComponent(Host);
  f.componentInstance.count = count;
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  return { f, el, toggle: () => el.querySelector('button[aria-expanded]') as HTMLButtonElement };
};

describe('FilterPanel', () => {
  it('mặc định đóng và nội dung không render', async () => {
    const { el, toggle } = await setup();
    expect(el.querySelector('#body')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('click toggle mở panel', async () => {
    const { f, el, toggle } = await setup();
    toggle().click();
    await f.whenStable();
    expect(el.querySelector('#body')).not.toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('hiển thị count cạnh nhãn', async () => {
    const { toggle } = await setup(2);
    expect(toggle().textContent).toContain('2');
  });

  it('nút × đóng lại', async () => {
    const { f, el, toggle } = await setup();
    toggle().click();
    await f.whenStable();
    (el.querySelector('button[aria-label="Đóng bộ lọc"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(el.querySelector('#body')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});
