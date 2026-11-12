// Created by Haihs on 11/11/2026
// <app-alert-host>: renders the AlertService popup (port of AlertModal.jsx); mount once in the app shell.
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { AlertService, AlertVariant } from './alert.service';
import { ModalFocus } from './modal-focus';

const VARIANTS: Record<AlertVariant, { box: string; title: string; button: string }> = {
  success: {
    box: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    title: 'Đã lưu',
    button: 'OK',
  },
  error: {
    box: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    title: 'Có lỗi',
    button: 'Đã hiểu',
  },
  warning: {
    box: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    title: 'Thông báo',
    button: 'Đã hiểu',
  },
};

/** Mount exactly ONCE in the app shell: two hosts would show every popup twice. */
@Component({
  selector: 'app-alert-host',
  imports: [ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of shown(); track c.id) {
      <!-- Backdrop click is a mouse convenience; keyboard users close with Esc (ModalFocus) or the button. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div
        data-allow-busy
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="$event.target === $event.currentTarget && svc.close()"
      >
        <div
          appModalFocus
          (dismissed)="svc.close()"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="alert-modal-title"
          aria-describedby="alert-modal-msg"
          class="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
        >
          <div class="p-6 text-center">
            <div
              class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded text-3xl font-semibold"
              [class]="v(c.variant).box"
              aria-hidden="true"
            >
              {{ c.variant === 'success' ? '✓' : '!' }}
            </div>
            <h3
              id="alert-modal-title"
              class="mb-2 text-xl font-medium text-gray-900 dark:text-gray-100"
            >
              {{ c.title || v(c.variant).title }}
            </h3>
            <p
              id="alert-modal-msg"
              class="mb-4 whitespace-pre-line text-base text-gray-700 dark:text-gray-300"
            >
              {{ c.message }}
            </p>
            <button type="button" data-autofocus (click)="svc.close()" class="btn-primary w-full">
              {{ v(c.variant).button }}
            </button>
            @if (c.secondaryLabel) {
              <button
                type="button"
                (click)="secondary(c.onSecondary)"
                class="btn-secondary mt-2 w-full"
              >
                {{ c.secondaryLabel }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class AlertHost {
  protected readonly svc = inject(AlertService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.svc.clear());
  }

  protected readonly shown = computed(() => {
    const c = this.svc.current();
    return c ? [c] : [];
  });
  protected readonly v = (variant: AlertVariant) => VARIANTS[variant];

  protected secondary(fn?: () => void): void {
    this.svc.close();
    fn?.();
  }
}
