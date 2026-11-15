// Created by Haihs on 12/11/2026
// <app-teacher-sitting-detail> at /teacher/sittings/:id: code/link/QR, schedule, classes and grants (?tab=info|grants). Port of TeacherSittingDetail.jsx (results tab arrives with M7).
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
import type { ClassDto, SittingDetail } from '@doc-to-exam/contract';
import { Subscription, finalize, map } from 'rxjs';
import { ClassesApi } from '../core/classes.api';
import { SittingsApi } from '../core/sittings.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { QrCode } from '../shared/ui/qr-code';
import { SittingGrantsTab } from '../shared/ui/sitting-grants-tab';
import { SittingResultsPanel } from '../shared/ui/sitting-results-panel';
import { Skeleton } from '../shared/ui/skeleton';
import { copyToClipboard } from '../shared/utils/browser';
import { formatDateTime } from '../shared/utils/date-format';
import { fetchAll } from '../shared/utils/fetch-all';
import { STATUS_LABEL, describeSittingError } from '../shared/utils/sitting-ui';
import { Icon } from '../shared/ui/icon';

type Tab = 'info' | 'grants' | 'results';
const TABS: [Tab, string][] = [
  ['info', 'Thông tin'],
  ['grants', 'Học sinh được vào ca'],
  ['results', 'Kết quả'],
];

@Component({
  selector: 'app-teacher-sitting-detail',
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // imports: [RouterLink, QrCode, SittingGrantsTab, SittingResultsPanel, Skeleton],
  imports: [RouterLink, QrCode, SittingGrantsTab, SittingResultsPanel, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <a
        routerLink="/teacher/sittings"
        class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400"
        >← Ca thi</a
      >
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (notFound()) {
        <div role="alert"><h1 class="text-xl font-bold">Không tìm thấy ca thi</h1></div>
      } @else if (loadError()) {
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
      } @else if (s(); as s) {
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="break-words text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {{ s.title }}
            </h1>
            <p class="text-base text-gray-600 dark:text-gray-400">
              {{ label[s.status] }} · Đề mẫu: {{ s.templateTitle
              }}{{
                s.templateStatus === 'deleted'
                  ? ' (đã xóa)'
                  : s.templateStatus === 'purged'
                    ? ' (đã bị xóa vĩnh viễn)'
                    : ''
              }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a [routerLink]="['/teacher/sittings', s.id, 'edit']" class="btn-secondary"
              >Sửa ca thi</a
            >
            <button type="button" class="btn-danger" [disabled]="busy()" (click)="remove()">
              Xóa ca thi
            </button>
          </div>
        </header>
        @if (s.locked) {
          <p
            role="note"
            class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          >
            Ca đang mở và
            {{ s.lockReason === 'HAS_SUBMISSIONS' ? 'đã có bài nộp' : 'có học sinh đang làm bài' }}:
            không sửa được câu hỏi.
          </p>
        }

        <div
          role="tablist"
          aria-label="Chi tiết ca thi"
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
                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400'
              "
            >
              {{ t[1] }}
            </button>
          }
        </div>

        <div role="tabpanel">
          @if (tab() === 'info') {
            <div class="grid gap-6 md:grid-cols-2">
              <section
                class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                aria-label="Mã ca thi"
              >
                <h2 class="text-lg font-bold">Mã ca và link</h2>
                <p class="font-mono text-3xl font-extrabold tracking-widest">{{ s.code }}</p>
                <p class="break-all text-base">{{ link() }}</p>
                <app-qr-code [value]="link()" [size]="160" label="Link vào ca thi" />
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn-secondary" (click)="copy()">
                    Sao chép link
                  </button>
                  <button
                    type="button"
                    class="btn-danger"
                    [disabled]="busy()"
                    (click)="regenerate()"
                  >
                    Đổi mã ca
                  </button>
                </div>
              </section>
              <section
                class="space-y-2 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                aria-label="Lịch thi"
              >
                <h2 class="text-lg font-bold">Lịch thi</h2>
                <p>Mở: {{ fmt(s.openAt) }}</p>
                <p>Đóng: {{ fmt(s.closeAt) }}</p>
                <p>Thời gian làm bài: {{ s.durationMinutes }} phút</p>
                <p>
                  Số câu: {{ s.totalQuestions }} · Thang điểm: trắc nghiệm {{ s.scoring.mcqMax }},
                  tự luận {{ s.scoring.essayMax }}
                </p>
                <p>
                  Đảo câu hỏi: {{ s.shuffleQuestions ? 'Có' : 'Không' }} · Giám sát chuyển tab:
                  {{ s.antiCheat ? 'Có' : 'Không' }}
                </p>
              </section>
              <section
                class="space-y-2 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 md:col-span-2"
                aria-label="Lớp của ca"
              >
                <h2 class="text-lg font-bold">Lớp tham gia</h2>
                @for (c of allClasses(); track c.id) {
                  <label class="flex items-center gap-2 text-base"
                    ><input
                      type="checkbox"
                      [checked]="selClasses().includes(c.id)"
                      (change)="toggleClass(c.id)"
                    />
                    {{ c.name }}</label
                  >
                }
                @for (c of s.classes; track c.id) {
                  @if (!inList(c.id)) {
                    <p class="text-base text-gray-600">
                      {{ c.name || 'Lớp đã bị xóa' }}{{ c.deleted ? ' (đã xóa)' : '' }}
                    </p>
                  }
                }
                <button
                  type="button"
                  class="btn-primary"
                  [disabled]="busy() || selClasses().length === 0"
                  (click)="saveClasses()"
                >
                  Lưu danh sách lớp
                </button>
              </section>
            </div>
          } @else if (tab() === 'results') {
            <app-sitting-results-panel [sittingId]="s.id" />
          } @else {
            <app-sitting-grants-tab
              [sittingId]="s.id"
              [classIds]="s.classIds"
              [ungranted]="s.ungrantedInClassCount"
              (changed)="load(false)"
            />
          }
        </div>
      }
    </div>
  `,
})
export class TeacherSittingDetail implements OnDestroy {
  private readonly api = inject(SittingsApi);
  private readonly classesApi = inject(ClassesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly tabs = TABS;
  protected readonly label = STATUS_LABEL;
  protected readonly fmt = formatDateTime;
  private readonly rawTab = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('tab'))), {
    initialValue: null,
  });
  protected readonly tab = computed<Tab>(() =>
    TABS.some((t) => t[0] === this.rawTab()) ? (this.rawTab() as Tab) : 'info',
  );
  protected readonly s = signal<SittingDetail | null>(null);
  protected readonly allClasses = signal<ClassDto[]>([]);
  protected readonly selClasses = signal<string[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly link = computed(() => `${window.location.origin}${this.s()?.link ?? ''}`);
  private sub?: Subscription;
  private classSub?: Subscription;

  constructor() {
    this.classSub = fetchAll((p) =>
      this.classesApi.list({ view: 'active', page: p, limit: 50 }),
    ).subscribe({
      next: (l) => this.allClasses.set(l),
      error: () => this.allClasses.set([]),
    });
    this.load();
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.classSub?.unsubscribe();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }
  protected inList(id: string): boolean {
    return this.allClasses().some((c) => c.id === id);
  }

  protected load(showSkeleton = true): void {
    this.sub?.unsubscribe();
    if (showSkeleton) this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set('');
    this.sub = this.api.get(this.id).subscribe({
      next: (d) => {
        this.s.set(d);
        this.selClasses.set(d.classIds);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.s.set(null);
        if ((e as { code?: string }).code === 'NOT_FOUND') this.notFound.set(true);
        else this.loadError.set(describeSittingError(e, 'Không tải được ca thi.'));
        this.loading.set(false);
      },
    });
  }

  protected setTab(t: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: t },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected toggleClass(id: string): void {
    this.selClasses.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  protected async copy(): Promise<void> {
    const ok = await copyToClipboard(this.link());
    void (ok
      ? this.alert.success('Đã sao chép link.')
      : this.alert.error('Không sao chép được, hãy chọn và sao chép thủ công.'));
  }

  private run(op: import('rxjs').Observable<unknown>, ok: string, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        void this.alert.success(ok);
        this.load(false);
      },
      error: (e: unknown) => void this.alert.error(describeSittingError(e, fallback)),
    });
  }
  protected async regenerate(): Promise<void> {
    const ok = await this.confirm.confirm('Mã và link cũ sẽ ngừng dùng được ngay.', {
      title: 'Đổi mã ca?',
      confirmText: 'Đổi mã',
      cancelText: 'Hủy',
      danger: true,
    });
    if (ok) this.run(this.api.regenerateCode(this.id), 'Đã đổi mã ca.', 'Không đổi được mã ca.');
  }
  protected saveClasses(): void {
    this.run(
      this.api.setClasses(this.id, this.selClasses()),
      'Đã cập nhật lớp của ca.',
      'Không cập nhật được lớp.',
    );
  }
  protected async remove(): Promise<void> {
    const ok = await this.confirm.confirm('Xóa ca thi này? Ca đã có bài nộp không xóa được.', {
      title: 'Xóa ca thi?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      danger: true,
    });
    if (!ok || this.busy()) return;
    this.busy.set(true);
    this.api
      .delete(this.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/teacher/sittings']),
        error: (e: unknown) =>
          void this.alert.error(describeSittingError(e, 'Không xóa được ca thi.')),
      });
  }
}
