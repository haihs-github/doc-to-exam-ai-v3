// Created by Haihs on 15/11/2026
// Specs for the pure scroll-to-top rules.
import { scrollBehaviorFor, shouldShowScrollTop } from './scroll-to-top';

describe('scroll-to-top rules', () => {
  it('shows only past 400px and never in the exam room', () => {
    expect(shouldShowScrollTop({ scrollY: 401, pathname: '/about' })).toBe(true);
    expect(shouldShowScrollTop({ scrollY: 400, pathname: '/about' })).toBe(false);
    expect(shouldShowScrollTop({ scrollY: 900, pathname: '/ca/AB3K7M/room' })).toBe(false);
    expect(shouldShowScrollTop({ scrollY: 900, pathname: '/ca/AB3K7M/result' })).toBe(true);
  });
  it('respects reduced motion', () => {
    expect(scrollBehaviorFor(true)).toBe('auto');
    expect(scrollBehaviorFor(false)).toBe('smooth');
  });
});
