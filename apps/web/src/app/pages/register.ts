// Created by Haihs on 11/11/2026
// Register page for both audiences (route data `audience`); port of client/src/pages/Register.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { RegisterBody } from '@doc-to-exam/contract';
import { finalize } from 'rxjs';
import { AuthService, Audience } from '../core/auth.service';
import { errorMessage } from '../core/api-errors';
import { AlertService } from '../shared/ui/alert.service';
import { FormField } from '../shared/ui/form-field';
import { PasswordField } from '../shared/ui/password-field';
import {
  FormErrors,
  REGISTER_ORDER,
  normalizeFullName,
  normalizePhone,
  refreshErrors,
  validateRegisterForm,
} from '../shared/utils/auth-rules';
import { LIMITS } from '../shared/utils/limits';
import { postLoginPath } from '../shared/utils/auth-routing';
import { fieldFailure, focusField, navigationFrom } from './form-helpers';

// shortcut: no build-time TEACHER_SECRET_HINT yet (source VITE_TEACHER_SECRET_HINT), empty by default as in the plan; wire it when a deploy needs a hint.
const TEACHER_SECRET_HINT = '';
const LINK =
  'text-primary-700 dark:text-sky-400 hover:text-primary-800 dark:hover:text-sky-300 font-bold ml-1';

type Values = { fullName: string; phoneNumber: string; password: string; secretKey: string };

@Component({
  selector: 'app-register',
  imports: [FormField, PasswordField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <div
        class="max-w-md w-full bg-white dark:bg-gray-800 shadow-raised dark:shadow-raised-dark rounded-xl border border-gray-200/80 dark:border-gray-700 overflow-hidden animate-fadeIn"
      >
        <div class="px-6 sm:px-8 pt-8 text-gray-900 dark:text-gray-100 text-left">
          <h2 class="text-2xl font-extrabold tracking-tight">
            {{ isTeacher ? 'Đăng Ký Tài Khoản Giáo Viên' : 'Đăng Ký Tài Khoản Học Sinh' }}
          </h2>
          <p class="text-base text-gray-600 dark:text-gray-300 mt-1">
            {{
              isTeacher
                ? 'Yêu cầu mã bí mật (Secret Key) để kích hoạt quyền tạo đề và quản lý'
                : 'Tạo tài khoản để tham gia lớp bằng link mời của giáo viên'
            }}
          </p>
        </div>
        <form (submit)="submit($event)" novalidate class="p-6 sm:p-8 space-y-5">
          <div class="space-y-4">
            <app-form-field
              [label]="isTeacher ? 'Họ và Tên Giáo Viên' : 'Họ và Tên'"
              [required]="true"
              [error]="errors()['fullName'] ?? ''"
            >
              <input
                class="input"
                name="fullName"
                type="text"
                autocomplete="name"
                placeholder="Ví dụ: Hoàng Thị Tuyến"
                [attr.maxlength]="fullNameMax"
                [value]="fullName()"
                (input)="set('fullName', val($event))"
              />
            </app-form-field>
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
                (input)="set('phoneNumber', val($event))"
              />
            </app-form-field>
            <app-form-field label="Mật Khẩu" [required]="true" [error]="errors()['password'] ?? ''">
              <app-password-field
                name="password"
                autocomplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                [value]="password()"
                (valueChange)="set('password', $event)"
              />
            </app-form-field>

            @if (isTeacher) {
              <app-form-field
                label="Mã Bí Mật Giáo Viên (Secret Key)"
                [required]="true"
                hint="Mã xác minh đặc quyền cho giáo viên."
                [error]="errors()['secretKey'] ?? ''"
              >
                <app-password-field
                  name="secretKey"
                  autocomplete="off"
                  [placeholder]="secretHint"
                  [value]="secretKey()"
                  (valueChange)="set('secretKey', $event)"
                />
              </app-form-field>
              <div>
                <div class="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    for="geminiApiKey"
                    class="block text-base font-medium text-gray-800 dark:text-gray-200"
                  >
                    Gemini API Key (Tùy chọn / Có thể thêm sau)
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    class="text-sm text-primary-700 dark:text-sky-400 hover:underline"
                    >Lấy key</a
                  >
                </div>
                <input
                  id="geminiApiKey"
                  class="input"
                  name="geminiApiKey"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="AIzaSy..."
                  [value]="geminiApiKey()"
                  (input)="geminiApiKey.set(val($event))"
                />
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Key sẽ được lưu trực tiếp vào tài khoản của bạn trong cơ sở dữ liệu.
                </p>
              </div>
            }
            <!-- Honeypot (both audiences): hidden from users and screen readers; the server rejects any value.
                 The DOM name is not a browser autofill token; the payload field is still 'website'. -->
            <div aria-hidden="true" inert class="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label for="contact_site_url_x">Website</label>
              <input
                id="contact_site_url_x"
                name="contact_site_url_x"
                type="text"
                tabindex="-1"
                autocomplete="off"
                [value]="website()"
                (input)="website.set(val($event))"
              />
            </div>
          </div>
          <div class="pt-2">
            <button type="submit" class="btn-primary w-full" [disabled]="busy()">
              {{ busy() ? 'Đang Tạo Tài Khoản...' : 'Đăng Ký Tài Khoản' }}
            </button>
          </div>
          <div
            class="pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-base text-gray-600 dark:text-gray-300 space-y-2"
          >
            <div>
              {{ isTeacher ? 'Đã có tài khoản giáo viên?' : 'Đã có tài khoản?' }}
              <a
                [routerLink]="isTeacher ? '/teacher/login' : '/login'"
                [state]="linkState"
                [class]="link"
              >
                Đăng nhập tại đây
              </a>
            </div>
            <div>
              {{ isTeacher ? 'Bạn là học sinh?' : 'Bạn là giáo viên?' }}
              <a
                [routerLink]="isTeacher ? '/register' : '/teacher/register'"
                [state]="linkState"
                [class]="link"
              >
                Đăng ký tại {{ isTeacher ? '/register' : '/teacher/register' }}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class Register {
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
  protected readonly fullNameMax = LIMITS.FULL_NAME_MAX;
  protected readonly secretHint = TEACHER_SECRET_HINT || 'Nhập secret key được cấp';

  protected readonly fullName = signal('');
  protected readonly phone = signal('');
  protected readonly password = signal('');
  protected readonly secretKey = signal('');
  protected readonly geminiApiKey = signal('');
  protected readonly website = signal('');
  protected readonly errors = signal<FormErrors>({});
  protected readonly busy = signal(false);

  constructor() {
    // Keyed on user(), never on the token: a stored token alone is not a session.
    effect(() => {
      const u = this.auth.user();
      if (u) void this.router.navigateByUrl(postLoginPath(u, this.from), { replaceUrl: true });
    });
  }

  private values(): Values {
    return {
      fullName: this.fullName(),
      phoneNumber: this.phone(),
      password: this.password(),
      secretKey: this.secretKey(),
    };
  }

  protected val = (e: Event): string => (e.target as HTMLInputElement).value;

  protected set(key: keyof Values, v: string): void {
    ({
      fullName: this.fullName,
      phoneNumber: this.phone,
      password: this.password,
      secretKey: this.secretKey,
    })[key].set(v);
    this.errors.update((prev) =>
      refreshErrors(
        prev,
        (x: Values) => validateRegisterForm(x, { isTeacher: this.isTeacher }),
        this.values(),
      ),
    );
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const found = validateRegisterForm(this.values(), { isTeacher: this.isTeacher });
    this.errors.set(found);
    const first = REGISTER_ORDER.find((k) => found[k]);
    if (first) return focusField(this.host.nativeElement, first);

    const base = {
      phoneNumber: normalizePhone(this.phone()),
      fullName: normalizeFullName(this.fullName()),
      password: this.password(),
    };
    const gemini = this.geminiApiKey().trim();
    const body: RegisterBody = this.isTeacher
      ? {
          ...base,
          secretKey: this.secretKey().trim(),
          ...(gemini && { geminiApiKey: gemini }),
          website: this.website(),
        }
      : { ...base, website: this.website() };

    this.busy.set(true);
    this.auth
      .register(this.audience, body)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) =>
          void this.router.navigateByUrl(postLoginPath(r.user, this.from), { replaceUrl: true }),
        error: (err: unknown) => {
          const f = fieldFailure(err, REGISTER_ORDER);
          if (f) {
            this.errors.set({ [f.field]: f.message });
            focusField(this.host.nativeElement, f.field);
          } else void this.alert.error(errorMessage(err));
        },
      });
  }
}
