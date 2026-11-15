// Created by Haihs on 15/11/2026
// <app-scroll-to-top>: floating button that scrolls to the top after 400px (hidden in the exam room). Port of ScrollToTop.jsx.
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Icon } from './icon';

const ROOM_PATH = /^\/ca\/[^/]+\/room\/?$/;

export const shouldShowScrollTop = (o: { scrollY: number; pathname: string; threshold?: number }) =>
  o.scrollY > (o.threshold ?? 400) && !ROOM_PATH.test(o.pathname);

export const scrollBehaviorFor = (reduced: boolean): ScrollBehavior =>
  reduced ? 'auto' : 'smooth';

@Component({
  selector: 'app-scroll-to-top',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <button
        type="button"
        (click)="goTop()"
        aria-label="Cuộn lên đầu trang"
        title="Cuộn lên đầu trang"
        class="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary-700 text-white transition-colors hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
      >
        <app-icon name="arrow-up" svgClass="h-5 w-5" />
      </button>
    }
  `,
})
export class ScrollToTop {
  private readonly router = inject(Router);
  protected readonly show = signal(false);

  constructor() {
    let frame = 0;
    const update = () => {
      frame = 0;
      this.show.set(
        shouldShowScrollTop({
          scrollY: window.scrollY,
          pathname: this.router.url.split(/[?#]/)[0],
        }),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) onScroll();
    });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      sub.unsubscribe();
      cancelAnimationFrame(frame);
    });
  }

  protected goTop(): void {
    window.scrollTo({
      top: 0,
      behavior: scrollBehaviorFor(window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    });
  }
}
