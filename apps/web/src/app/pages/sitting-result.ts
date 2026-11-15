// Created by Haihs on 12/11/2026
// <app-sitting-result> at /ca/:code/result: my score after the teacher published (scores only). Port of SittingResult.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { ExamTakingApi, ResultPayload } from '../core/exam-taking.api';
import { Icon } from '../shared/ui/icon';
import { Skeleton } from '../shared/ui/skeleton';
import { formatDateTime } from '../shared/utils/date-format';
import { normalizeCodeInput } from '../shared/utils/student-sitting';
// Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
import {
  NO_SUBMISSION_MESSAGE,
  RESULT_NOT_PUBLISHED_MESSAGE,
  RESULT_UPDATING_MESSAGE,
  REVIEWING_MESSAGE,
  formatScoreOverMax,
} from '../shared/utils/student-result';
// Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
import { isApiError } from '@doc-to-exam/contract';

@Component({
  selector: 'app-sitting-result',
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
  // đóng code cũ
  // imports: [RouterLink, Skeleton],
  imports: [RouterLink, Skeleton, Icon],
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
  // đóng code cũ
  //   template: `
  //     <div class="mx-auto max-w-xl space-y-5 px-4 py-10">
  //       @if (loading()) {
  //         <app-skeleton variant="list" />
  //       } @else if (message()) {
  //         <div role="status" class="space-y-3">
  //           <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Kết quả</h1>
  //           <p class="text-base text-gray-700 dark:text-gray-300">{{ message() }}</p>
  //           <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a>
  //         </div>
  //       } @else if (r(); as r) {
  //         <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
  //           {{ r.sitting.title }}
  //         </h1>
  //         <p class="text-base text-gray-600 dark:text-gray-400">
  //           Nộp lúc {{ fmt(r.submission.submittedAt) }}
  //         </p>
  //         <p class="text-5xl font-extrabold text-primary-700 dark:text-sky-400" aria-label="Điểm số">
  //           {{ r.summary.score }}/{{ r.summary.maxScore }}
  //         </p>
  //         @if (r.summary.essayMax > 0) {
  //           <p class="text-base">
  //             Trắc nghiệm {{ r.summary.mcqScore }}/{{ r.summary.mcqMax }} · Tự luận
  //             {{ r.summary.essayScore }}/{{ r.summary.essayMax }}
  //           </p>
  //         }
  //         @if (r.submission.reviewing) {
  //           <p role="note" class="text-base text-amber-800 dark:text-amber-300">
  //             Giáo viên đang cập nhật điểm bài của bạn.
  //           </p>
  //         }
  //         <a routerLink="/sittings" class="btn-primary inline-flex">Về danh sách ca thi</a>
  //       }
  //     </div>
  //   `,
  template: `
    @if (loading()) {
      <app-skeleton variant="list" />
    } @else if (message()) {
      <div class="mx-auto max-w-md px-4 py-12">
        <div
          class="space-y-4 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          >
            <app-icon name="alert-circle" svgClass="h-8 w-8" />
          </div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Chưa xem được kết quả</h1>
          <p role="alert" class="text-base text-gray-600 dark:text-gray-300">{{ message() }}</p>
          <div class="flex items-center justify-center gap-2">
            @if (retryable()) {
              <button
                type="button"
                (click)="load()"
                class="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-base font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <app-icon name="refresh-cw" svgClass="h-4 w-4" />Thử lại
              </button>
            }
            <a
              routerLink="/sittings"
              class="inline-block rounded-xl bg-primary-700 px-5 py-2.5 text-base font-bold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
              >Về Ca thi của tôi</a
            >
          </div>
        </div>
      </div>
    } @else if (r(); as r) {
      <div class="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section
          class="space-y-2 rounded-xl border border-gray-200 bg-white p-6 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
        >
          <h1
            class="line-clamp-2 break-words text-xl font-extrabold text-gray-900 dark:text-gray-100"
            [attr.title]="r.sitting.title"
          >
            Kết quả: {{ r.sitting.title }}
          </h1>
          <p
            class="text-3xl font-black text-green-700 dark:text-green-300"
            [attr.aria-label]="'Tổng điểm ' + over(r.summary.score, r.summary.maxScore)"
          >
            {{ over(r.summary.score, r.summary.maxScore) }}
            <span class="text-base font-semibold text-gray-500 dark:text-gray-400">điểm</span>
          </p>
          @if (r.submission.reviewing) {
            <div
              role="status"
              class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-base font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              <app-icon name="info" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
              <span>{{ reviewing }}</span>
            </div>
          }
          <div class="space-y-0.5 text-base text-gray-600 dark:text-gray-300">
            @if (r.summary.mcqMax > 0) {
              <div>Trắc nghiệm: {{ over(r.summary.mcqScore, r.summary.mcqMax) }} điểm</div>
            }
            @if (r.summary.essayMax > 0) {
              <div>Tự luận: {{ over(r.summary.essayScore, r.summary.essayMax) }} điểm</div>
            }
            @if (r.submission.submittedAt) {
              <div>Nộp lúc {{ fmt(r.submission.submittedAt) }}</div>
            }
          </div>
        </section>
        <a
          routerLink="/sittings"
          class="block text-center text-base text-gray-500 underline hover:text-primary-800 dark:text-gray-400 dark:hover:text-sky-300"
          >Về Ca thi của tôi</a
        >
      </div>
    }
  `,
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
})
export class SittingResult implements OnDestroy {
  private readonly api = inject(ExamTakingApi);
  protected readonly r = signal<ResultPayload | null>(null);
  protected readonly loading = signal(true);
  protected readonly message = signal('');
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
  protected readonly retryable = signal(false);
  protected readonly over = formatScoreOverMax;
  protected readonly reviewing = REVIEWING_MESSAGE;
  private readonly code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
  protected readonly fmt = formatDateTime;
  private sub?: Subscription;

  constructor() {
    // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
    // đóng code cũ
    // const code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));
    this.load();
  }

  /** Loads (or reloads after "Thử lại") the published result of this sitting. */
  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.message.set('');
    // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
    this.sub = this.api
      // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
      // đóng code cũ
      // .resolve(code)
      .resolve(this.code)
      // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
      .pipe(switchMap((info) => this.api.result(info.id)))
      .subscribe({
        next: (res) => {
          this.r.set(res);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          const c = isApiError(e) ? e.code : '';
          // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
          this.retryable.set(
            c !== 'RESULTS_NOT_PUBLISHED' && c !== 'RESULT_UPDATING' && c !== 'NO_SUBMISSION',
          );
          // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
          this.message.set(
            c === 'RESULTS_NOT_PUBLISHED'
              ? // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
                // đóng code cũ
                // ? 'Giáo viên chưa công bố kết quả ca thi này.'
                RESULT_NOT_PUBLISHED_MESSAGE
              : // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
                c === 'RESULT_UPDATING'
                ? // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
                  // đóng code cũ
                  // ? 'Giáo viên đang cập nhật điểm bài của bạn, hãy quay lại sau ít phút.'
                  RESULT_UPDATING_MESSAGE
                : // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
                  c === 'NO_SUBMISSION'
                  ? // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start
                    // đóng code cũ
                    // ? 'Bạn không có bài nộp trong ca thi này.'
                    // : 'Không xem được kết quả lúc này. Vui lòng thử lại.',
                    NO_SUBMISSION_MESSAGE
                  : 'Không tải được kết quả. Vui lòng thử lại.',
            // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
          );
          this.loading.set(false);
        },
      });
  }
  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - start

  // Haihs: trang kết quả học sinh giống bản gốc (icon, bố cục, chữ, thử lại) - end
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
