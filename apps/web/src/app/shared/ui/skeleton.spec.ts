// Created by Haihs on 12/11/2026
// Specs for <app-skeleton>: block (aria-hidden) and list (status region with sr-only text).
import { TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a single aria-hidden block by default', async () => {
    const f = TestBed.createComponent(Skeleton);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('renders a list with role=status, busy, "Đang tải..." and N rows (default 5)', async () => {
    const f = TestBed.createComponent(Skeleton);
    f.componentRef.setInput('variant', 'list');
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const s = el.querySelector('[role="status"]')!;
    expect(s.getAttribute('aria-busy')).toBe('true');
    expect(s.textContent).toContain('Đang tải...');
    expect(el.querySelectorAll('[data-row]').length).toBe(5);
    f.componentRef.setInput('lines', 2);
    await f.whenStable();
    expect(el.querySelectorAll('[data-row]').length).toBe(2);
  });
});
