// Created by Haihs on 12/11/2026
// <app-my-class-detail> at /classes/:id: teachers and classmates (names only). Port of MyClassDetail.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
// Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
// đóng code cũ
// import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
import { Subscription } from 'rxjs';
import { ClassesApi, MyClassDetail as Detail } from '../core/classes.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Icon } from '../shared/ui/icon';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear } from '../shared/utils/class-ui';

@Component({
  selector: 'app-my-class-detail',
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
  //       <a
  //         routerLink="/classes"
  //         class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400"
  //         >← Lớp của tôi</a
  //       >
  //       @if (loading()) {
  //         <app-skeleton variant="list" />
  //       } @else if (notFound()) {
  //         <div role="alert" class="space-y-2">
  //           <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Không tìm thấy lớp</h1>
  //           <p class="text-base text-gray-600 dark:text-gray-400">
  //             Lớp không tồn tại, đang chờ duyệt hoặc bạn không còn trong lớp.
  //           </p>
  //         </div>
  //       } @else if (error()) {
  //         <div role="alert" class="text-base text-red-700 dark:text-red-400">
  //           {{ error() }}
  //           <button type="button" class="ml-2 font-semibold underline" (click)="load()">
  //             Thử lại
  //           </button>
  //         </div>
  //       } @else if (cls(); as c) {
  //         <header>
  //           <h1 class="break-words text-2xl font-extrabold text-gray-900 dark:text-gray-100">
  //             {{ c.name }}
  //           </h1>
  //           <p class="text-base text-gray-600 dark:text-gray-400">Mã {{ c.code }} · {{ year(c) }}</p>
  //           <!-- TODO(web): M5 nút vào ca thi của lớp -->
  //         </header>
  //         <section aria-label="Giáo viên">
  //           <h2 class="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
  //             Giáo viên ({{ c.teachers.length }})
  //           </h2>
  //           <ul class="list-disc pl-6 text-base">
  //             @for (t of c.teachers; track $index) {
  //               <li>{{ t }}</li>
  //             }
  //           </ul>
  //         </section>
  //         <section aria-label="Bạn học">
  //           <h2 class="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
  //             Bạn học ({{ c.classmates.length }})
  //           </h2>
  //           <ul class="list-disc pl-6 text-base">
  //             @for (s of c.classmates; track $index) {
  //               <li>{{ s }}</li>
  //             }
  //           </ul>
  //         </section>
  //       }
  //     </div>
  //   `,
  template: `
    <div class="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <a
        routerLink="/classes"
        class="inline-flex items-center gap-1 text-base text-gray-600 hover:text-primary-800 dark:text-gray-300 dark:hover:text-sky-300"
      >
        <app-icon name="arrow-left" svgClass="h-4 w-4" /> Lớp của tôi
      </a>
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (notFound()) {
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>Không tải được thông tin lớp.</span>
        </div>
      } @else if (error()) {
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>{{ error() }}</span>
          <button type="button" class="ml-auto font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      } @else if (cls(); as c) {
        <div>
          <h1
            class="line-clamp-2 break-words text-2xl font-extrabold text-gray-900 dark:text-gray-100"
            [attr.title]="c.name"
          >
            {{ c.name }}
          </h1>
          <p class="text-base text-gray-500 dark:text-gray-400">
            Mã lớp {{ c.code }} · {{ year(c)
            }}{{ c.status === 'graduated' ? ' · Đã tốt nghiệp' : '' }}
          </p>
        </div>
        <section
          aria-label="Giáo viên"
          class="rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
        >
          <h2 class="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100">
            <app-icon name="graduation-cap" svgClass="h-4 w-4 text-primary-700 dark:text-sky-400" />
            Giáo viên ({{ c.teachers.length }})
          </h2>
          <ul class="space-y-1 text-base text-gray-700 dark:text-gray-200">
            @for (t of c.teachers; track $index) {
              <li class="line-clamp-2 break-words" [attr.title]="t">{{ t }}</li>
            }
          </ul>
        </section>
        <section
          aria-label="Bạn học"
          class="rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
        >
          <h2 class="mb-3 flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100">
            <app-icon name="users" svgClass="h-4 w-4 text-primary-700 dark:text-sky-400" />
            Bạn cùng lớp ({{ c.classmates.length }})
          </h2>
          <ul
            class="grid gap-x-6 gap-y-1 text-base text-gray-700 sm:grid-cols-2 dark:text-gray-200"
          >
            @for (s of c.classmates; track $index) {
              <li class="line-clamp-2 break-words" [attr.title]="s">{{ s }}</li>
            }
          </ul>
        </section>
        <button
          type="button"
          (click)="leave()"
          [disabled]="leaving()"
          class="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-base font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          <app-icon name="log-out" svgClass="h-4 w-4" /> Rời lớp
        </button>
      }
    </div>
  `,
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
})
export class MyClassDetail implements OnDestroy {
  private readonly api = inject(ClassesApi);
  private readonly route = inject(ActivatedRoute);
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly leaving = signal(false);
  // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  protected readonly cls = signal<Detail | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');
  protected readonly year = (c: Detail) => formatSchoolYear(c.startYear, c.endYear);
  private sub?: Subscription;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - start
  }

  /** Leave the class (asks first); back to the class list on success. */
  protected async leave(): Promise<void> {
    const ok = await this.confirm.confirm(
      'Bạn sẽ không còn thấy lớp này. Muốn quay lại phải xin vào bằng link mời và chờ giáo viên duyệt.',
      { title: 'Rời lớp?', confirmText: 'Rời lớp', cancelText: 'Ở lại', danger: true },
    );
    if (!ok || this.leaving()) return;
    this.leaving.set(true);
    this.api.leaveMyClass(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: () => void this.router.navigate(['/classes'], { replaceUrl: true }),
      error: (e: unknown) => {
        this.leaving.set(false);
        void this.alert.error(describeClassError(e, 'Không rời được lớp.'));
      },
    });
    // Haihs: trang học sinh giống bản gốc (icon, bố cục, chữ) - end
  }

  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.sub = this.api.myClass(this.route.snapshot.paramMap.get('id') ?? '').subscribe({
      next: (c) => {
        this.cls.set(c);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        if ((e as { code?: string }).code === 'NOT_FOUND') this.notFound.set(true);
        else this.error.set(describeClassError(e, 'Không tải được lớp.'));
        this.loading.set(false);
      },
    });
  }
}
