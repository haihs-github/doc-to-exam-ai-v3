// Created by Haihs on 12/11/2026
// <app-temp-password-modal>: shows a temporary password ONCE after a reset, with copy and a save-it warning. The parent drops it on close.
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { copyToClipboard } from '../utils/browser';
import { AlertService } from './alert.service';
import { ModalFocus } from './modal-focus';
import { inject } from '@angular/core';

export interface TempPasswordEntry {
  fullName: string;
  phoneNumber: string;
  temporaryPassword: string;
}

@Component({
  selector: 'app-temp-password-modal',
  imports: [ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        appModalFocus
        (dismissed)="closed.emit()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-pw-title"
        class="w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        <h2 id="temp-pw-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Mật khẩu tạm của {{ entry().fullName }}
        </h2>
        <p class="text-base text-gray-600 dark:text-gray-400">
          Số điện thoại: {{ entry().phoneNumber }}. Học sinh sẽ phải đổi mật khẩu ở lần đăng nhập
          đầu.
        </p>
        <p
          class="select-all rounded-lg bg-gray-100 p-3 text-center font-mono text-xl tracking-widest dark:bg-gray-900"
          aria-label="Mật khẩu tạm"
        >
          {{ entry().temporaryPassword }}
        </p>
        <p role="note" class="text-base font-semibold text-amber-800 dark:text-amber-300">
          Mật khẩu này chỉ hiện một lần. Hãy sao chép hoặc ghi lại ngay trước khi đóng.
        </p>
        <div class="flex gap-3 pt-1">
          <button type="button" class="btn-secondary flex-1" (click)="copy()">Sao chép</button>
          <button type="button" class="btn-primary flex-1" (click)="closed.emit()">
            Đã lưu, đóng
          </button>
        </div>
      </div>
    </div>
  `,
})
export class TempPasswordModal {
  readonly entry = input.required<TempPasswordEntry>();
  readonly closed = output<void>();
  private readonly alert = inject(AlertService);

  protected async copy(): Promise<void> {
    const ok = await copyToClipboard(this.entry().temporaryPassword);
    void (ok
      ? this.alert.success('Đã sao chép mật khẩu tạm.')
      : this.alert.error('Không sao chép được, hãy ghi lại mật khẩu thủ công.'));
  }
}
