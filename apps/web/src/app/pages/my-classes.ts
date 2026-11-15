// Created by Haihs on 12/11/2026
// <app-my-classes> at /classes: the student's classes with membership status, leave / cancel request. Port of MyClasses.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ClassDto } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { ClassesApi } from '../core/classes.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Icon } from '../shared/ui/icon';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear } from '../shared/utils/class-ui';

@Component({
  selector: 'app-my-classes',
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  // imports: [RouterLink, Skeleton],
  imports: [RouterLink, Skeleton, Icon],
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  // đóng code cũ
  //   template: `
  //     <div class="container-fluid space-y-6 py-8">
  //       <div class="flex flex-wrap items-center justify-between gap-3">
  //         <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Lớp của tôi</h1>
  //         <a routerLink="/join" class="btn-primary">Tham gia lớp</a>
  //       </div>
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
  //       } @else {
  //         @if (!loadError() && classes().length === 0) {
  //           <p class="text-base text-gray-600 dark:text-gray-400">
  //             Bạn chưa vào lớp nào. Hãy tham gia bằng link mời của giáo viên.
  //           </p>
  //         }
  //         <ul class="space-y-3">
  //           @for (c of classes(); track c.id) {
  //             <li
  //               class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <div class="min-w-0">
  //                 @if (c.membershipStatus === 'approved') {
  //                   <a
  //                     [routerLink]="['/classes', c.id]"
  //                     class="font-bold text-primary-800 hover:underline dark:text-sky-400"
  //                     >{{ c.name }}</a
  //                   >
  //                 } @else {
  //                   <span class="font-bold">{{ c.name }}</span>
  //                 }
  //                 <p class="text-base text-gray-600 dark:text-gray-400">
  //                   Mã {{ c.code }} · {{ year(c) }}
  //                 </p>
  //               </div>
  //               <div class="flex items-center gap-2">
  //                 @if (c.membershipStatus === 'pending') {
  //                   <span
  //                     class="badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
  //                     >Chờ duyệt</span
  //                   >
  //                 }
  //                 <button type="button" class="btn-danger" [disabled]="busy()" (click)="leave(c)">
  //                   {{ c.membershipStatus === 'pending' ? 'Hủy yêu cầu' : 'Rời lớp' }}
  //                 </button>
  //               </div>
  //             </li>
  //           }
  //         </ul>
  //       }
  //     </div>
  //   `,
  template: `
    <div class="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between gap-3">
        <h1
          class="flex items-center gap-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100"
        >
          <app-icon name="graduation-cap" svgClass="h-6 w-6 text-primary-700 dark:text-sky-400" />
          Lớp của tôi
        </h1>
        <a
          routerLink="/join"
          class="flex items-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-base font-semibold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
        >
          <app-icon name="user-plus" svgClass="h-4 w-4" /> Tham gia lớp
        </a>
      </div>
      @if (loadError()) {
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
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
      } @else {
        @if (!loadError() && classes().length === 0) {
          <div
            class="rounded-xl border border-gray-200 bg-white p-8 text-center text-base text-gray-600 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:shadow-raised-dark"
          >
            Bạn chưa tham gia lớp nào. Hãy dán link mời của giáo viên ở mục
            <a routerLink="/join" class="font-semibold text-primary-700 dark:text-sky-400"
              >Tham gia lớp</a
            >.
          </div>
        }
        <ul class="space-y-3">
          @for (c of classes(); track c.id) {
            <li
              class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              @if (c.membershipStatus === 'pending') {
                <div class="flex items-center justify-between gap-3 p-4">
                  <div class="min-w-0">
                    <div
                      class="line-clamp-2 break-words font-bold text-gray-900 dark:text-gray-100"
                      [attr.title]="c.name"
                    >
                      {{ c.name }}
                    </div>
                    <div class="text-base text-gray-500 dark:text-gray-400">
                      Mã lớp {{ c.code }} · {{ year(c)
                      }}{{ c.status === 'graduated' ? ' · Đã tốt nghiệp' : '' }}
                    </div>
                  </div>
                  <span
                    class="badge border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    <app-icon name="clock" svgClass="h-3 w-3" /> Chờ duyệt
                  </span>
                  <button
                    type="button"
                    class="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/40"
                    [disabled]="busy()"
                    (click)="leave(c)"
                  >
                    Hủy yêu cầu
                  </button>
                </div>
              } @else {
                <a
                  [routerLink]="['/classes', c.id]"
                  class="flex items-center justify-between gap-3 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div class="min-w-0">
                    <div
                      class="line-clamp-2 break-words font-bold text-gray-900 dark:text-gray-100"
                      [attr.title]="c.name"
                    >
                      {{ c.name }}
                    </div>
                    <div class="text-base text-gray-500 dark:text-gray-400">
                      Mã lớp {{ c.code }} · {{ year(c)
                      }}{{ c.status === 'graduated' ? ' · Đã tốt nghiệp' : '' }}
                    </div>
                  </div>
                  <app-icon
                    name="chevron-right"
                    class="flex-none"
                    svgClass="h-4 w-4 text-gray-500 dark:text-gray-400"
                  />
                </a>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
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
        ? // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
          // đóng code cũ
          // ? `Hủy yêu cầu vào lớp "${c.name}"?`
          `Yêu cầu vào lớp "${c.name}" sẽ bị hủy. Bạn có thể xin lại bằng link mời.`
        : // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
          `Rời lớp "${c.name}"? Bạn cần link mời mới để vào lại.`,
      {
        // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
        // đóng code cũ
        // title: pending ? 'Hủy yêu cầu?' : 'Rời lớp?',
        title: pending ? 'Hủy yêu cầu tham gia lớp?' : 'Rời lớp?',
        // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
        confirmText: pending ? 'Hủy yêu cầu' : 'Rời lớp',
        // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
        // đóng code cũ
        // cancelText: 'Không',
        cancelText: pending ? 'Giữ lại' : 'Không',
        // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
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
