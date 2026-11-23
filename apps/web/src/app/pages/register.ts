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
import { Icon } from '../shared/ui/icon';
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
// Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - start
// Client-only: confirmPassword is validated here and never sent to the API.
type FormValues = Values & { confirmPassword: string };
const ORDER = ['fullName', 'phoneNumber', 'password', 'confirmPassword', 'secretKey', 'geminiApiKey'];
// Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - end

@Component({
  selector: 'app-register',
  // Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start
  // đóng code cũ
  // imports: [FormField, PasswordField, RouterLink],
  imports: [FormField, PasswordField, RouterLink, Icon],
  // Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
      <!-- đóng code cũ -->
      <!-- class="max-w-md w-full bg-white dark:bg-gray-800 shadow-raised dark:shadow-raised-dark rounded-xl border border-gray-200/80 dark:border-gray-700 overflow-hidden animate-fadeIn" -->
      <div
        class="max-w-lg w-full bg-white dark:bg-gray-800 shadow-raised dark:shadow-raised-dark rounded-xl border border-gray-200/80 dark:border-gray-700 overflow-hidden animate-fadeIn"
      >
      <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
        <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
        <!-- đóng code cũ -->
        <!-- <div class="px-6 sm:px-8 pt-8 text-gray-900 dark:text-gray-100 text-left"> -->
        <div
          class="relative border-b border-gray-200 bg-gray-100 p-8 text-center text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          <div
            class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 dark:bg-sky-400/10"
          >
            <app-icon name="sparkles" svgClass="h-7 w-7 text-white" />
          </div>
        <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
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
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
              <!-- đóng code cũ -->
              <!-- <input -->
              <!-- class="input" -->
              <!-- name="fullName" -->
              <!-- type="text" -->
              <!-- autocomplete="name" -->
              <!-- placeholder="Ví dụ: Hoàng Thị Tuyến" -->
              <!-- [attr.maxlength]="fullNameMax" -->
              <!-- [value]="fullName()" -->
              <!-- (input)="set('fullName', val($event))" -->
              <!-- /> -->
              <!-- đóng code cũ: placeholder="Ví dụ: Hoàng Thị Tuyến" --> <!-- Haihs: bỏ placeholder tên theo yêu cầu người dùng - start - end -->
              <div class="relative">
                <input
                  [class]="authInput"
                  name="fullName"
                  type="text"
                  autocomplete="name"
                  [attr.maxlength]="fullNameMax"
                  [value]="fullName()"
                  (input)="set('fullName', val($event))"
                />
                <app-icon
                  name="user"
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                  svgClass="h-4 w-4 text-gray-500 dark:text-gray-400"
                />
              </div>
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
            </app-form-field>
            <app-form-field
              label="Số Điện Thoại"
              [required]="true"
              [error]="errors()['phoneNumber'] ?? ''"
            >
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
              <!-- đóng code cũ -->
              <!-- <input -->
              <!-- class="input" -->
              <!-- name="phoneNumber" -->
              <!-- type="tel" -->
              <!-- inputmode="numeric" -->
              <!-- autocomplete="tel" -->
              <!-- placeholder="0987654321" -->
              <!-- [value]="phone()" -->
              <!-- (input)="set('phoneNumber', val($event))" -->
              <!-- /> -->
              <div class="relative">
                <input
                  [class]="authInput"
                  name="phoneNumber"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  placeholder="0987654321"
                  [value]="phone()"
                  (input)="set('phoneNumber', val($event))"
                />
                <app-icon
                  name="phone"
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                  svgClass="h-4 w-4 text-gray-500 dark:text-gray-400"
                />
              </div>
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
            </app-form-field>
            <app-form-field label="Mật Khẩu" [required]="true" [error]="errors()['password'] ?? ''">
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
              <app-password-field
                name="password"
                autocomplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                leadingIcon="lock"
                [inputClass]="authInputPw"
                [value]="password()"
                (valueChange)="set('password', $event)"
              />
              <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
            </app-form-field>
            <!-- Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - start -->
            <app-form-field
              label="Nhập lại mật khẩu"
              [required]="true"
              [error]="errors()['confirmPassword'] ?? ''"
            >
              <app-password-field
                name="confirmPassword"
                autocomplete="new-password"
                placeholder="Nhập lại mật khẩu"
                leadingIcon="lock"
                [inputClass]="authInputPw"
                [value]="confirmPassword()"
                (valueChange)="set('confirmPassword', $event)"
              />
            </app-form-field>
            <!-- Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - end -->

            @if (isTeacher) {
              @if (needSecret()) { <!-- Haihs: chỉ hiện ô mã bí mật khi API bật ENABLE_TEACHER_SECRET - start - end -->
              <app-form-field
                label="Mã Bí Mật Giáo Viên (Secret Key)"
                [required]="true"
                hint="Mã xác minh đặc quyền cho giáo viên."
                [error]="errors()['secretKey'] ?? ''"
              >
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
                <app-password-field
                  name="secretKey"
                  autocomplete="off"
                  [placeholder]="secretHint"
                  leadingIcon="shield-alert"
                  inputClass="!rounded-xl !border-amber-200 !bg-amber-50/50 !py-2.5 pl-11 font-mono dark:!border-amber-800 dark:!bg-amber-900/40"
                  [value]="secretKey()"
                  (valueChange)="set('secretKey', $event)"
                />
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
              </app-form-field>
              } <!-- Haihs: đóng khối @if ô mã bí mật - start - end -->
              <div>
                <div class="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    for="geminiApiKey"
                    class="block text-base font-medium text-gray-800 dark:text-gray-200"
                  >
                    Gemini API Key (Tùy chọn / Có thể thêm sau)
                  </label>
                  <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
                  <!-- đóng code cũ -->
                  <!-- <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" class="text-sm text-primary-700 dark:text-sky-400 hover:underline">Lấy key</a> -->
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    class="flex items-center gap-0.5 text-base text-primary-700 hover:underline dark:text-sky-400"
                    >Lấy key miễn phí <app-icon name="external-link" svgClass="h-2.5 w-2.5"
                  /></a>
                  <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
                </div>
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
                <!-- đóng code cũ -->
                <!-- <input -->
                <!-- id="geminiApiKey" -->
                <!-- class="input" -->
                <!-- name="geminiApiKey" -->
                <!-- type="text" -->
                <!-- autocomplete="off" -->
                <!-- spellcheck="false" -->
                <!-- placeholder="AIzaSy..." -->
                <!-- [value]="geminiApiKey()" -->
                <!-- [attr.aria-invalid]="errors()['geminiApiKey'] ? 'true' : null" -->
                <!-- [attr.aria-describedby]="errors()['geminiApiKey'] ? 'geminiApiKey-err' : null" -->
                <!-- (input)="geminiApiKey.set(val($event))" -->
                <!-- /> -->
                <div class="relative">
                  <input
                    id="geminiApiKey"
                    [class]="authInput + ' font-mono'"
                    name="geminiApiKey"
                    type="text"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="AIzaSy..."
                    [value]="geminiApiKey()"
                    [attr.aria-invalid]="errors()['geminiApiKey'] ? 'true' : null"
                    [attr.aria-describedby]="errors()['geminiApiKey'] ? 'geminiApiKey-err' : null"
                    (input)="geminiApiKey.set(val($event))"
                  />
                  <app-icon
                    name="key-round"
                    class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
                    svgClass="h-4 w-4 text-gray-500 dark:text-gray-400"
                  />
                </div>
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
                @if (errors()['geminiApiKey']) {
                  <p
                    id="geminiApiKey-err"
                    role="alert"
                    class="mt-1 text-sm font-medium text-red-700 dark:text-red-300"
                  >
                    {{ errors()['geminiApiKey'] }}
                  </p>
                }
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
            <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
            <!-- đóng code cũ -->
            <!-- <button type="submit" class="btn-primary w-full" [disabled]="busy()"> -->
            <!-- {{ busy() ? 'Đang Tạo Tài Khoản...' : 'Đăng Ký Tài Khoản' }} -->
            <button
              type="submit"
              [disabled]="busy()"
              class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3.5 text-base font-bold text-white transition-all hover:bg-primary-800 disabled:opacity-50 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
            >
              @if (busy()) {
                <span
                  class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                ></span>
                <span>Đang Tạo Tài Khoản...</span>
              } @else {
                <app-icon name="user-plus" svgClass="h-4 w-4" />
                <span>Đăng Ký Tài Khoản</span>
              }
            <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
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
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start -->
                <!-- đóng code cũ -->
                <!-- Đăng nhập tại đây -->
                Đăng nhập ngay
                <app-icon name="arrow-right" class="inline-flex" svgClass="h-3 w-3" />
                <!-- Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end -->
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
  // Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - start
  protected readonly authInput =
    'input !rounded-xl !border-gray-200 !bg-gray-50 !py-2.5 pl-11 font-medium dark:!border-gray-700 dark:!bg-gray-700/50';
  protected readonly authInputPw =
    '!rounded-xl !border-gray-200 !bg-gray-50 !py-2.5 pl-11 font-medium dark:!border-gray-700 dark:!bg-gray-700/50';
  // Haihs: icon và kiểu ô nhập giống bản gốc cho trang tài khoản - end
  protected readonly fullNameMax = LIMITS.FULL_NAME_MAX;
  protected readonly secretHint = TEACHER_SECRET_HINT || 'Nhập secret key được cấp';

  protected readonly fullName = signal('');
  protected readonly phone = signal('');
  protected readonly password = signal('');
  protected readonly secretKey = signal('');
  protected readonly confirmPassword = signal(''); // Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - start - end
  protected readonly geminiApiKey = signal('');
  protected readonly website = signal('');
  protected readonly errors = signal<FormErrors>({});
  protected readonly busy = signal(false);
  // Haihs: cờ ENABLE_TEACHER_SECRET từ API; lỗi tải thì coi như bắt buộc (an toàn hơn) - start
  protected readonly needSecret = signal(false);
  // Haihs: cờ ENABLE_TEACHER_SECRET từ API; lỗi tải thì coi như bắt buộc (an toàn hơn) - end

  constructor() {
    // Haihs: lấy cờ mã bí mật từ API (chỉ trang giáo viên) - start
    if (this.isTeacher)
      this.auth.registerConfig().subscribe({
        next: (c) => this.needSecret.set(c.teacherSecretRequired),
        error: () => this.needSecret.set(true),
      });
    // Haihs: lấy cờ mã bí mật từ API (chỉ trang giáo viên) - end
    // Keyed on user(), never on the token: a stored token alone is not a session.
    effect(() => {
      const u = this.auth.user();
      if (u) void this.router.navigateByUrl(postLoginPath(u, this.from), { replaceUrl: true });
    });
  }

  // Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - start
  private validate = (x: FormValues) => {
    // const e = validateRegisterForm(x, { isTeacher: this.isTeacher }); // Haihs: đóng code cũ, chỉ bắt buộc mã khi API bật - start - end
    const e = validateRegisterForm(x, { isTeacher: this.isTeacher && this.needSecret() }); // Haihs: chỉ bắt buộc mã khi API bật - start - end
    if (!x.confirmPassword) e['confirmPassword'] = 'Vui lòng nhập lại mật khẩu';
    else if (x.confirmPassword !== x.password) e['confirmPassword'] = 'Mật khẩu nhập lại không khớp';
    return e;
  };
  // Haihs: thêm ô nhập lại mật khẩu theo yêu cầu người dùng - end

  // private values(): Values { // Haihs: đóng code cũ thêm trường nhập lại mật khẩu - start - end
  private values(): FormValues { // Haihs: thêm trường nhập lại mật khẩu - start - end
    return {
      confirmPassword: this.confirmPassword(), // Haihs: thêm trường nhập lại mật khẩu - start - end
      fullName: this.fullName(),
      phoneNumber: this.phone(),
      password: this.password(),
      secretKey: this.secretKey(),
    };
  }

  protected val = (e: Event): string => (e.target as HTMLInputElement).value;

  // protected set(key: keyof Values, v: string): void { // Haihs: đóng code cũ thêm trường nhập lại mật khẩu - start - end
  protected set(key: keyof FormValues, v: string): void { // Haihs: thêm trường nhập lại mật khẩu - start - end
    ({
      confirmPassword: this.confirmPassword, // Haihs: thêm trường nhập lại mật khẩu - start - end
      fullName: this.fullName,
      phoneNumber: this.phone,
      password: this.password,
      secretKey: this.secretKey,
    })[key].set(v);
    this.errors.update((prev) =>
      // Haihs: dùng validate có kiểm tra nhập lại mật khẩu - start
      // refreshErrors(
      //   prev,
      //   (x: Values) => validateRegisterForm(x, { isTeacher: this.isTeacher }),
      //   this.values(),
      // ),
      refreshErrors(prev, this.validate, this.values()),
      // Haihs: dùng validate có kiểm tra nhập lại mật khẩu - end
    );
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    // const found = validateRegisterForm(this.values(), { isTeacher: this.isTeacher }); // Haihs: đóng code cũ thêm kiểm tra nhập lại mật khẩu - start - end
    const found = this.validate(this.values()); // Haihs: thêm kiểm tra nhập lại mật khẩu - start - end
    this.errors.set(found);
    // const first = REGISTER_ORDER.find((k) => found[k]); // Haihs: đóng code cũ ô nhập lại nằm trong thứ tự focus - start - end
    const first = ORDER.find((k) => found[k]); // Haihs: ô nhập lại nằm trong thứ tự focus - start - end
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
          // secretKey: this.secretKey().trim(), // Haihs: đóng code cũ, chỉ gửi mã khi API bật - start - end
          ...(this.needSecret() && { secretKey: this.secretKey().trim() }), // Haihs: chỉ gửi mã khi API bật - start - end
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
