// Created by Haihs on 12/11/2026
// <app-join-class> at /join (paste a link or token) and /join/:token (joins once). Port of JoinClass.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ClassesApi } from '../core/classes.api';
import { Icon } from '../shared/ui/icon';
import type { ClassDto } from '@doc-to-exam/contract';
import { describeClassError } from '../shared/utils/class-ui';
import { parseInviteToken } from '../shared/utils/invite-token';

// Every invalid / disabled / rotated / deleted-class token gets this one neutral text (no enumeration).
const INVALID = 'Link mời không hợp lệ hoặc đã hết hiệu lực. Hãy xin giáo viên link mới.';

@Component({
  selector: 'app-join-class',
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  // imports: [RouterLink],
  imports: [RouterLink, Icon],
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  //   template: `
  //     <div class="mx-auto max-w-lg space-y-5 px-4 py-10">
  //       <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Tham gia lớp</h1>
  //       @if (token) {
  //         @if (busy()) {
  //           <p role="status" class="text-base text-gray-600 dark:text-gray-400">
  //             Đang tham gia lớp...
  //           </p>
  //         } @else if (error()) {
  //           <p role="alert" class="text-base font-medium text-red-700 dark:text-red-400">
  //             {{ error() }}
  //           </p>
  //           <a routerLink="/join" class="btn-secondary inline-flex">Nhập link khác</a>
  //         } @else if (joined(); as c) {
  //           <div role="status" class="space-y-3">
  //             @if (c.membershipStatus === 'approved') {
  //               <p class="text-base">
  //                 Bạn đã ở trong lớp <strong>{{ c.name }}</strong
  //                 >.
  //               </p>
  //             } @else {
  //               <p class="text-base">
  //                 Đã gửi yêu cầu vào lớp <strong>{{ c.name }}</strong
  //                 >. Hãy chờ giáo viên duyệt.
  //               </p>
  //             }
  //             <a [routerLink]="home()" class="btn-primary inline-flex">Về danh sách lớp</a>
  //           </div>
  //         }
  //       } @else {
  //         <form (submit)="submit($event)" novalidate class="space-y-3">
  //           <label
  //             for="join-input"
  //             class="block text-base font-medium text-gray-800 dark:text-gray-200"
  //             >Dán link mời hoặc mã mời</label
  //           >
  //           <input
  //             id="join-input"
  //             name="invite"
  //             class="input"
  //             autocomplete="off"
  //             [value]="value()"
  //             (input)="onInput($event)"
  //           />
  //           @if (error()) {
  //             <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //               {{ error() }}
  //             </p>
  //           }
  //           <button type="submit" class="btn-primary">Tiếp tục</button>
  //         </form>
  //       }
  //     </div>
  //   `,
  template: `
    <div class="mx-auto max-w-lg space-y-6 px-4 py-10">
      <h1 class="flex items-center gap-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100">
        <app-icon name="user-plus" svgClass="h-6 w-6 text-primary-700 dark:text-sky-400" />
        Tham gia lớp
      </h1>
      @if (busy()) {
        <p role="status" class="text-base text-gray-500 dark:text-gray-400">
          Đang gửi yêu cầu tham gia...
        </p>
      }
      @if (joined(); as c) {
        <div
          role="status"
          class="space-y-2 rounded-xl border p-5 text-base"
          [class]="
            c.membershipStatus === 'pending'
              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300'
          "
        >
          <div class="flex items-center gap-2 font-bold">
            <app-icon
              [name]="c.membershipStatus === 'pending' ? 'clock' : 'check-circle-2'"
              svgClass="h-4 w-4"
            />
            {{
              c.membershipStatus === 'pending'
                ? 'Đã gửi yêu cầu, chờ giáo viên duyệt'
                : 'Bạn đã là thành viên của lớp'
            }}
          </div>
          <!-- <div>Lớp {{ c.name }} (mã {{ c.code }}, {{ c.startYear }}-{{ c.endYear }})</div> --><!-- Haihs: tên lớp dài không làm tràn ngang - start - end -->
          <div class="break-words">Lớp {{ c.name }} (mã {{ c.code }}, {{ c.startYear }}-{{ c.endYear }})</div><!-- Haihs: tên lớp dài không làm tràn ngang - start - end -->
          <a
            [routerLink]="home()"
            class="inline-block font-semibold text-primary-700 dark:text-sky-400"
            >{{ isStudent() ? 'Về Lớp của tôi' : 'Về trang chủ' }}</a
          >
        </div>
      }
      @if (tokenError()) {
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>{{ tokenError() }}</span>
        </div>
      }
      <form
        (submit)="submit($event)"
        novalidate
        class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <label
          for="join-input"
          class="block text-base font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200"
          >Dán link mời hoặc mã mời</label
        >
        <input
          id="join-input"
          name="invite"
          type="text"
          placeholder="https://.../join/... hoặc mã 43 ký tự"
          autocomplete="off"
          class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary-700 dark:border-gray-700 dark:bg-gray-700/50 dark:focus:ring-sky-400"
          [value]="value()"
          (input)="onInput($event)"
        />
        @if (formError()) {
          <p class="text-base text-red-700 dark:text-red-300">{{ formError() }}</p>
        }
        <button
          type="submit"
          class="rounded-xl bg-primary-700 px-5 py-2.5 text-base font-bold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
        >
          Tham gia
        </button>
      </form>
    </div>
  `,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
})
export class JoinClass implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ClassesApi);
  private readonly auth = inject(AuthService);
  protected readonly token = this.route.snapshot.paramMap.get('token');
  protected readonly value = signal('');
  protected readonly busy = signal(false);
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  // protected readonly error = signal('');
  protected readonly tokenError = signal('');
  protected readonly formError = signal('');
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  protected readonly joined = signal<ClassDto | null>(null);
  private sub?: Subscription;

  constructor() {
    // Exactly one request per page load, however often the view re-renders.
    if (this.token) this.join(this.token);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  protected isStudent(): boolean {
    return this.auth.user()?.role === 'student';
  }

  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  protected home(): string {
    return this.auth.user()?.role === 'teacher' ? '/teacher/classes' : '/classes';
  }

  private join(token: string): void {
    if (!parseInviteToken(token)) {
      // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
      // đóng code cũ
      // this.error.set(INVALID);
      this.tokenError.set(INVALID);
      // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
      return;
    }
    this.busy.set(true);
    this.sub = this.api.join(token).subscribe({
      next: (c) => {
        this.joined.set(c);
        this.busy.set(false);
      },
      error: (e: unknown) => {
        const code = (e as { code?: string }).code;
        // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
        // đóng code cũ
        // this.error.set(
        this.tokenError.set(
          // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
          code === 'INVITE_INVALID' ? INVALID : describeClassError(e, 'Không tham gia được lớp.'),
        );
        this.busy.set(false);
      },
    });
  }

  protected onInput(e: Event): void {
    this.value.set((e.target as HTMLInputElement).value);
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
    // đóng code cũ
    // this.error.set('');
    this.formError.set('');
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  }

  protected submit(e: Event): void {
    e.preventDefault();
    const t = parseInviteToken(this.value());
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
    // đóng code cũ
    // if (!t) return this.error.set('Link hoặc mã mời không đúng định dạng.');
    if (!t) return this.formError.set('Link hoặc mã mời không hợp lệ. Mã mời gồm đúng 43 ký tự.');
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
    void this.router.navigate(['/join', t]);
  }
}
