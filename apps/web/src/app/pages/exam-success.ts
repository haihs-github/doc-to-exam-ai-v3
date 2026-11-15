// Created by Haihs on 12/11/2026
// <app-exam-success> at /ca/:code/done: confirmation after submitting (scores are never shown here). Port of ExamSuccess.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { SittingInfo } from '@doc-to-exam/contract';
import confetti from 'canvas-confetti';
import { Subscription } from 'rxjs';
import { ExamTakingApi } from '../core/exam-taking.api';
import { Icon } from '../shared/ui/icon';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { UploadLostNotice } from '../shared/ui/upload-lost-notice';
import { formatDateTime } from '../shared/utils/date-format';
import { normalizeCodeInput } from '../shared/utils/student-sitting';

export const submissionResultKey = (code: string): string => `submission_result_${code}`;

@Component({
  selector: 'app-exam-success',
  // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start
  // đóng code cũ
  // imports: [RouterLink],
  imports: [RouterLink, Icon, ThemeToggle, UploadLostNotice],
  // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start -->
    <!-- đóng code cũ -->
    <!-- <div class="mx-auto max-w-xl space-y-5 px-4 py-10 text-center"> -->
    <!-- @if (s(); as s) { -->
    <!-- <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100"> -->
    <!-- Nộp bài thành công! -->
    <!-- </h1> -->
    <!-- <p class="text-base text-gray-700 dark:text-gray-300">Ca thi: {{ s.title }}</p> -->
    <!-- @if (s.submittedAt) { -->
    <!-- <p class="text-base text-gray-600 dark:text-gray-400"> -->
    <!-- Đã nộp lúc {{ fmt(s.submittedAt) }} -->
    <div
      class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 dark:bg-gray-900"
    >
      <div class="fixed right-3 top-3 z-30"><app-theme-toggle /></div>
      <div
        class="animate-fadeIn w-full max-w-md space-y-6 rounded-xl border border-gray-200/80 bg-white p-6 text-center shadow-raised sm:p-8 dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
      >
        <div
          class="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        >
          <app-icon name="check-circle-2" svgClass="h-12 w-12" />
        </div>
        <div>
          <span
            class="badge mb-2 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300"
          >
            Đã Ghi Nhận Bài Thi
          </span>
          <h1 class="text-2xl font-extrabold text-gray-900 sm:text-3xl dark:text-gray-100">
            Nộp Bài Thành Công!
          </h1>
          <p class="mt-1 text-base text-gray-500 dark:text-gray-400">
            Bài làm của bạn đã được gửi tới hệ thống và lưu trữ an toàn.
            <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end -->
          </p>
          <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start -->
        </div>
        @if (s(); as s) {
          <div
            class="space-y-3 rounded-xl border border-gray-200/80 bg-gray-50 p-4 text-left text-base dark:border-gray-700 dark:bg-gray-700/50"
          >
            <div class="border-b border-gray-200 pb-2 dark:border-gray-700">
              <span class="block text-base text-gray-500 dark:text-gray-400">Bài thi:</span>
              <span class="font-bold text-gray-900 dark:text-gray-100">{{ s.title }}</span>
            </div>
            <div class="flex items-center gap-1 pt-1 text-base text-gray-500 dark:text-gray-400">
              <app-icon name="clock" svgClass="h-3.5 w-3.5" />
              <span>Đã nộp bài lúc {{ s.submittedAt ? fmt(s.submittedAt) || '—' : '—' }}</span>
            </div>
          </div>
          <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end -->
        }
        <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start -->
        @if (uploadLost()) {
          <app-upload-lost-notice />
        }
        <div
          class="rounded-xl border border-primary-300 bg-primary-50 p-3 text-left text-base text-primary-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-400"
        >
          <app-icon name="info" class="mr-1 -mt-1" svgClass="h-5 w-5" />
          <strong>Lưu ý:</strong> Mỗi học sinh chỉ được làm bài 01 lần duy nhất. Bạn không thể làm
          lại hoặc chỉnh sửa bài làm này.
        </div>
        <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end -->
        @if (warning()) {
          <p role="alert" class="text-base text-amber-800 dark:text-amber-300">{{ warning() }}</p>
        }
        <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start -->
        <!-- đóng code cũ -->
        <!-- <p class="text-base text-gray-600 dark:text-gray-400"> -->
        <!-- Điểm sẽ được hiển thị khi giáo viên công bố kết quả. -->
        <!-- </p> -->
        <!-- <a routerLink="/sittings" class="btn-primary inline-flex">Về danh sách ca thi</a> -->
        <!-- } @else if (loading()) { -->
        <!-- <p role="status" class="text-base">Đang tải...</p> -->
        <!-- } -->
        <div class="pt-2">
          <a
            routerLink="/"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-base font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
          >
            <app-icon name="home" svgClass="h-4 w-4" />
            <span>Trở Về Trang Chủ</span>
          </a>
        </div>
      </div>
      <!-- Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end -->
    </div>
  `,
})
export class ExamSuccess implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  private readonly router = inject(Router);
  protected readonly s = signal<SittingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly warning = signal('');
  // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start
  protected readonly uploadLost = signal(false);
  // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end
  protected readonly fmt = formatDateTime;
  private sub?: Subscription;

  constructor() {
    // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start
    try {
      void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch {
      /* decoration only */
    }
    // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end
    const code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
    try {
      const cached = JSON.parse(sessionStorage.getItem(submissionResultKey(code)) ?? 'null') as {
        warnings?: string[];
      } | null;
      // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - start
      // đóng code cũ
      // if (cached?.warnings?.length) this.warning.set(cached.warnings.join(' '));
      // server warning codes: 'upload_lost' gets the dedicated notice, anything else is shown as text
      const ws = cached?.warnings ?? [];
      this.uploadLost.set(ws.includes('upload_lost'));
      const other = ws.filter((w) => w !== 'upload_lost');
      if (other.length) this.warning.set(other.join(' '));
      // Haihs: trang nộp xong giống bản gốc (icon, confetti, thông báo mất tệp) - end
    } catch {
      /* private mode: the server answer below is enough */
    }
    this.sub = this.api.resolve(code).subscribe({
      next: (info) => {
        if (info.myState !== 'submitted') return void this.router.navigate(['/ca', code]); // not submitted: back to the entry
        this.s.set(info);
        this.loading.set(false);
      },
      error: () => void this.router.navigate(['/ca', code]),
    });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
