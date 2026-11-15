// Created by Haihs on 12/11/2026
// <app-teacher-templates> at /teacher/templates: templates (Đang dùng / Đã xoá), search, paging, AI upload, duplicate, delete, restore, purge. Port of TeacherTemplates.jsx + TemplateTrashTab.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { isApiError, type TemplateSummary } from '@doc-to-exam/contract';
import { Observable, Subscription, finalize } from 'rxjs';
import { Paged } from '../core/classes.api';
import { TemplatesApi } from '../core/templates.api';
import { ActionMenu, ActionMenuItem } from '../shared/ui/action-menu';
import { AlertService } from '../shared/ui/alert.service';
import { openApiKeyModal } from '../shared/ui/api-key-modal';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { FormField } from '../shared/ui/form-field';
import { ModalFocus } from '../shared/ui/modal-focus';
import { Pager } from '../shared/ui/pager';
import { Skeleton } from '../shared/ui/skeleton';
import {
  DRAFT_KEY,
  TRASH_RETENTION_DAYS,
  daysLeftLabel,
  describeTemplateError,
  isTitleTaken,
  validateRestoreTitle,
} from '../shared/utils/template-form';
import { Icon } from '../shared/ui/icon';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_UPLOAD = 20 * 1024 * 1024;
type View = 'active' | 'deleted';

@Component({
  selector: 'app-teacher-templates',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [RouterLink, ActionMenu, FormField, ModalFocus, Pager, Skeleton],
  imports: [RouterLink, ActionMenu, FormField, ModalFocus, Pager, Skeleton, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Đề mẫu</h1>
        <div class="flex flex-wrap gap-2">
          <input
            #file
            type="file"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            accept=".pdf,.doc,.docx,.txt"
            (change)="onFile($event)"
          />
          <button type="button" class="btn-secondary" [disabled]="parsing()" (click)="file.click()">
            {{ parsing() ? 'Đang phân tích đề...' : 'Tạo đề từ file (AI)' }}
          </button>
          <a routerLink="/teacher/templates/new" class="btn-primary">Tạo đề mẫu</a>
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
          aria-label="Tìm đề mẫu theo tên"
          placeholder="Tìm đề mẫu..."
          maxlength="100"
          class="input sm:max-w-xs"
          [value]="q()"
          (input)="onSearch($event)"
        />
      </div>
      @if (view() === 'deleted') {
        <p class="text-base text-gray-600 dark:text-gray-400">
          Đề trong mục này tự xóa vĩnh viễn sau {{ retention }} ngày. Các ca thi đã tạo từ đề không
          bị ảnh hưởng.
        </p>
      }

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
      } @else if (data(); as d) {
        @if (rows().length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            {{
              view() === 'deleted'
                ? 'Mục Đã xoá đang trống.'
                : applied
                  ? 'Không tìm thấy đề mẫu phù hợp.'
                  : 'Chưa có đề mẫu nào.'
            }}
          </p>
        }
        <ul class="space-y-3">
          @for (r of rows(); track r.t.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div class="min-w-0 flex-1">
                @if (view() === 'active') {
                  <a
                    [routerLink]="['/teacher/templates', r.t.id, 'edit']"
                    [title]="r.t.title"
                    class="line-clamp-2 font-bold text-primary-800 hover:underline dark:text-sky-400"
                    >{{ r.t.title }}</a
                  >
                } @else {
                  <span [title]="r.t.title" class="line-clamp-2 font-bold">{{ r.t.title }}</span>
                }
                <p class="text-base text-gray-600 dark:text-gray-400">
                  {{ r.t.totalQuestions }} câu · {{ r.t.sittingCount }} ca thi
                  @if (view() === 'deleted') {
                    · {{ daysLeft(r.t.daysLeft) }}
                  }
                </p>
              </div>
              <app-action-menu [items]="r.menu" [label]="'Thao tác với đề ' + r.t.title" />
            </li>
          }
        </ul>
        <app-pager
          [page]="d.page"
          [totalPages]="d.totalPages"
          [total]="d.total"
          unit="đề"
          (pageChange)="goPage($event)"
        />
      }
    </div>

    @if (restoring(); as t) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <form
          appModalFocus
          (dismissed)="restoring.set(null)"
          (submit)="submitRestore($event)"
          novalidate
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-title"
          class="w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
        >
          <h2 id="restore-title" class="text-lg font-bold">Đặt tên mới để khôi phục</h2>
          <p class="text-base text-gray-600 dark:text-gray-400">
            Tên "{{ t.title }}" đã được đề khác dùng. Nhập tên mới cho đề này.
          </p>
          <app-form-field label="Tên đề mẫu mới" [required]="true" [error]="restoreError()">
            <input
              class="input"
              name="title"
              maxlength="255"
              [value]="restoreTitle()"
              (input)="restoreTitle.set($any($event.target).value); restoreError.set('')"
            />
          </app-form-field>
          <div class="flex gap-3 pt-1">
            <button type="button" class="btn-secondary flex-1" (click)="restoring.set(null)">
              Hủy
            </button>
            <!-- Haihs: icon cho nút giống bản gốc - start -->
            <!-- đóng code cũ -->
            <!-- <button type="submit" class="btn-primary flex-1" [disabled]="busy()">Khôi phục</button> -->
            <button type="submit" class="btn-primary flex-1" [disabled]="busy()">
              <app-icon name="rotate-ccw" svgClass="h-4 w-4" /> Khôi phục
            </button>
            <!-- Haihs: icon cho nút giống bản gốc - end -->
          </div>
        </form>
      </div>
    }
  `,
})
export class TeacherTemplates implements OnDestroy {
  private readonly api = inject(TemplatesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');

  protected readonly tabs: [View, string][] = [
    ['active', 'Đang dùng'],
    ['deleted', 'Đã xoá'],
  ];
  protected readonly retention = TRASH_RETENTION_DAYS;
  protected readonly view = signal<View>('active');
  protected readonly page = signal(1);
  protected readonly q = signal('');
  protected applied = '';
  protected readonly data = signal<Paged<TemplateSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly parsing = signal(false);
  protected readonly restoring = signal<TemplateSummary | null>(null);
  protected readonly restoreTitle = signal('');
  protected readonly restoreError = signal('');
  protected readonly daysLeft = daysLeftLabel;
  private sub?: Subscription;
  private parseSub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly rows = computed(() =>
    (this.data()?.items ?? []).map((t) => {
      const menu: ActionMenuItem[] =
        this.view() === 'deleted'
          ? [
              { label: 'Khôi phục', disabled: this.busy(), onClick: () => this.restore(t) },
              {
                label: 'Xóa vĩnh viễn',
                danger: true,
                disabled: this.busy(),
                onClick: () => void this.purge(t),
              },
            ]
          : [
              { label: 'Sửa', to: `/teacher/templates/${t.id}/edit` },
              { label: 'Tạo bản sao', disabled: this.busy(), onClick: () => this.duplicate(t) },
              {
                label: 'Xóa',
                danger: true,
                disabled: this.busy(),
                onClick: () => void this.remove(t),
              },
            ];
      return { t, menu };
    }),
  );

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.parseSub?.unsubscribe();
    clearTimeout(this.timer);
  }

  /** Latest wins: the previous request is cancelled so a slow old answer cannot overwrite a newer one. */
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
          this.loadError.set(describeTemplateError(e, 'Không tải được danh sách đề mẫu.'));
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
  private reloadAfterRemove(): void {
    if (this.data()?.items.length === 1 && this.page() > 1) this.page.update((p) => p - 1);
    this.load();
  }

  /** One row action at a time (single-flight). */
  private act(op: Observable<unknown>, onOk: () => void, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: onOk,
      error: (e: unknown) => void this.alert.error(describeTemplateError(e, fallback)),
    });
  }

  protected duplicate(t: TemplateSummary): void {
    this.act(
      this.api.duplicate(t.id),
      () => {
        void this.alert.success(`Đã tạo bản sao của "${t.title}".`);
        this.page.set(1);
        this.load();
      },
      'Không thể tạo bản sao đề thi. Vui lòng thử lại.',
    );
  }

  protected async remove(t: TemplateSummary): Promise<void> {
    const ok = await this.confirm.confirm(
      `Đề "${t.title}" sẽ chuyển sang mục Đã xoá và tự xóa vĩnh viễn sau ${TRASH_RETENTION_DAYS} ngày. Các ca thi đã tạo từ đề này không bị ảnh hưởng.`,
      { title: 'Xóa đề mẫu?', confirmText: 'Xóa', cancelText: 'Hủy', danger: true },
    );
    if (ok)
      this.act(this.api.delete(t.id), () => this.reloadAfterRemove(), 'Không xóa được đề mẫu.');
  }

  protected restore(t: TemplateSummary): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .restore(t.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          void this.alert.success('Đã khôi phục đề mẫu.');
          this.reloadAfterRemove();
        },
        error: (e: unknown) => {
          if (isTitleTaken(e)) {
            this.restoreTitle.set(t.title);
            this.restoreError.set('');
            this.restoring.set(t);
          } else void this.alert.error(describeTemplateError(e, 'Không khôi phục được đề mẫu.'));
        },
      });
  }

  protected submitRestore(e: Event): void {
    e.preventDefault();
    const t = this.restoring();
    if (!t || this.busy()) return;
    const title = this.restoreTitle().trim();
    const bad = validateRestoreTitle(title);
    if (bad) return this.restoreError.set(bad);
    this.busy.set(true);
    this.api
      .restore(t.id, { title })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.restoring.set(null);
          void this.alert.success('Đã khôi phục đề mẫu.');
          this.reloadAfterRemove();
        },
        error: (err: unknown) =>
          isTitleTaken(err)
            ? this.restoreError.set('Tên này cũng đã được đề khác dùng, hãy nhập tên khác.')
            : void this.alert.error(describeTemplateError(err, 'Không khôi phục được đề mẫu.')),
      });
  }

  protected async purge(t: TemplateSummary): Promise<void> {
    const ok = await this.confirm.confirm(`Xóa vĩnh viễn đề "${t.title}"? Không thể hoàn tác.`, {
      title: 'Xóa vĩnh viễn?',
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      danger: true,
    });
    if (ok)
      this.act(this.api.purge(t.id), () => this.reloadAfterRemove(), 'Không xóa được đề mẫu.');
  }

  protected onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = ''; // the same file can be picked again
    if (!f || this.parsing()) return;
    if (f.size > MAX_UPLOAD) return void this.alert.error('Tệp vượt quá 20MB.');
    this.parsing.set(true);
    this.parseSub = this.api
      .parse(f)
      .pipe(finalize(() => this.parsing.set(false)))
      .subscribe({
        next: (exam) => {
          try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(exam)); // survives F5 like the source
          } catch {
            /* private mode: history.state still carries it */
          }
          void this.router.navigate(['/teacher/templates/new'], { state: { draftExam: exam } });
        },
        error: (err: unknown) => {
          if (isApiError(err) && err.code === 'REQUIRE_API_KEY') {
            void this.alert.error(err.message);
            openApiKeyModal();
          } else void this.alert.error(describeTemplateError(err, 'Không phân tích được đề thi.'));
        },
      });
    void this.fileInput;
  }
}
