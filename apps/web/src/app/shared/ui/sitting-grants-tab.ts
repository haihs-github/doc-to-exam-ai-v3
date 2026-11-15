// Created by Haihs on 12/11/2026
// <app-sitting-grants-tab>: who may enter the sitting (list, revoke, grant all or search-and-add). Port of SittingGrantsTab.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { CandidateDto, GrantRow } from '@doc-to-exam/contract';
import { Observable, Subscription, finalize } from 'rxjs';
import { Paged } from '../../core/classes.api';
import { SittingsApi } from '../../core/sittings.api';
import { describeSittingError } from '../utils/sitting-ui';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { Pager } from './pager';
import { Skeleton } from './skeleton';
import { Icon } from './icon';

@Component({
  selector: 'app-sitting-grants-tab',
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // imports: [Pager, Skeleton],
  imports: [Pager, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5" aria-label="Học sinh được vào ca">
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn-primary" [disabled]="busy()" (click)="grantAll()">
          Cấp quyền cho cả lớp
        </button>
        <input
          type="search"
          class="input sm:max-w-xs"
          aria-label="Tìm trong danh sách được vào ca"
          placeholder="Tìm học sinh..."
          [value]="q()"
          (input)="onSearch($event)"
        />
      </div>
      @if (ungranted() > 0) {
        <p role="note" class="text-base text-amber-800 dark:text-amber-300">
          Còn {{ ungranted() }} học sinh trong lớp chưa được cấp quyền.
        </p>
      }

      <div class="space-y-2">
        <label for="grant-search" class="block text-base font-medium"
          >Thêm học sinh (tìm theo tên)</label
        >
        <input
          id="grant-search"
          type="search"
          class="input sm:max-w-xs"
          autocomplete="off"
          [value]="addQ()"
          (input)="onAddSearch($event)"
        />
        <ul class="space-y-1">
          @for (c of found()?.items ?? []; track c.id) {
            <li class="flex items-center justify-between gap-3">
              <span>{{ c.fullName }}</span>
              <button type="button" class="btn-secondary" [disabled]="busy()" (click)="grantOne(c)">
                Cấp quyền
              </button>
            </li>
          }
        </ul>
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
        @if (d.items.length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            Chưa có học sinh nào được cấp quyền.
          </p>
        }
        <ul class="space-y-2">
          @for (g of d.items; track g.studentId) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="min-w-0"
                ><span class="font-bold">{{ g.fullName }}</span>
                <span class="text-gray-600 dark:text-gray-400">
                  · {{ g.classNames.join(', ') }}</span
                >
                @if (g.submitted) {
                  <span class="badge ml-2 border-green-200 bg-green-50 text-green-700">Đã nộp</span>
                } @else if (g.hasSession) {
                  <span class="badge ml-2 border-amber-200 bg-amber-50 text-amber-800"
                    >Đang làm</span
                  >
                }
                @if (!g.inClass) {
                  <span class="badge ml-2 bg-gray-100 text-gray-700">Đã rời lớp</span>
                }
              </span>
              @if (!g.submitted) {
                <button
                  type="button"
                  class="btn-danger"
                  [disabled]="busy()"
                  [attr.aria-label]="'Thu hồi quyền của ' + g.fullName"
                  (click)="revoke(g)"
                >
                  Thu hồi
                </button>
              }
            </li>
          }
        </ul>
        <app-pager
          [page]="d.page"
          [totalPages]="d.totalPages"
          [total]="d.total"
          unit="học sinh"
          (pageChange)="goPage($event)"
        />
      }
    </section>
  `,
})
export class SittingGrantsTab implements OnDestroy {
  readonly sittingId = input.required<string>();
  readonly classIds = input.required<string[]>();
  readonly ungranted = input(0);
  readonly changed = output<void>();
  private readonly api = inject(SittingsApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly data = signal<Paged<GrantRow> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly page = signal(1);
  protected readonly q = signal('');
  protected readonly addQ = signal('');
  protected readonly found = signal<Paged<CandidateDto> | null>(null);
  private sub?: Subscription;
  private addSub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;
  private addTimer?: ReturnType<typeof setTimeout>;
  private applied = '';

  constructor() {
    queueMicrotask(() => this.load());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.addSub?.unsubscribe();
    clearTimeout(this.timer);
    clearTimeout(this.addTimer);
  }

  protected load(): void {
    this.sub?.unsubscribe(); // latest wins
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api
      .grants(this.sittingId(), { page: this.page(), q: this.applied || undefined })
      .subscribe({
        next: (r) => {
          this.data.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loadError.set(describeSittingError(e, 'Không tải được danh sách học sinh.'));
          this.loading.set(false);
        },
      });
  }
  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }
  protected onSearch(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.q.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.applied = v.trim();
      this.page.set(1);
      this.load();
    }, 300);
  }
  protected onAddSearch(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.addQ.set(v);
    clearTimeout(this.addTimer);
    this.addSub?.unsubscribe();
    if (v.trim().length < 2) return void this.found.set(null);
    this.addTimer = setTimeout(() => {
      this.addSub = this.api.candidates(this.classIds(), { q: v.trim(), limit: 10 }).subscribe({
        next: (r) => this.found.set(r),
        error: () => this.found.set(null),
      });
    }, 300);
  }

  private act(op: Observable<unknown>, ok: string, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        void this.alert.success(ok);
        this.load();
        this.changed.emit();
      },
      error: (e: unknown) => void this.alert.error(describeSittingError(e, fallback)),
    });
  }
  protected grantAll(): void {
    this.act(
      this.api.addGrants(this.sittingId(), { allInClasses: true, excludeStudentIds: [] }),
      'Đã cấp quyền cho cả lớp.',
      'Không cấp được quyền.',
    );
  }
  protected grantOne(c: CandidateDto): void {
    this.act(
      this.api.addGrants(this.sittingId(), { studentIds: [c.id] }),
      `Đã cấp quyền cho ${c.fullName}.`,
      'Không cấp được quyền.',
    );
  }
  protected async revoke(g: GrantRow): Promise<void> {
    const ok = await this.confirm.confirm(
      `Thu hồi quyền vào ca của "${g.fullName}"? Bài đang làm dở sẽ bị xóa.`,
      {
        title: 'Thu hồi quyền?',
        confirmText: 'Thu hồi',
        cancelText: 'Hủy',
        danger: true,
      },
    );
    if (ok)
      this.act(
        this.api.revokeGrants(this.sittingId(), [g.studentId]),
        'Đã thu hồi quyền.',
        'Không thu hồi được.',
      );
  }
}
