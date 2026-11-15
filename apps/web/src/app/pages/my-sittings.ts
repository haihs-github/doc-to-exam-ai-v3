// Created by Haihs on 12/11/2026
// <app-my-sittings> at /sittings: my sittings (state labels, paging) and entering a code. Port of MySittings.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { MySittingRow } from '@doc-to-exam/contract';
import { Subscription } from 'rxjs';
import { Paged } from '../core/classes.api';
import { ExamTakingApi } from '../core/exam-taking.api';
import { Icon } from '../shared/ui/icon';
import { Pager } from '../shared/ui/pager';
import { Skeleton } from '../shared/ui/skeleton';
import { formatDateTime } from '../shared/utils/date-format';
import {
  STATE_STYLES,
  describeTakeError,
  isValidCodeFormat,
  myStateLabel,
  normalizeCodeInput,
} from '../shared/utils/student-sitting';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-my-sittings',
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  // imports: [RouterLink, Pager, Skeleton],
  imports: [RouterLink, Pager, Skeleton, Icon],
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  //   template: `
  //     <div class="container-fluid space-y-6 py-8">
  //       <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Ca thi của tôi</h1>
  //       <form (submit)="go($event)" novalidate class="flex flex-wrap items-start gap-3">
  //         <div>
  //           <label for="code" class="block text-base font-medium">Nhập mã ca thi</label>
  //           <input
  //             id="code"
  //             name="code"
  //             class="input uppercase"
  //             maxlength="12"
  //             autocomplete="off"
  //             [value]="code()"
  //             (input)="code.set($any($event.target).value); codeError.set('')"
  //           />
  //           @if (codeError()) {
  //             <p role="alert" class="mt-1 text-sm font-medium text-red-700 dark:text-red-300">
  //               {{ codeError() }}
  //             </p>
  //           }
  //         </div>
  //         <button type="submit" class="btn-primary mt-7">Vào ca thi</button>
  //       </form>

  //       @if (loadError()) {
  //         <div role="alert" class="text-base text-red-700 dark:text-red-400">
  //           {{ loadError() }}
  //           <button type="button" class="ml-2 font-semibold underline" (click)="load()">
  //             Thử lại
  //           </button>
  //         </div>
  //       }
  //       @if (loading()) {
  //         <app-skeleton variant="list" />
  //       } @else if (data(); as d) {
  //         @if (d.items.length === 0) {
  //           <p class="text-base text-gray-600 dark:text-gray-400">
  //             Bạn chưa có ca thi nào. Hãy nhập mã ca hoặc chờ giáo viên cấp quyền.
  //           </p>
  //         }
  //         <ul class="space-y-3">
  //           @for (s of d.items; track s.id) {
  //             <li
  //               class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <div class="min-w-0">
  //                 <a
  //                   [routerLink]="['/ca', s.code]"
  //                   class="font-bold text-primary-800 hover:underline dark:text-sky-400"
  //                   >{{ s.title }}</a
  //                 >
  //                 <p class="text-base text-gray-600 dark:text-gray-400">
  //                   {{ fmt(s.openAt) }} → {{ fmt(s.closeAt) }} · {{ s.durationMinutes }} phút
  //                 </p>
  //               </div>
  //               <span class="badge" [class]="style(s)">{{ label(s) }}</span>
  //             </li>
  //           }
  //         </ul>
  //         <app-pager
  //           [page]="d.page"
  //           [totalPages]="d.totalPages"
  //           [total]="d.total"
  //           unit="ca"
  //           (pageChange)="goPage($event)"
  //         />
  //       }
  //     </div>
  //   `,
  template: `
    <div class="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <form
        (submit)="go($event)"
        novalidate
        class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">Nhập mã ca thi</h2>
        <div class="flex gap-2">
          <input
            id="code"
            name="code"
            type="text"
            aria-label="Mã ca thi"
            maxlength="12"
            placeholder="Ví dụ: AB3K7M"
            autocomplete="off"
            class="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-base uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-700 dark:border-gray-700 dark:bg-gray-700/50 dark:focus:ring-sky-400"
            [value]="code()"
            (input)="code.set($any($event.target).value); codeError.set('')"
          />
          <button
            type="submit"
            class="flex items-center gap-1.5 rounded-xl bg-primary-700 px-5 py-2.5 text-base font-bold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
          >
            <span>Vào ca</span>
            <app-icon name="arrow-right" svgClass="h-4 w-4" />
          </button>
        </div>
        @if (codeError()) {
          <p role="alert" class="text-base font-semibold text-red-700 dark:text-red-300">
            {{ codeError() }}
          </p>
        }
      </form>

      <div>
        <h1
          class="mb-3 flex items-center gap-2 text-xl font-extrabold text-gray-900 dark:text-gray-100"
        >
          <app-icon name="clipboard-list" svgClass="h-5 w-5 text-primary-700 dark:text-sky-400" />
          Ca thi của tôi
        </h1>
        @if (loadError()) {
          <div
            role="alert"
            class="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
          >
            <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
            <span>{{ loadError() }}</span>
            <button type="button" class="ml-auto font-semibold underline" (click)="load()">
              Thử lại
            </button>
          </div>
        }
        @if (loading()) {
          <app-skeleton variant="list" />
        } @else if (data(); as d) {
          @if (d.items.length === 0 && !loadError()) {
            <p class="text-base text-gray-500 dark:text-gray-400">
              Bạn chưa được cấp quyền vào ca thi nào. Hãy nhập mã ca do giáo viên cung cấp.
            </p>
          }
          <ul class="space-y-3">
            @for (s of d.items; track s.id) {
              <li>
                <a
                  [routerLink]="s.result ? ['/ca', s.code, 'result'] : ['/ca', s.code]"
                  class="block rounded-xl border border-gray-200 bg-white p-4 shadow-raised transition-shadow dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div
                        class="line-clamp-2 break-words font-bold text-gray-900 dark:text-gray-100"
                        [attr.title]="s.title"
                      >
                        {{ s.title }}
                      </div>
                      <div class="mt-1 text-base text-gray-500 dark:text-gray-400">
                        {{ fmt(s.openAt) }} - {{ fmt(s.closeAt) }} • {{ s.durationMinutes }} phút
                      </div>
                    </div>
                    <span class="badge" [class]="style(s)">{{ label(s) }}</span>
                  </div>
                </a>
              </li>
            }
          </ul>
          <app-pager
            [page]="d.page"
            [totalPages]="d.totalPages"
            [total]="d.total"
            unit="ca thi"
            (pageChange)="goPage($event)"
          />
        }
      </div>
    </div>
  `,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
})
export class MySittings implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  private readonly router = inject(Router);
  protected readonly fmt = formatDateTime;
  protected readonly data = signal<Paged<MySittingRow> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly page = signal(1);
  protected readonly code = signal('');
  protected readonly codeError = signal('');
  protected readonly label = (s: MySittingRow) => myStateLabel(s);
  protected readonly style = (s: MySittingRow) => STATE_STYLES[s.myState];
  private sub?: Subscription;

  constructor() {
    this.load();
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected load(): void {
    this.sub?.unsubscribe(); // latest wins
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api.list({ page: this.page(), limit: PAGE_SIZE }).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeTakeError(e).message);
        this.loading.set(false);
      },
    });
  }
  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }
  protected go(e: Event): void {
    e.preventDefault();
    const code = normalizeCodeInput(this.code());
    if (!isValidCodeFormat(code)) return this.codeError.set('Mã ca thi gồm 6 ký tự chữ và số.');
    void this.router.navigate(['/ca', code]);
  }
}
