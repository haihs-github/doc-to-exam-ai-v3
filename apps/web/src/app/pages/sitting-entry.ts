// Created by Haihs on 12/11/2026
// <app-sitting-entry> at /ca/:code: sitting info and the Start / Continue button. Port of SittingEntry.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { SittingInfo } from '@doc-to-exam/contract';
import { Subscription } from 'rxjs';
import { ExamTakingApi } from '../core/exam-taking.api';
// Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start
// đóng code cũ
// import { Skeleton } from '../shared/ui/skeleton';
import { Icon } from '../shared/ui/icon';
import { ThemeToggle } from '../shared/ui/theme-toggle';
// Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end
import { formatDateTime } from '../shared/utils/date-format';
import {
  STATE_STYLES,
  TakeError,
  canStartSitting,
  describeTakeError,
  myStateLabel,
  normalizeCodeInput,
} from '../shared/utils/student-sitting';

@Component({
  selector: 'app-sitting-entry',
  // Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  // imports: [RouterLink, Skeleton],
  imports: [RouterLink, Icon, ThemeToggle],
  // Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
    <!-- đóng code cũ -->
    <!-- <div class="mx-auto max-w-xl space-y-5 px-4 py-10"> -->
    <!-- Haihs: thiết kế lại cổng vào ca (nền gradient, thẻ 4 ô) - start -->
    <!-- đóng code cũ -->
    <!-- <div class="flex min-h-[70vh] items-center justify-center bg-gray-50 p-4 dark:bg-gray-900" [class.min-h-[80vh]]="s()"> -->
    <div
      class="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-primary-100 to-gray-50 px-3 pb-5 pt-14 sm:p-6 dark:from-gray-800 dark:to-gray-900"
      [class.min-h-[80vh]]="s()"
    >
    <!-- Haihs: thiết kế lại cổng vào ca (nền gradient, thẻ 4 ô) - end -->
      <div class="fixed right-3 top-3 z-30"><app-theme-toggle /></div>
      <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
      @if (loading()) {
        <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
        <!-- đóng code cũ -->
        <!-- <app-skeleton variant="list" /> -->
        <div class="space-y-3 text-center" role="status">
          <div
            class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-300 border-t-transparent dark:border-sky-400/40"
          ></div>
          <p class="text-base font-semibold text-gray-600 dark:text-gray-300">
            Đang tải thông tin ca thi...
          </p>
        </div>
        <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
      } @else if (error(); as e) {
        <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
        <!-- đóng code cũ -->
        <!-- <div role="alert" class="space-y-3"> -->
        <!-- <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100"> -->
        <!-- {{ -->
        <!-- e.kind === 'not_granted' ? 'Bạn chưa được vào ca thi này' : 'Không vào được ca thi' -->
        <!-- }} -->
        <!-- </h1> -->
        <!-- <p class="text-base text-gray-700 dark:text-gray-300">{{ e.message }}</p> -->
        <!-- <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a> -->
        <div
          role="alert"
          class="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
          >
            <app-icon
              [name]="e.kind === 'not_granted' ? 'shield-alert' : 'alert-circle'"
              svgClass="h-8 w-8"
            />
          </div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            {{ e.kind === 'not_granted' ? 'Chưa Có Quyền Vào Ca Thi' : 'Không Thể Vào Ca Thi' }}
          </h2>
          <p class="text-base text-gray-600 dark:text-gray-300">{{ e.message }}</p>
          <a
            routerLink="/sittings"
            class="inline-block rounded-xl bg-primary-700 px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
            >Về Ca thi của tôi</a
          >
          <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
        </div>
      } @else if (s(); as s) {
        <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
        <!-- đóng code cũ -->
        <!-- <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{{ s.title }}</h1> -->
        <!-- @if (s.description) { -->
        <!-- <p class="text-base text-gray-600 dark:text-gray-400">{{ s.description }}</p> -->
        <!-- } -->
        <!-- <dl class="space-y-1 text-base"> -->
        <!-- <div> -->
        <!-- <dt class="inline font-semibold">Giờ mở:</dt> -->
        <!-- <dd class="inline">{{ fmt(s.openAt) }}</dd> -->
        <!-- Haihs: thiết kế lại cổng vào ca (thẻ 4 ô thông tin, dòng 01 lần riêng) - start -->
        <!-- đóng code cũ: khối thẻ cũ giữ trong @if (legacy) -->
        @if (legacy) {
        <div
          class="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
        >
          <div
            class="border-b border-gray-200 bg-gray-100 p-6 text-gray-900 sm:p-8 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <div class="badge mb-3 bg-primary-50 dark:bg-sky-400/10">
              <app-icon name="file-question" svgClass="h-3.5 w-3.5" />
              <span>Phòng Thi Trực Tuyến</span>
            </div>
            <h1
              class="line-clamp-2 break-words text-2xl font-extrabold leading-snug sm:text-3xl"
              [attr.title]="s.title"
            >
              {{ s.title }}
            </h1>
            @if (s.description) {
              <p
                class="mt-2 line-clamp-2 whitespace-pre-line break-words text-base leading-relaxed text-gray-600 dark:text-gray-300"
                [attr.title]="s.description"
              >
                {{ s.description }}
              </p>
            }
            <div
              class="mt-6 grid grid-cols-2 gap-3 border-t border-gray-200 pt-6 text-base dark:border-gray-600"
            >
              <div class="flex items-center gap-2">
                <app-icon name="clock" svgClass="h-4 w-4 text-gray-600 dark:text-gray-300" />
                <span
                  >Thời gian: <strong>{{ s.durationMinutes }} phút</strong></span
                >
              </div>
              <div class="flex items-center gap-2">
                <app-icon
                  name="check-circle-2"
                  svgClass="h-4 w-4 text-gray-600 dark:text-gray-300"
                />
                <span
                  >Số câu hỏi: <strong>{{ s.totalQuestions }} câu</strong></span
                >
              </div>
              <div
                class="col-span-2 flex items-center gap-2 text-base text-gray-600 sm:col-span-1 dark:text-gray-300"
              >
                <app-icon
                  name="calendar"
                  class="flex-none"
                  svgClass="h-4 w-4 text-gray-600 dark:text-gray-300"
                />
                <span>Mở: {{ fmt(s.openAt) }}</span>
              </div>
              <div
                class="col-span-2 flex items-center gap-2 text-base text-gray-600 sm:col-span-1 dark:text-gray-300"
              >
                <app-icon
                  name="calendar"
                  class="flex-none"
                  svgClass="h-4 w-4 text-gray-600 dark:text-gray-300"
                />
                <span>Đóng: {{ fmt(s.closeAt) }}</span>
              </div>
            </div>
            <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
          </div>
          <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
          <!-- đóng code cũ -->
          <!-- <div> -->
          <!-- <dt class="inline font-semibold">Giờ đóng:</dt> -->
          <!-- <dd class="inline">{{ fmt(s.closeAt) }}</dd> -->
          <div class="space-y-4 p-6 sm:p-8">
            <div class="flex items-center justify-between gap-2">
              <span class="text-base text-gray-500 dark:text-gray-400"
                >Mỗi học sinh chỉ được làm bài <strong>01 lần duy nhất</strong>.</span
              >
              <span class="badge" [class]="styleOf(s)">{{ label(s) }}</span>
            </div>
            @if (canStart(s)) {
              <a
                [routerLink]="['/ca', s.code, 'room']"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3.5 text-base font-bold text-white transition-all hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
              >
                {{ s.myState === 'in_progress' ? 'Làm Tiếp Bài' : 'Bắt Đầu Làm Bài' }}
                <app-icon name="arrow-right" svgClass="h-5 w-5" />
              </a>
            }
            @if (s.myState === 'submitted') {
              <a
                [routerLink]="['/ca', s.code, s.result ? 'result' : 'done']"
                class="block w-full rounded-xl bg-green-600 px-6 py-3 text-center text-base font-bold text-white hover:bg-green-700"
                >{{ s.result ? 'Xem kết quả' : 'Xem trạng thái bài nộp' }}</a
              >
            }
            <a
              routerLink="/sittings"
              class="block text-center text-base text-gray-500 underline hover:text-primary-800 dark:text-gray-400 dark:hover:text-sky-300"
              >Về Ca thi của tôi</a
            >
            <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
          </div>
          <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - start -->
          <!-- đóng code cũ -->
          <!-- <div> -->
          <!-- <dt class="inline font-semibold">Thời gian làm bài:</dt> -->
          <!-- <dd class="inline">{{ s.durationMinutes }} phút</dd> -->
          <!-- </div> -->
          <!-- <div> -->
          <!-- <dt class="inline font-semibold">Số câu:</dt> -->
          <!-- <dd class="inline">{{ s.totalQuestions }}</dd> -->
          <!-- </div> -->
          <!-- </dl> -->
          <!-- <p> -->
          <!-- <span class="badge" [class]="styleOf(s)">{{ label(s) }}</span> -->
          <!-- </p> -->
          <!-- @if (s.antiCheat) { -->
          <!-- <p role="note" class="text-base text-amber-800 dark:text-amber-300"> -->
          <!-- Ca thi có giám sát: chuyển tab, sao chép/dán sẽ bị ghi lại. -->
          <!-- </p> -->
          <!-- } -->
          <!-- @if (canStart(s)) { -->
          <!-- <a [routerLink]="['/ca', s.code, 'room']" class="btn-primary inline-flex">{{ -->
          <!-- s.myState === 'in_progress' ? 'Làm tiếp' : 'Bắt đầu làm bài' -->
          <!-- }}</a> -->
          <!-- } -->
          <!-- @if (s.myState === 'submitted') { -->
          <!-- <a -->
          <!-- [routerLink]="['/ca', s.code, s.result ? 'result' : 'done']" -->
          <!-- class="btn-secondary inline-flex" -->
          <!-- >{{ s.result ? 'Xem kết quả' : 'Xem trạng thái bài nộp' }}</a -->
          <!-- > -->
          <!-- } -->
        </div>
        }
        <div
          class="w-full max-w-xl overflow-hidden rounded-[10px] border border-gray-200/80 bg-white shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
        >
          <div class="border-b border-gray-200 bg-gradient-to-br from-primary-100 to-primary-50 px-5 py-7 sm:px-8 dark:border-gray-600 dark:from-gray-700 dark:to-gray-800 dark:text-gray-100">
            <div class="badge mb-3 rounded-full bg-white dark:bg-gray-800">
              <app-icon name="file-question" svgClass="h-3.5 w-3.5" />
              <span>Phòng Thi Trực Tuyến</span>
            </div>
            <h1 class="line-clamp-2 break-words text-2xl font-extrabold leading-snug sm:text-3xl" [attr.title]="s.title">{{ s.title }}</h1>
            @if (s.description) {
              <p class="mt-2 line-clamp-2 whitespace-pre-line break-words text-base leading-relaxed text-gray-600 dark:text-gray-300" [attr.title]="s.description">{{ s.description }}</p>
            }
            <div class="mt-5 grid gap-2.5 sm:grid-cols-2">
            <div class="flex min-h-14 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-600 dark:bg-gray-800">
              <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-300"><app-icon name="clock" svgClass="h-4 w-4" /></span>
              <span class="min-w-0"><span class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thời gian:</span><span class="block break-words text-base"><strong>{{ s.durationMinutes }} phút</strong></span></span>
            </div>
            <div class="flex min-h-14 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-600 dark:bg-gray-800">
              <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-300"><app-icon name="check-circle-2" svgClass="h-4 w-4" /></span>
              <span class="min-w-0"><span class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số câu hỏi:</span><span class="block break-words text-base"><strong>{{ s.totalQuestions }} câu</strong></span></span>
            </div>
            <div class="flex min-h-14 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-600 dark:bg-gray-800">
              <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-300"><app-icon name="calendar" svgClass="h-4 w-4" /></span>
              <span class="min-w-0"><span class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mở:</span><span class="block break-words text-base">{{ fmt(s.openAt) }}</span></span>
            </div>
            <div class="flex min-h-14 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 dark:border-gray-600 dark:bg-gray-800">
              <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-400/10 dark:text-primary-300"><app-icon name="calendar" svgClass="h-4 w-4" /></span>
              <span class="min-w-0"><span class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đóng:</span><span class="block break-words text-base">{{ fmt(s.closeAt) }}</span></span>
            </div>
            </div>
          </div>
          <div class="flex flex-col gap-4 px-5 py-6 sm:px-8">
            <div class="flex flex-wrap items-center justify-end gap-3">
              <span class="badge max-w-full whitespace-normal rounded-full px-3 py-1 text-center text-base" [class]="styleOf(s)">{{ label(s) }}</span>
            </div>
            <div class="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-normal text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <app-icon name="info" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
              <span>Mỗi học sinh chỉ được làm bài <strong>01 lần duy nhất</strong>.</span>
            </div>
            @if (canStart(s)) {
              <a [routerLink]="['/ca', s.code, 'room']" class="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary-700 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300">
                {{ s.myState === 'in_progress' ? 'Làm Tiếp Bài' : 'Bắt Đầu Làm Bài' }}
                <app-icon name="arrow-right" svgClass="h-5 w-5" />
              </a>
            }
            @if (s.myState === 'submitted') {
              <a [routerLink]="['/ca', s.code, s.result ? 'result' : 'done']" class="flex min-h-14 w-full items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-center text-base font-bold text-white hover:bg-green-700">{{ s.result ? 'Xem kết quả' : 'Xem trạng thái bài nộp' }}</a>
            }
            <a routerLink="/sittings" class="flex min-h-11 items-center justify-center text-base text-gray-500 underline hover:text-primary-800 dark:text-gray-400 dark:hover:text-sky-300">Về Ca thi của tôi</a>
          </div>
        </div>
        <!-- Haihs: thiết kế lại cổng vào ca (thẻ 4 ô thông tin, dòng 01 lần riêng) - end -->
        <!-- Haihs: trang vào ca giống bản gốc (icon, bố cục, chữ) - end -->
      }
    </div>
  `,
})
export class SittingEntry implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  protected readonly s = signal<SittingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<TakeError | null>(null);
  protected readonly fmt = formatDateTime;
  // Haihs: cờ tắt khối template cũ (kiểu boolean để không làm hẹp kiểu s trong khối cũ) - start
  protected readonly legacy: boolean = false;
  // Haihs: cờ tắt khối template cũ (kiểu boolean để không làm hẹp kiểu s trong khối cũ) - end
  protected readonly label = (s: SittingInfo) => myStateLabel(s);
  protected readonly styleOf = (s: SittingInfo) => STATE_STYLES[s.myState];
  protected readonly canStart = (s: SittingInfo) => canStartSitting(s.myState);
  private sub?: Subscription;

  constructor() {
    const code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
    this.sub = this.api.resolve(code).subscribe({
      next: (info) => {
        this.s.set(info);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(describeTakeError(e));
        this.loading.set(false);
      },
    });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
