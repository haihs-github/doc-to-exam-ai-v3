// Created by Haihs on 12/11/2026
// <app-exam-success> at /ca/:code/done: confirmation after submitting (scores are never shown here). Port of ExamSuccess.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { SittingInfo } from '@doc-to-exam/contract';
import { Subscription } from 'rxjs';
import { ExamTakingApi } from '../core/exam-taking.api';
import { formatDateTime } from '../shared/utils/date-format';
import { normalizeCodeInput } from '../shared/utils/student-sitting';

export const submissionResultKey = (code: string): string => `submission_result_${code}`;

@Component({
  selector: 'app-exam-success',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl space-y-5 px-4 py-10 text-center">
      @if (s(); as s) {
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
          Nộp bài thành công!
        </h1>
        <p class="text-base text-gray-700 dark:text-gray-300">Ca thi: {{ s.title }}</p>
        @if (s.submittedAt) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            Đã nộp lúc {{ fmt(s.submittedAt) }}
          </p>
        }
        @if (warning()) {
          <p role="alert" class="text-base text-amber-800 dark:text-amber-300">{{ warning() }}</p>
        }
        <p class="text-base text-gray-600 dark:text-gray-400">
          Điểm sẽ được hiển thị khi giáo viên công bố kết quả.
        </p>
        <a routerLink="/sittings" class="btn-primary inline-flex">Về danh sách ca thi</a>
      } @else if (loading()) {
        <p role="status" class="text-base">Đang tải...</p>
      }
    </div>
  `,
})
export class ExamSuccess implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  private readonly router = inject(Router);
  protected readonly s = signal<SittingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly warning = signal('');
  protected readonly fmt = formatDateTime;
  private sub?: Subscription;

  constructor() {
    const code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
    try {
      const cached = JSON.parse(sessionStorage.getItem(submissionResultKey(code)) ?? 'null') as {
        warnings?: string[];
      } | null;
      if (cached?.warnings?.length) this.warning.set(cached.warnings.join(' '));
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
