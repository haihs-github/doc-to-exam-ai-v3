// Created by Haihs on 11/11/2026
// Login page for both audiences (route data `audience`); port of client/src/pages/Login.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { LoginBody } from '@doc-to-exam/contract';
import { finalize } from 'rxjs';
import { AuthService, Audience } from '../core/auth.service';
import { errorMessage } from '../core/api-errors';
import { AlertService } from '../shared/ui/alert.service';
import { FormField } from '../shared/ui/form-field';
import { PasswordField } from '../shared/ui/password-field';
import {
  FormErrors,
  LOGIN_ORDER,
  normalizePhone,
  refreshErrors,
  validateLoginForm,
} from '../shared/utils/auth-rules';
import { postLoginPath } from '../shared/utils/auth-routing';
import { fieldFailure, focusField, navigationFrom } from './form-helpers';

const LINK =
  'text-primary-700 dark:text-sky-400 hover:text-primary-800 dark:hover:text-sky-300 font-bold ml-1';

@Component({
  selector: 'app-login',
  imports: [FormField, PasswordField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <div
        class="max-w-md w-full bg-white dark:bg-gray-800 shadow-raised dark:shadow-raised-dark rounded-xl border border-gray-200/80 dark:border-gray-700 overflow-hidden animate-fadeIn"
      >
        <div class="px-6 sm:px-8 pt-8 text-gray-900 dark:text-gray-100 text-left">
          <h2 class="text-2xl font-extrabold tracking-tight">
            {{ isTeacher ? 'Cổng Đăng Nhập Giáo Viên' : 'Đăng Nhập Học Sinh' }}
          </h2>
          <p class="text-base text-gray-600 dark:text-gray-300 mt-1">
            {{
              isTeacher
                ? 'Đăng nhập để tạo đề thi bằng AI, quản lý đề, quản lý lớp và xem bảng điểm kết quả'
                : 'Đăng nhập để xem lớp của bạn và tham gia lớp bằng link mời'
            }}
          </p>
        </div>
        <form (submit)="submit($event)" novalidate class="p-6 sm:p-8 space-y-5">
          <div class="space-y-4">
            <app-form-field
              label="Số Điện Thoại"
              [required]="true"
              [error]="errors()['phoneNumber'] ?? ''"
            >
              <input
                class="input"
                name="phoneNumber"
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                placeholder="0987654321"
                [value]="phone()"
                (input)="setPhone(val($event))"
              />
            </app-form-field>
            <app-form-field label="Mật Khẩu" [required]="true" [error]="errors()['password'] ?? ''">
              <app-password-field
                name="password"
                autocomplete="current-password"
                placeholder="••••••••"
                [value]="password()"
                (valueChange)="setPassword($event)"
              />
            </app-form-field>
          </div>
          <div class="pt-2">
            <button type="submit" class="btn-primary w-full" [disabled]="busy()">
              {{ busy() ? 'Đang Đăng Nhập...' : 'Đăng Nhập Ngay' }}
            </button>
          </div>
          <div
            class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-base text-gray-600 dark:text-gray-300 space-y-2"
          >
            <div>
              {{ isTeacher ? 'Bạn chưa có tài khoản giáo viên?' : 'Bạn chưa có tài khoản?' }}
              <a
                [routerLink]="isTeacher ? '/teacher/register' : '/register'"
                [state]="linkState"
                [class]="link"
              >
                Đăng ký tại đây
              </a>
            </div>
            <div>
              {{ isTeacher ? 'Bạn là học sinh?' : 'Bạn là giáo viên?' }}
              <a
                [routerLink]="isTeacher ? '/login' : '/teacher/login'"
                [state]="linkState"
                [class]="link"
              >
                Đăng nhập tại {{ isTeacher ? '/login' : '/teacher/login' }}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly audience: Audience =
    inject(ActivatedRoute).snapshot.data['audience'] === 'teacher' ? 'teacher' : 'student';
  protected readonly isTeacher = this.audience === 'teacher';
  private readonly from = navigationFrom(this.router);
  protected readonly linkState = this.from ? { from: this.from } : undefined;
  protected readonly link = LINK;

  protected readonly phone = signal('');
  protected readonly password = signal('');
  protected readonly errors = signal<FormErrors>({});
  protected readonly busy = signal(false);

  constructor() {
    // Keyed on user(), never on the token: a stored token alone is not a session.
    effect(() => {
      const u = this.auth.user();
      if (u) void this.router.navigateByUrl(postLoginPath(u, this.from), { replaceUrl: true });
    });
  }

  protected val = (e: Event): string => (e.target as HTMLInputElement).value;

  protected setPhone(v: string): void {
    this.phone.set(v);
    this.refresh({ phoneNumber: v, password: this.password() });
  }
  protected setPassword(v: string): void {
    this.password.set(v);
    this.refresh({ phoneNumber: this.phone(), password: v });
  }
  private refresh(values: LoginBody): void {
    this.errors.update((prev) => refreshErrors(prev, validateLoginForm, values));
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const found = validateLoginForm({ phoneNumber: this.phone(), password: this.password() });
    this.errors.set(found);
    const first = LOGIN_ORDER.find((k) => found[k]);
    if (first) return focusField(this.host.nativeElement, first);

    this.busy.set(true);
    this.auth
      .login(this.audience, {
        phoneNumber: normalizePhone(this.phone()),
        password: this.password(),
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) =>
          void this.router.navigateByUrl(postLoginPath(r.user, this.from), { replaceUrl: true }),
        error: (err: unknown) => {
          const f = fieldFailure(err, LOGIN_ORDER);
          if (f) {
            this.errors.set({ [f.field]: f.message });
            focusField(this.host.nativeElement, f.field);
          } else void this.alert.error(errorMessage(err));
        },
      });
  }
}
