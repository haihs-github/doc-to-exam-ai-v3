// Created by Haihs on 11/11/2026
// ConfirmService.confirm() -> Promise<boolean> + <app-confirm-host> (port of ConfirmModal.jsx, generic message form).
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ModalFocus } from './modal-focus';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface ConfirmItem extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private nextId = 0;
  private readonly queue = signal<ConfirmItem[]>([]);
  readonly current = computed(() => this.queue()[0] ?? null);

  confirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      this.queue.update((q) => [...q, { ...opts, id: this.nextId++, message, resolve }]),
    );
  }

  /** Resolves the popup on screen (true = confirmed) and shows the next one. */
  answer(ok: boolean): void {
    const [item, ...rest] = this.queue();
    if (!item) return;
    this.queue.set(rest);
    item.resolve(ok);
  }

  /** Host teardown: pending confirms resolve false so callers never hang. */
  cancelAll(): void {
    const q = this.queue();
    this.queue.set([]);
    q.forEach((i) => i.resolve(false));
  }
}

/** Mount exactly ONCE in the app shell. */
@Component({
  selector: 'app-confirm-host',
  imports: [ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of shown(); track c.id) {
      <div
        data-allow-busy
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div
          appModalFocus
          (dismissed)="svc.answer(false)"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-msg"
          class="w-full max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
        >
          <div class="p-6 text-center">
            <h3
              id="confirm-modal-title"
              class="mb-2 text-xl font-medium text-gray-900 dark:text-gray-100"
            >
              {{ c.title || 'Xác nhận' }}
            </h3>
            <p
              id="confirm-modal-msg"
              class="mb-4 whitespace-pre-line text-base text-gray-700 dark:text-gray-300"
            >
              {{ c.message }}
            </p>
            <div class="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                [attr.data-autofocus]="c.danger ? '' : null"
                (click)="svc.answer(false)"
                class="btn-secondary flex-1"
              >
                {{ c.cancelText || 'Hủy' }}
              </button>
              <button
                type="button"
                [attr.data-autofocus]="c.danger ? null : ''"
                (click)="svc.answer(true)"
                class="flex-1"
                [class]="c.danger ? 'btn-danger' : 'btn-primary'"
              >
                {{ c.confirmText || 'Xác nhận' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmHost {
  protected readonly svc = inject(ConfirmService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.svc.cancelAll());
  }

  protected readonly shown = computed(() => {
    const c = this.svc.current();
    return c ? [c] : [];
  });
}
