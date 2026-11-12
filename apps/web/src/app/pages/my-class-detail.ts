// Created by Haihs on 12/11/2026
// <app-my-class-detail> at /classes/:id: teachers and classmates (names only). Port of MyClassDetail.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClassesApi, MyClassDetail as Detail } from '../core/classes.api';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear } from '../shared/utils/class-ui';

@Component({
  selector: 'app-my-class-detail',
  imports: [RouterLink, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <a
        routerLink="/classes"
        class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400"
        >← Lớp của tôi</a
      >
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (notFound()) {
        <div role="alert" class="space-y-2">
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Không tìm thấy lớp</h1>
          <p class="text-base text-gray-600 dark:text-gray-400">
            Lớp không tồn tại, đang chờ duyệt hoặc bạn không còn trong lớp.
          </p>
        </div>
      } @else if (error()) {
        <div role="alert" class="text-base text-red-700 dark:text-red-400">
          {{ error() }}
          <button type="button" class="ml-2 font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      } @else if (cls(); as c) {
        <header>
          <h1 class="break-words text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            {{ c.name }}
          </h1>
          <p class="text-base text-gray-600 dark:text-gray-400">Mã {{ c.code }} · {{ year(c) }}</p>
          <!-- TODO(web): M5 nút vào ca thi của lớp -->
        </header>
        <section aria-label="Giáo viên">
          <h2 class="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            Giáo viên ({{ c.teachers.length }})
          </h2>
          <ul class="list-disc pl-6 text-base">
            @for (t of c.teachers; track $index) {
              <li>{{ t }}</li>
            }
          </ul>
        </section>
        <section aria-label="Bạn học">
          <h2 class="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            Bạn học ({{ c.classmates.length }})
          </h2>
          <ul class="list-disc pl-6 text-base">
            @for (s of c.classmates; track $index) {
              <li>{{ s }}</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class MyClassDetail implements OnDestroy {
  private readonly api = inject(ClassesApi);
  private readonly route = inject(ActivatedRoute);
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
