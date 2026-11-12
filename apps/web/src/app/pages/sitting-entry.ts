// Created by Haihs on 12/11/2026
// <app-sitting-entry> at /ca/:code: sitting info and the Start / Continue button. Port of SittingEntry.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { SittingInfo } from '@doc-to-exam/contract';
import { Subscription } from 'rxjs';
import { ExamTakingApi } from '../core/exam-taking.api';
import { Skeleton } from '../shared/ui/skeleton';
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
  imports: [RouterLink, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl space-y-5 px-4 py-10">
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (error(); as e) {
        <div role="alert" class="space-y-3">
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            {{
              e.kind === 'not_granted' ? 'Bạn chưa được vào ca thi này' : 'Không vào được ca thi'
            }}
          </h1>
          <p class="text-base text-gray-700 dark:text-gray-300">{{ e.message }}</p>
          <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a>
        </div>
      } @else if (s(); as s) {
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{{ s.title }}</h1>
        @if (s.description) {
          <p class="text-base text-gray-600 dark:text-gray-400">{{ s.description }}</p>
        }
        <dl class="space-y-1 text-base">
          <div>
            <dt class="inline font-semibold">Giờ mở:</dt>
            <dd class="inline">{{ fmt(s.openAt) }}</dd>
          </div>
          <div>
            <dt class="inline font-semibold">Giờ đóng:</dt>
            <dd class="inline">{{ fmt(s.closeAt) }}</dd>
          </div>
          <div>
            <dt class="inline font-semibold">Thời gian làm bài:</dt>
            <dd class="inline">{{ s.durationMinutes }} phút</dd>
          </div>
          <div>
            <dt class="inline font-semibold">Số câu:</dt>
            <dd class="inline">{{ s.totalQuestions }}</dd>
          </div>
        </dl>
        <p>
          <span class="badge" [class]="styleOf(s)">{{ label(s) }}</span>
        </p>
        @if (s.antiCheat) {
          <p role="note" class="text-base text-amber-800 dark:text-amber-300">
            Ca thi có giám sát: chuyển tab, sao chép/dán sẽ bị ghi lại.
          </p>
        }
        @if (canStart(s)) {
          <a [routerLink]="['/ca', s.code, 'room']" class="btn-primary inline-flex">{{
            s.myState === 'in_progress' ? 'Làm tiếp' : 'Bắt đầu làm bài'
          }}</a>
        }
        @if (s.myState === 'submitted') {
          <a
            [routerLink]="['/ca', s.code, s.result ? 'result' : 'done']"
            class="btn-secondary inline-flex"
            >{{ s.result ? 'Xem kết quả' : 'Xem trạng thái bài nộp' }}</a
          >
        }
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
