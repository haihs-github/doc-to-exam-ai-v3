// Created by Haihs on 12/11/2026
// <app-my-classes> at /classes: the student's classes with membership status, leave / cancel request. Port of MyClasses.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ClassDto } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { ClassesApi } from '../core/classes.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear } from '../shared/utils/class-ui';

@Component({
  selector: 'app-my-classes',
  imports: [RouterLink, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Lớp của tôi</h1>
        <a routerLink="/join" class="btn-primary">Tham gia lớp</a>
      </div>
      @if (loadError()) {
        <div role="alert" class="text-base text-red-700 dark:text-red-400">
          {{ loadError() }}
          <button type="button" class="ml-2 font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      }
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else {
        @if (!loadError() && classes().length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            Bạn chưa vào lớp nào. Hãy tham gia bằng link mời của giáo viên.
          </p>
        }
        <ul class="space-y-3">
          @for (c of classes(); track c.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="min-w-0">
                @if (c.membershipStatus === 'approved') {
                  <a
                    [routerLink]="['/classes', c.id]"
                    class="font-bold text-primary-800 hover:underline dark:text-sky-400"
                    >{{ c.name }}</a
                  >
                } @else {
                  <span class="font-bold">{{ c.name }}</span>
                }
                <p class="text-base text-gray-600 dark:text-gray-400">
                  Mã {{ c.code }} · {{ year(c) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                @if (c.membershipStatus === 'pending') {
                  <span
                    class="badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    >Chờ duyệt</span
                  >
                }
                <button type="button" class="btn-danger" [disabled]="busy()" (click)="leave(c)">
                  {{ c.membershipStatus === 'pending' ? 'Hủy yêu cầu' : 'Rời lớp' }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MyClasses implements OnDestroy {
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly classes = signal<ClassDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly year = (c: ClassDto) => formatSchoolYear(c.startYear, c.endYear);
  private sub?: Subscription;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api.myClasses().subscribe({
      next: (list) => {
        this.classes.set(list);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeClassError(e, 'Không tải được danh sách lớp.'));
        this.loading.set(false);
      },
    });
  }

  protected async leave(c: ClassDto): Promise<void> {
    const pending = c.membershipStatus === 'pending';
    const ok = await this.confirm.confirm(
      pending
        ? `Hủy yêu cầu vào lớp "${c.name}"?`
        : `Rời lớp "${c.name}"? Bạn cần link mời mới để vào lại.`,
      {
        title: pending ? 'Hủy yêu cầu?' : 'Rời lớp?',
        confirmText: pending ? 'Hủy yêu cầu' : 'Rời lớp',
        cancelText: 'Không',
        danger: true,
      },
    );
    if (!ok || this.busy()) return;
    this.busy.set(true);
    this.api
      .leaveMyClass(c.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          void this.alert.success(pending ? 'Đã hủy yêu cầu.' : 'Đã rời lớp.');
          this.load();
        },
        error: (e: unknown) =>
          void this.alert.error(describeClassError(e, 'Không thực hiện được.')),
      });
  }
}
