// Created by Haihs on 12/11/2026
// <app-teacher-class-detail> at /teacher/classes/:id: header (edit / delete / restore) and tabs students | teachers | invite via ?tab=.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ClassDto } from '@doc-to-exam/contract';
import { Subscription, finalize, map } from 'rxjs';
import { ClassesApi } from '../core/classes.api';
import { AlertService } from '../shared/ui/alert.service';
import { ClassForm } from '../shared/ui/class-form';
import { ClassInviteTab } from '../shared/ui/class-invite-tab';
import { ClassRestoreCodeModal } from '../shared/ui/class-restore-code-modal';
import { ClassStudentsTab } from '../shared/ui/class-students-tab';
import { ClassTeachersTab } from '../shared/ui/class-teachers-tab';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { Skeleton } from '../shared/ui/skeleton';
import { describeClassError, formatSchoolYear, isClassCodeTaken } from '../shared/utils/class-ui';

type Tab = 'students' | 'teachers' | 'invite';
const TABS: [Tab, string][] = [
  ['students', 'Học sinh'],
  ['teachers', 'Giáo viên'],
  ['invite', 'Mời tham gia'],
];
// TODO(web): M7 thêm tab `results` (kết quả ca thi) vào TABS
const isTab = (v: unknown): v is Tab => TABS.some((t) => t[0] === v);

@Component({
  selector: 'app-teacher-class-detail',
  imports: [
    RouterLink,
    ClassForm,
    ClassInviteTab,
    ClassRestoreCodeModal,
    ClassStudentsTab,
    ClassTeachersTab,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <a
        routerLink="/teacher/classes"
        class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400"
        >← Danh sách lớp</a
      >
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (notFound()) {
        <div role="alert" class="space-y-2">
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Không tìm thấy lớp</h1>
          <p class="text-base text-gray-600 dark:text-gray-400">
            Lớp không tồn tại hoặc bạn không còn là giáo viên của lớp này.
          </p>
        </div>
      } @else if (loadError()) {
        <div role="alert" class="text-base text-red-700 dark:text-red-400">
          {{ loadError() }}
          <button type="button" class="ml-2 font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      } @else if (cls(); as c) {
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="break-words text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {{ c.name }}
            </h1>
            <p class="text-base text-gray-600 dark:text-gray-400">
              Mã {{ c.code }} · {{ year() }} ·
              {{ deleted() ? 'Đã xóa' : c.status === 'active' ? 'Đang học' : 'Đã tốt nghiệp' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            @if (deleted()) {
              <button type="button" class="btn-primary" [disabled]="busy()" (click)="restore()">
                Khôi phục
              </button>
            } @else {
              <button type="button" class="btn-secondary" (click)="editing.set(true)">
                Sửa lớp
              </button>
              <button type="button" class="btn-danger" [disabled]="busy()" (click)="remove()">
                Xóa lớp
              </button>
            }
          </div>
        </header>

        @if (!deleted()) {
          <div
            role="tablist"
            aria-label="Quản lý lớp"
            class="flex gap-2 border-b border-gray-200 dark:border-gray-700"
          >
            @for (t of tabs; track t[0]) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="tab() === t[0]"
                (click)="setTab(t[0])"
                class="-mb-px border-b-2 px-4 py-2 text-base font-semibold"
                [class]="
                  tab() === t[0]
                    ? 'border-primary-700 text-primary-700 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                "
              >
                {{ t[1] }}
              </button>
            }
          </div>
          <div role="tabpanel">
            @switch (tab()) {
              @case ('students') {
                <app-class-students-tab [classId]="c.id" [accepting]="c.status === 'active'" />
              }
              @case ('teachers') {
                <app-class-teachers-tab [classId]="c.id" />
              }
              @case ('invite') {
                <app-class-invite-tab [classId]="c.id" />
              }
            }
          </div>
        }
      }
    </div>

    @if (editing() && cls(); as c) {
      <app-class-form
        [cls]="c"
        (saved)="editing.set(false); load()"
        (cancelled)="editing.set(false)"
      />
    }
    @if (restoring() && cls(); as c) {
      <app-class-restore-code-modal
        [cls]="c"
        (restored)="restoring.set(false); load()"
        (cancelled)="restoring.set(false)"
      />
    }
  `,
})
export class TeacherClassDetail implements OnDestroy {
  private readonly api = inject(ClassesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);

  protected readonly tabs = TABS;
  private readonly rawTab = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('tab'))), {
    initialValue: null,
  });
  /** An unknown ?tab= falls back to the default instead of rendering nothing. */
  protected readonly tab = computed<Tab>(() => {
    const t = this.rawTab();
    return isTab(t) ? t : 'students';
  });

  protected readonly cls = signal<ClassDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly restoring = signal(false);
  protected readonly deleted = computed(() => Boolean(this.cls()?.deletedAt));
  protected readonly year = computed(() => {
    const c = this.cls();
    return c ? formatSchoolYear(c.startYear, c.endYear) : '';
  });
  private sub?: Subscription;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set('');
    this.sub = this.api.get(this.id).subscribe({
      next: (c) => {
        this.cls.set(c);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.cls.set(null);
        if ((e as { code?: string }).code === 'NOT_FOUND') this.notFound.set(true);
        else this.loadError.set(describeClassError(e, 'Không tải được lớp.'));
        this.loading.set(false);
      },
    });
  }

  /** ?tab= is read and written through the router; replaceUrl keeps the back button usable. */
  protected setTab(t: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: t },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected async remove(): Promise<void> {
    const c = this.cls();
    if (!c || this.busy()) return;
    const ok = await this.confirm.confirm(
      `Lớp "${c.name}" sẽ chuyển sang Thùng rác và có thể khôi phục. Mã lớp được nhả ra.`,
      { title: 'Xóa lớp?', confirmText: 'Xóa lớp', cancelText: 'Hủy', danger: true },
    );
    if (!ok) return;
    this.busy.set(true);
    this.api
      .delete(c.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/teacher/classes']),
        error: (e: unknown) => void this.alert.error(describeClassError(e, 'Không xóa được lớp.')),
      });
  }

  protected restore(): void {
    const c = this.cls();
    if (!c || this.busy()) return;
    this.busy.set(true);
    this.api
      .restore(c.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          void this.alert.success('Đã khôi phục lớp.');
          this.load();
        },
        error: (e: unknown) =>
          isClassCodeTaken(e)
            ? this.restoring.set(true)
            : void this.alert.error(describeClassError(e, 'Không khôi phục được lớp.')),
      });
  }
}
