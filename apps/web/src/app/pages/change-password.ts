// Created by Haihs on 11/11/2026
// ChangePassword page (forced first login or voluntary) + "log out everywhere"; port of client/src/pages/ChangePassword.jsx.
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/api-errors';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { FormField } from '../shared/ui/form-field';
import { PasswordField } from '../shared/ui/password-field';
import {
  CHANGE_PASSWORD_ORDER,
  FormErrors,
  refreshErrors,
  validateChangePasswordForm,
} from '../shared/utils/auth-rules';
import { homePathForRole } from '../shared/utils/auth-routing';
import { fieldFailure, focusField } from './form-helpers';

type Values = { currentPassword: string; newPassword: string; confirmPassword: string };

@Component({
  selector: 'app-change-password',
  imports: [FormField, PasswordField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-md mx-auto px-4 py-10">
      <form
        (submit)="submit($event)"
        novalidate
        class="bg-white shadow-raised dark:shadow-raised-dark rounded-xl border border-gray-200 p-6 sm:p-8 space-y-5 dark:bg-gray-800 dark:border-gray-700"
      >
        <h1 class="text-xl font-extrabold text-gray-900 dark:text-gray-100">Đổi mật khẩu</h1>
        @if (forced) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            Bạn cần đổi mật khẩu để tiếp tục.
          </p>
        }
        <app-form-field
          label="Mật khẩu hiện tại"
          [required]="true"
          [error]="errors()['currentPassword'] ?? ''"
        >
          <app-password-field
            name="currentPassword"
            autocomplete="current-password"
            [value]="v().currentPassword"
            (valueChange)="set('currentPassword', $event)"
          />
        </app-form-field>
        <app-form-field
          label="Mật khẩu mới (tối thiểu 8 ký tự)"
          [required]="true"
          [error]="errors()['newPassword'] ?? ''"
        >
          <app-password-field
            name="newPassword"
            autocomplete="new-password"
            [value]="v().newPassword"
            (valueChange)="set('newPassword', $event)"
          />
        </app-form-field>
        <app-form-field
          label="Nhập lại mật khẩu mới"
          [required]="true"
          [error]="errors()['confirmPassword'] ?? ''"
        >
          <app-password-field
            name="confirmPassword"
            autocomplete="new-password"
            [value]="v().confirmPassword"
            (valueChange)="set('confirmPassword', $event)"
          />
        </app-form-field>
        <button type="submit" class="btn-primary w-full" [disabled]="busy()">
          {{ busy() ? 'Đang xử lý...' : 'Đổi mật khẩu' }}
        </button>
        <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            (click)="logoutAll()"
            [disabled]="busy()"
            class="flex items-center gap-2 text-base font-semibold text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            Đăng xuất mọi thiết bị
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ChangePassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Fixed at load: after a forced change the user is no longer "forced" but we are leaving anyway. */
  protected readonly forced = Boolean(this.auth.user()?.mustChangePassword);
  protected readonly v = signal<Values>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  protected readonly errors = signal<FormErrors>({});
  protected readonly busy = signal(false);

  protected set(key: keyof Values, value: string): void {
    this.v.update((x) => ({ ...x, [key]: value }));
    this.errors.update((prev) => refreshErrors(prev, validateChangePasswordForm, this.v()));
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const found = validateChangePasswordForm(this.v());
    this.errors.set(found);
    const first = CHANGE_PASSWORD_ORDER.find((k) => found[k]);
    if (first) return focusField(this.host.nativeElement, first);

    this.busy.set(true);
    // AuthService stores the NEW token (the server rotates it) before this callback runs.
    this.auth
      .changePassword({
        currentPassword: this.v().currentPassword,
        newPassword: this.v().newPassword,
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) => {
          if (this.forced)
            void this.router.navigateByUrl(homePathForRole(r.user.role), { replaceUrl: true });
          else void this.alert.success('Đã đổi mật khẩu. Các thiết bị khác phải đăng nhập lại.');
        },
        error: (err: unknown) => {
          const f = fieldFailure(err, CHANGE_PASSWORD_ORDER);
          if (f) {
            this.errors.set({ [f.field]: f.message });
            focusField(this.host.nativeElement, f.field);
          } else void this.alert.error(errorMessage(err));
        },
      });
  }

  protected async logoutAll(): Promise<void> {
    if (this.busy()) return;
    const role = this.auth.user()?.role;
    const ok = await this.confirm.confirm(
      'Bạn sẽ bị đăng xuất khỏi tất cả thiết bị, kể cả thiết bị này. Bạn có chắc chắn không?',
      {
        title: 'Đăng xuất mọi thiết bị',
        confirmText: 'Đăng xuất',
        cancelText: 'Ở lại',
        danger: true,
      },
    );
    if (!ok) return;
    this.busy.set(true);
    this.auth
      .logoutAll()
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () =>
          void this.router.navigateByUrl(role === 'teacher' ? '/teacher/login' : '/login', {
            replaceUrl: true,
          }),
        error: (err: unknown) => void this.alert.error(errorMessage(err)),
      });
  }
}
