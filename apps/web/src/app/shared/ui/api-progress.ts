// Created by Haihs on 11/11/2026
// <app-api-progress>: top progress bar while requests are pending + global click/submit block while WRITES are pending.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ApiActivity } from '../../core/api-activity';

const BLOCKABLE = 'button, [role="button"], input[type="submit"], input[type="button"]';
const inAllowedZone = (el: Element | null) => Boolean(el?.closest('[data-allow-busy]'));

@Component({
  selector: 'app-api-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        role="progressbar"
        aria-label="Đang tải dữ liệu"
        class="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary-100 dark:bg-sky-900/40"
      >
        <div
          class="h-full w-1/3 animate-progress bg-primary-700 motion-reduce:w-full motion-reduce:animate-none dark:bg-sky-400"
        ></div>
      </div>
    }
  `,
})
export class ApiProgress {
  private readonly activity = inject(ApiActivity);
  protected readonly visible = signal(false);

  constructor() {
    // 150ms delay so fast requests never flash the bar; hide immediately when idle.
    effect((onCleanup) => {
      const busy = this.activity.isBusy();
      const t = setTimeout(() => this.visible.set(busy), busy ? 150 : 0);
      onCleanup(() => clearTimeout(t));
    });

    const root = document.documentElement;
    effect(() => {
      if (this.activity.writing() > 0) root.dataset['apiBusy'] = 'write';
      else delete root.dataset['apiBusy'];
    });

    // Capture phase: swallow button clicks / form submits during a write (anti double-submit), except in [data-allow-busy].
    const onClick = (e: Event) => {
      if (this.activity.writing() === 0) return;
      const btn = (e.target as Element | null)?.closest?.(BLOCKABLE) ?? null;
      if (!btn || inAllowedZone(btn)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onSubmit = (e: Event) => {
      if (this.activity.writing() === 0 || inAllowedZone(e.target as Element)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      delete root.dataset['apiBusy'];
    });
  }
}
