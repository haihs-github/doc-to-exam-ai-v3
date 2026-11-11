// Created by Haihs on 11/11/2026
// <app-api-key-modal>: Gemini API key dialog for teachers (port of ApiKeyModal.jsx + utils/apiKeyModal.js). Mount ONCE in the shell.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { errorMessage } from '../../core/api-errors';
import { AuthService } from '../../core/auth.service';
import { focusField } from '../../pages/form-helpers';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { FormField } from './form-field';
import { ModalFocus } from './modal-focus';
import { PasswordField } from './password-field';

export const OPEN_API_KEY_MODAL_EVENT = 'open-api-key-modal';
const MAX_KEY = 512; // matches the API contract

/** Asks the shell's <app-api-key-modal> to open (any teacher page / the navbar can call it). */
export const openApiKeyModal = (): void => {
  window.dispatchEvent(new CustomEvent(OPEN_API_KEY_MODAL_EVENT));
};

@Component({
  selector: 'app-api-key-modal',
  imports: [ModalFocus, FormField, PasswordField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Angular removes the window listener when the component is destroyed.
  host: { '(window:open-api-key-modal)': 'open()' },
  template: `
    @if (isOpen() && auth.isTeacher()) {
      <div
        data-allow-busy
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      >
        <div
          appModalFocus
          (dismissed)="close()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-modal-title"
          class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
        >
          <div class="border-b border-gray-200 p-5 dark:border-gray-700">
            <h2
              id="api-key-modal-title"
              class="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Cài đặt Gemini API Key
            </h2>
            <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Key được lưu trực tiếp vào cơ sở dữ liệu tài khoản giáo viên của bạn
            </p>
          </div>
          <form (submit)="submit($event)" novalidate class="space-y-4 p-4 sm:p-5">
            <app-form-field
              label="Google Gemini API Key"
              [required]="true"
              [error]="error()"
              [hint]="hint()"
            >
              <app-password-field
                inputId="geminiApiKey"
                name="geminiApiKey"
                autocomplete="off"
                placeholder="AIzaSy..."
                [value]="key()"
                (valueChange)="setKey($event)"
              />
            </app-form-field>
            @if (auth.user()?.hasApiKey) {
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Đã lưu: ••••{{ auth.user()?.apiKeyLast4 }}
              </p>
            }
            <div
              class="rounded-xl border border-primary-100 bg-primary-50/80 p-3.5 text-base text-primary-900 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
            >
              <span>Bạn chưa có API Key? Lấy miễn phí tại </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                class="font-bold underline hover:text-primary-800 dark:hover:text-sky-300"
                >Google AI Studio</a
              >
              <p class="mt-1 text-gray-600 dark:text-gray-400">
                API Key của Google hoàn toàn miễn phí và không cần nhập thẻ thanh toán.
              </p>
            </div>
            <div class="flex items-center justify-between gap-1 pt-1">
              @if (auth.user()?.hasApiKey) {
                <button
                  type="button"
                  (click)="clear()"
                  [disabled]="busy()"
                  class="min-h-[48px] whitespace-nowrap rounded-lg px-2 py-2 text-base font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  Xóa key
                </button>
              } @else {
                <div></div>
              }
              <div class="flex items-center gap-1">
                <button type="button" (click)="close()" class="btn-ghost">Đóng</button>
                <button type="submit" [disabled]="busy()" class="btn-primary">
                  {{ busy() ? 'Đang lưu...' : 'Lưu key' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class ApiKeyModal {
  protected readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly isOpen = signal(false);
  protected readonly key = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  constructor() {
    // Session ended (logout / 401): drop the open state and the typed key so a later login never resurrects them.
    effect(() => {
      if (!this.auth.isTeacher()) this.close();
    });
  }

  protected hint(): string {
    return this.auth.user()?.hasApiKey ? 'Nhập key mới nếu muốn thay key đã lưu.' : '';
  }

  protected open(): void {
    if (!this.auth.isTeacher()) return;
    this.key.set(''); // never prefilled: the server does not return the key
    this.error.set('');
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
    this.key.set(''); // the key must not linger in memory/DOM
    this.error.set('');
  }

  protected setKey(v: string): void {
    this.key.set(v);
    if (v.trim()) this.error.set('');
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const k = this.key().trim();
    const problem = !k
      ? 'Vui lòng nhập API Key hợp lệ.'
      : k.length > MAX_KEY
        ? `API Key tối đa ${MAX_KEY} ký tự.`
        : '';
    this.error.set(problem);
    if (problem) return focusField(this.host.nativeElement, 'geminiApiKey');
    this.busy.set(true);
    this.auth
      .updateApiKey(k)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.key.set(''); // gone from the DOM before the popup is acknowledged
          void this.alert
            .success('Đã lưu API Key thành công vào tài khoản của bạn!')
            .then(() => this.close());
        },
        error: (err: unknown) => void this.alert.error(errorMessage(err)),
      });
  }

  protected async clear(): Promise<void> {
    if (this.busy()) return;
    if (
      !(await this.confirmSvc.confirm(
        'Bạn có chắc chắn muốn xóa Gemini API Key khỏi tài khoản không?',
      ))
    )
      return;
    this.busy.set(true);
    this.auth
      .updateApiKey('')
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.key.set('');
          void this.alert.success('Đã xóa API Key khỏi tài khoản.').then(() => this.close());
        },
        error: (err: unknown) => void this.alert.error(errorMessage(err)),
      });
  }
}
