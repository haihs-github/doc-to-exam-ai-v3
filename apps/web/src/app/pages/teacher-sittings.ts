// Created by Haihs on 12/11/2026
// <app-teacher-sittings> at /teacher/sittings: my sittings with status/class filter, paging, open/edit/delete. Port of TeacherSittings.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ClassDto, SittingStatus, SittingSummary } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { ClassesApi, Paged } from '../core/classes.api';
import { SittingsApi } from '../core/sittings.api';
import { ActionMenu, ActionMenuItem } from '../shared/ui/action-menu';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Pager } from '../shared/ui/pager';
import { Skeleton } from '../shared/ui/skeleton';
import { formatDateTime } from '../shared/utils/date-format';
import { fetchAll } from '../shared/utils/fetch-all';
import { STATUS_LABEL, describeSittingError } from '../shared/utils/sitting-ui';
import { Icon } from '../shared/ui/icon';

const PAGE_SIZE = 20;
const STATUSES: SittingStatus[] = ['not_started', 'open', 'ended'];

@Component({
  selector: 'app-teacher-sittings',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [RouterLink, ActionMenu, Pager, Skeleton],
  // imports: [RouterLink, ActionMenu, Pager, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  imports: [RouterLink, ActionMenu, Pager, Skeleton, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Ca thi</h1>
        <!-- Haihs: icon cho nút giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <a routerLink="/teacher/sittings/new" class="btn-primary">Tạo ca thi</a> -->
        <a routerLink="/teacher/sittings/new" class="btn-primary"
          ><app-icon name="plus" svgClass="h-4 w-4" /> Tạo ca thi</a
        >
        <!-- Haihs: icon cho nút giống bản gốc - end -->
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-base font-medium"
          >Trạng thái
          <select
            class="input ml-2 w-auto"
            name="status"
            [value]="status()"
            (change)="setStatus($any($event.target).value)"
          >
            <option value="">Tất cả</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ label[s] }}</option>
            }
          </select>
        </label>
        <label class="text-base font-medium"
          >Lớp
          <select
            class="input ml-2 w-auto"
            name="classId"
            [value]="classId()"
            (change)="setClass($any($event.target).value)"
          >
            <option value="">Tất cả lớp</option>
            @for (c of classes(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
      </div>
      @if (loadError()) {
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
        <!-- {{ loadError() }} -->
        <!-- <button type="button" class="ml-2 font-semibold underline" (click)="load()"> -->
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>{{ loadError() }}</span>
          <button type="button" class="ml-auto font-semibold underline" (click)="load()">
            <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
            Thử lại
          </button>
        </div>
      }
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (data(); as d) {
        @if (rows().length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">Chưa có ca thi nào.</p>
        }
        <ul class="space-y-3">
          @for (r of rows(); track r.s.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="min-w-0 flex-1">
                <a
                  [routerLink]="['/teacher/sittings', r.s.id]"
                  class="line-clamp-2 font-bold text-primary-800 hover:underline dark:text-sky-400"
                  >{{ r.s.title }}</a
                >
                <p class="text-base text-gray-600 dark:text-gray-400">
                  Mã {{ r.s.code }} · {{ fmt(r.s.openAt) }} → {{ fmt(r.s.closeAt) }} ·
                  <!-- Haihs: icon cho nút giống bản gốc - start -->
                  <!-- đóng code cũ -->
                  <!-- {{ r.s.durationMinutes }} phút · {{ r.s.submittedCount }}/{{ -->
                  <!-- r.s.grantedCount -->
                  <!-- }} -->
                  {{ r.s.durationMinutes }} phút · {{ r.s.submittedCount }}/{{ r.s.grantedCount }}
                  <!-- Haihs: icon cho nút giống bản gốc - end -->
                  đã nộp
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="badge"
                  [class]="
                    r.s.status === 'open'
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  "
                  >{{ label[r.s.status] }}</span
                >
                @if (r.s.resultsPublishedAt) {
                  <span class="badge border-sky-200 bg-sky-50 text-sky-800">Đã công bố</span>
                }
                <app-action-menu [items]="r.menu" [label]="'Thao tác với ca ' + r.s.title" />
              </div>
            </li>
          }
        </ul>
        <app-pager
          [page]="d.page"
          [totalPages]="d.totalPages"
          [total]="d.total"
          unit="ca"
          (pageChange)="goPage($event)"
        />
      }
    </div>
  `,
})
export class TeacherSittings implements OnDestroy {
  private readonly api = inject(SittingsApi);
  private readonly classesApi = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly statuses = STATUSES;
  protected readonly label = STATUS_LABEL;
  protected readonly fmt = formatDateTime;
  protected readonly status = signal<'' | SittingStatus>('');
  protected readonly classId = signal('');
  protected readonly page = signal(1);
  protected readonly classes = signal<ClassDto[]>([]);
  protected readonly data = signal<Paged<SittingSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  private sub?: Subscription;
  private classSub?: Subscription;

  protected readonly rows = computed(() =>
    (this.data()?.items ?? []).map((s) => {
      const menu: ActionMenuItem[] = [
        { label: 'Xem chi tiết', to: `/teacher/sittings/${s.id}` },
        { label: 'Sửa', to: `/teacher/sittings/${s.id}/edit` },
        { label: 'Xóa', danger: true, disabled: this.busy(), onClick: () => void this.remove(s) },
      ];
      return { s, menu };
    }),
  );

  constructor() {
    this.classSub = fetchAll((p) =>
      this.classesApi.list({ view: 'active', page: p, limit: 50 }),
    ).subscribe({
      next: (list) => this.classes.set(list),
      error: () => this.classes.set([]), // the class filter is optional
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.classSub?.unsubscribe();
  }

  /** Latest wins. */
  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    const status = this.status();
    this.sub = this.api
      .list({
        page: this.page(),
        limit: PAGE_SIZE,
        status: status || undefined,
        classId: this.classId() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.data.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.data.set(null);
          this.loadError.set(describeSittingError(e, 'Không tải được danh sách ca thi.'));
          this.loading.set(false);
        },
      });
  }
  protected setStatus(v: string): void {
    this.status.set(v as '' | SittingStatus);
    this.page.set(1);
    this.load();
  }
  protected setClass(v: string): void {
    this.classId.set(v);
    this.page.set(1);
    this.load();
  }
  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  protected async remove(s: SittingSummary): Promise<void> {
    const ok = await this.confirm.confirm(
      `Xóa ca thi "${s.title}"? Học sinh sẽ không còn vào được ca. Ca đã có bài nộp không xóa được.`,
      { title: 'Xóa ca thi?', confirmText: 'Xóa', cancelText: 'Hủy', danger: true },
    );
    if (!ok || this.busy()) return;
    this.busy.set(true);
    this.api
      .delete(s.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          if (this.data()?.items.length === 1 && this.page() > 1) this.page.update((p) => p - 1);
          this.load();
        },
        error: (e: unknown) =>
          void this.alert.error(describeSittingError(e, 'Không xóa được ca thi.')),
      });
  }
}
