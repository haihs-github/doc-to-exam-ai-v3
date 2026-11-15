// Created by Haihs on 12/11/2026
// <app-teacher-classes> at /teacher/classes: my classes (Đang hoạt động / Thùng rác), debounced search, paging, create/edit/delete/restore.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ClassBody, ClassDto } from '@doc-to-exam/contract';
import { Observable, Subscription, finalize } from 'rxjs';
import { ClassesApi, Paged } from '../core/classes.api';
import { ActionMenu, ActionMenuItem } from '../shared/ui/action-menu';
import { AlertService } from '../shared/ui/alert.service';
import { ClassForm } from '../shared/ui/class-form';
import { ClassRestoreCodeModal } from '../shared/ui/class-restore-code-modal';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Pager } from '../shared/ui/pager';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear, isClassCodeTaken } from '../shared/utils/class-ui';
import { Icon } from '../shared/ui/icon';

const PAGE_SIZE = 10; // server default 10, max 50
const SEARCH_DEBOUNCE_MS = 300;
type View = 'active' | 'graduated' | 'deleted';
const TABS: [View, string][] = [
  ['active', 'Đang hoạt động'],
  ['graduated', 'Đã tốt nghiệp'],
  ['deleted', 'Thùng rác'],
];

@Component({
  selector: 'app-teacher-classes',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [RouterLink, ActionMenu, ClassForm, ClassRestoreCodeModal, Pager, Skeleton],
  imports: [RouterLink, ActionMenu, ClassForm, ClassRestoreCodeModal, Pager, Skeleton, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Lớp học</h1> -->
        <h1
          class="flex items-center gap-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100"
        >
          <app-icon name="graduation-cap" svgClass="h-6 w-6 text-primary-700 dark:text-sky-400" />
          Lớp học
        </h1>
        <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end -->
        <div class="flex gap-2">
          <!-- Haihs: icon cho nút giống bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <a routerLink="/join" class="btn-secondary">Tham gia lớp bằng link</a> -->
          <a routerLink="/join" class="btn-secondary"
            ><app-icon name="user-plus" svgClass="h-4 w-4" /> Tham gia lớp bằng link</a
          >
          <!-- Haihs: icon cho nút giống bản gốc - end -->
          <button type="button" class="btn-primary" (click)="form.set({ cls: null })">
            <!-- Haihs: icon cho nút giống bản gốc - start -->
            <!-- đóng code cũ -->
            <!-- Tạo lớp -->
            <app-icon name="plus" svgClass="h-4 w-4" /> Tạo lớp
            <!-- Haihs: icon cho nút giống bản gốc - end -->
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          @for (t of tabs; track t[0]) {
            <button
              type="button"
              [attr.aria-pressed]="view() === t[0]"
              (click)="switchView(t[0])"
              class="-mb-px border-b-2 px-4 py-2 text-base font-semibold"
              [class]="
                view() === t[0]
                  ? 'border-primary-700 text-primary-700 dark:border-sky-400 dark:text-sky-400'
                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              "
            >
              {{ t[1] }}
            </button>
          }
        </div>
        <input
          type="search"
          name="q"
          aria-label="Tìm lớp theo tên hoặc mã"
          placeholder="Tìm lớp..."
          maxlength="50"
          class="input sm:max-w-xs"
          [value]="q()"
          (input)="onSearch($event)"
        />
      </div>

      @if (view() === 'graduated') {
        <p class="text-base text-gray-600 dark:text-gray-400">
          Lớp tốt nghiệp không nhận thành viên mới và không gán được vào ca mới.
        </p>
      }

      @if (loadError()) {
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-400"
        >
          <span>{{ loadError() }}</span>
          <button type="button" class="ml-auto font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      }

      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (data(); as d) {
        @if (rows().length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">{{ emptyText() }}</p>
        }
        <ul class="space-y-3">
          @for (r of rows(); track r.c.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
            >
              <div class="min-w-0 flex-1">
                @if (r.openable) {
                  <a
                    [routerLink]="['/teacher/classes', r.c.id]"
                    [title]="r.c.name"
                    class="line-clamp-2 font-bold text-primary-800 hover:underline dark:text-sky-400"
                    >{{ r.c.name }}</a
                  >
                } @else {
                  <span
                    [title]="r.c.name"
                    class="line-clamp-2 font-bold text-gray-800 dark:text-gray-100"
                    >{{ r.c.name }}</span
                  >
                }
                <p class="text-base text-gray-600 dark:text-gray-400">
                  Mã {{ r.c.code }} · {{ year(r.c)
                  }}{{ r.pending ? '' : ' · ' + r.c.studentCount + ' học sinh' }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (r.pending) {
                  <span
                    class="badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    >Chờ duyệt</span
                  >
                }
                <span
                  class="badge"
                  [class]="
                    r.deleted || r.c.status !== 'active'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                      : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300'
                  "
                  >{{
                    r.deleted ? 'Đã xoá' : r.c.status === 'active' ? 'Đang học' : 'Đã tốt nghiệp'
                  }}</span
                >
                @if (r.menu.length) {
                  <app-action-menu [items]="r.menu" [label]="'Thao tác với lớp ' + r.c.name" />
                }
              </div>
            </li>
          }
        </ul>
        <app-pager
          [page]="d.page"
          [totalPages]="d.totalPages"
          [total]="d.total"
          (pageChange)="goPage($event)"
        />
      }
    </div>

    @if (form(); as f) {
      <app-class-form [cls]="f.cls" (saved)="onSaved($event)" (cancelled)="form.set(null)" />
    }
    @if (restoring(); as c) {
      <app-class-restore-code-modal
        [cls]="c"
        (restored)="onRestored()"
        (cancelled)="restoring.set(null)"
      />
    }
  `,
})
export class TeacherClasses implements OnDestroy {
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tabs = TABS;
  protected readonly view = signal<View>('active');
  protected readonly page = signal(1);
  protected readonly q = signal(''); // text in the box
  private applied = ''; // text the list was last asked for
  protected readonly data = signal<Paged<ClassDto> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly form = signal<{ cls: ClassDto | null } | null>(null);
  protected readonly restoring = signal<ClassDto | null>(null);
  private sub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly rows = computed(() =>
    (this.data()?.items ?? []).map((c) => {
      const deleted = Boolean(c.deletedAt);
      const pending = c.membershipStatus === 'pending';
      const openable = !deleted && !pending;
      const menu: ActionMenuItem[] = deleted
        ? [{ label: 'Khôi phục', disabled: this.busy(), onClick: () => this.restore(c) }]
        : openable
          ? [
              { label: 'Xem chi tiết', to: `/teacher/classes/${c.id}` },
              { label: 'Sửa', onClick: () => this.form.set({ cls: c }) },
              {
                label: 'Xóa',
                danger: true,
                disabled: this.busy(),
                onClick: () => void this.remove(c),
              },
            ]
          : [];
      return { c, deleted, pending, openable, menu };
    }),
  );
  protected readonly emptyText = computed(() =>
    this.view() === 'deleted'
      ? 'Không có lớp nào trong thùng rác.'
      : this.view() === 'graduated'
        ? 'Chưa có lớp nào đã tốt nghiệp.'
        : this.applied
          ? 'Không tìm thấy lớp phù hợp.'
          : 'Chưa có lớp nào. Hãy tạo lớp hoặc tham gia bằng link mời.',
  );
  protected readonly year = (c: ClassDto) => formatSchoolYear(c.startYear, c.endYear);

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.timer);
  }

  /** Latest wins: unsubscribing the previous request means a slow old response can never overwrite a newer one. */
  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api
      .list({
        view: this.view(),
        page: this.page(),
        limit: PAGE_SIZE,
        q: this.applied || undefined,
      })
      .subscribe({
        next: (r) => {
          this.data.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.data.set(null);
          this.loadError.set(describeClassError(e, 'Không tải được danh sách lớp.'));
          this.loading.set(false);
        },
      });
  }

  protected switchView(v: View): void {
    this.view.set(v);
    this.page.set(1);
    this.load();
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
      const next = v.trim();
      if (next === this.applied) return;
      this.applied = next;
      this.page.set(1);
      this.load();
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Emptying the last page (delete/restore of its only row) steps back one page instead of showing a blank one. */
  private reloadAfterRemove(): void {
    if (this.data()?.items.length === 1 && this.page() > 1) this.page.update((p) => p - 1);
    this.load();
  }

  protected onSaved(body: ClassBody): void {
    const editing = this.form()?.cls;
    this.form.set(null);
    if (!editing) {
      this.view.set('active');
      this.page.set(1);
      this.load();
    } else if (body.status && body.status !== editing.status)
      this.reloadAfterRemove(); // row leaves this tab
    else this.load();
  }

  protected onRestored(): void {
    this.restoring.set(null);
    this.reloadAfterRemove();
  }

  /** One row action at a time (single-flight). */
  private act(op: Observable<unknown>, onOk: () => void, onError: (e: unknown) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({ next: onOk, error: onError });
  }

  private async remove(c: ClassDto): Promise<void> {
    const ok = await this.confirm.confirm(
      `Lớp "${c.name}" sẽ chuyển sang Thùng rác và có thể khôi phục. Mã lớp được nhả ra; nếu bị lớp khác dùng, bạn sẽ phải đặt mã mới khi khôi phục.`,
      { title: 'Xóa lớp?', confirmText: 'Xóa lớp', cancelText: 'Hủy', danger: true },
    );
    if (!ok) return;
    this.act(
      this.api.delete(c.id),
      () => this.reloadAfterRemove(),
      (e) => void this.alert.error(describeClassError(e, 'Không xóa được lớp.')),
    );
  }

  private restore(c: ClassDto): void {
    this.act(
      this.api.restore(c.id),
      () => {
        void this.alert.success('Đã khôi phục lớp.');
        this.reloadAfterRemove();
      },
      (e) =>
        isClassCodeTaken(e)
          ? this.restoring.set(c)
          : void this.alert.error(describeClassError(e, 'Không khôi phục được lớp.')),
    );
  }
}
