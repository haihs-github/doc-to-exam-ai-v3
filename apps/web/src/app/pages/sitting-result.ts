// Created by Haihs on 12/11/2026
// <app-sitting-result> at /ca/:code/result: my score after the teacher published (scores only). Port of SittingResult.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { ExamTakingApi, ResultPayload } from '../core/exam-taking.api';
import { Skeleton } from '../shared/ui/skeleton';
import { formatDateTime } from '../shared/utils/date-format';
import { normalizeCodeInput } from '../shared/utils/student-sitting';
import { isApiError } from '@doc-to-exam/contract';

@Component({
  selector: 'app-sitting-result',
  imports: [RouterLink, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl space-y-5 px-4 py-10">
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (message()) {
        <div role="status" class="space-y-3">
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Kết quả</h1>
          <p class="text-base text-gray-700 dark:text-gray-300">{{ message() }}</p>
          <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a>
        </div>
      } @else if (r(); as r) {
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
          {{ r.sitting.title }}
        </h1>
        <p class="text-base text-gray-600 dark:text-gray-400">
          Nộp lúc {{ fmt(r.submission.submittedAt) }}
        </p>
        <p class="text-5xl font-extrabold text-primary-700 dark:text-sky-400" aria-label="Điểm số">
          {{ r.summary.score }}/{{ r.summary.maxScore }}
        </p>
        @if (r.summary.essayMax > 0) {
          <p class="text-base">
            Trắc nghiệm {{ r.summary.mcqScore }}/{{ r.summary.mcqMax }} · Tự luận
            {{ r.summary.essayScore }}/{{ r.summary.essayMax }}
          </p>
        }
        @if (r.submission.reviewing) {
          <p role="note" class="text-base text-amber-800 dark:text-amber-300">
            Giáo viên đang cập nhật điểm bài của bạn.
          </p>
        }
        <a routerLink="/sittings" class="btn-primary inline-flex">Về danh sách ca thi</a>
      }
    </div>
  `,
})
export class SittingResult implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  protected readonly r = signal<ResultPayload | null>(null);
  protected readonly loading = signal(true);
  protected readonly message = signal('');
  protected readonly fmt = formatDateTime;
  private sub?: Subscription;

  constructor() {
    const code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
    this.sub = this.api
      .resolve(code)
      .pipe(switchMap((info) => this.api.result(info.id)))
      .subscribe({
        next: (res) => {
          this.r.set(res);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          const c = isApiError(e) ? e.code : '';
          this.message.set(
            c === 'RESULTS_NOT_PUBLISHED'
              ? 'Giáo viên chưa công bố kết quả ca thi này.'
              : c === 'RESULT_UPDATING'
                ? 'Giáo viên đang cập nhật điểm bài của bạn, hãy quay lại sau ít phút.'
                : c === 'NO_SUBMISSION'
                  ? 'Bạn không có bài nộp trong ca thi này.'
                  : 'Không xem được kết quả lúc này. Vui lòng thử lại.',
          );
          this.loading.set(false);
        },
      });
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
