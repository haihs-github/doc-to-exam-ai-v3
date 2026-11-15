// Created by Haihs on 12/11/2026
// <app-sitting-editor> at /teacher/sittings/:id/edit: settings and questions of one sitting; a locked sitting keeps its questions read-only. Port of SittingEditor.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { SittingsApi } from '../core/sittings.api';
import { AlertService } from '../shared/ui/alert.service';
import { FormField } from '../shared/ui/form-field';
import { QuestionsEditor } from '../shared/ui/questions-editor';
import { Skeleton } from '../shared/ui/skeleton';
import { formatDateTime } from '../shared/utils/date-format';
import {
  EditorQuestion,
  ensureUniqueIds,
  toPayloadQuestion,
  validateQuestions,
} from '../shared/utils/exam-questions';
import { validateSittingForm } from '../shared/utils/sitting-form';
import { describeSittingError } from '../shared/utils/sitting-ui';
import { maskVnDateTime, parseVnDateTime } from '../shared/utils/vn-datetime';
import { Icon } from '../shared/ui/icon';
import { DatetimeField } from '../shared/ui/datetime-field';

@Component({
  selector: 'app-sitting-editor',
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [RouterLink, FormField, QuestionsEditor, Skeleton],
  // imports: [RouterLink, FormField, QuestionsEditor, Skeleton, Icon],
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end
  // Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - start
  // đóng code cũ
  // imports: [RouterLink, FormField, QuestionsEditor, Skeleton, Icon],
  imports: [RouterLink, FormField, QuestionsEditor, Skeleton, Icon, DatetimeField],
  // Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - end
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start -->
      <!-- đóng code cũ -->
      <!-- class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400" -->
      <!-- >← Chi tiết ca thi</a -->
      <!-- > -->
      <!-- ><app-icon name="arrow-left" svgClass="h-5 w-5" /></a> -->
      <a
        [routerLink]="['/teacher/sittings', id]"
        class="inline-flex rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        title="Về chi tiết ca"
        aria-label="Về chi tiết ca"
        ><app-icon name="arrow-left" svgClass="h-5 w-5"
      /></a>
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end -->
      @if (loading()) {
        <app-skeleton variant="list" />
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
      } @else {
        <form (submit)="save($event)" novalidate class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Sửa ca thi</h1>
            <button type="submit" class="btn-primary" [disabled]="busy()">Lưu thay đổi</button>
          </div>
          @if (locked()) {
            <p
              role="note"
              class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            >
              Ca đang mở và đã có bài nộp hoặc có học sinh đang làm bài: chỉ sửa được cài đặt, không
              sửa được câu hỏi.
            </p>
          }
          <div class="max-w-3xl space-y-4">
            <app-form-field label="Tên ca thi" [required]="true" [error]="errors()['title'] ?? ''">
              <input
                class="input"
                name="title"
                maxlength="300"
                [value]="title()"
                (input)="title.set($any($event.target).value)"
              />
            </app-form-field>
            <app-form-field label="Mô tả" [error]="errors()['description'] ?? ''">
              <input
                class="input"
                name="description"
                maxlength="300"
                [value]="description()"
                (input)="description.set($any($event.target).value)"
              />
            </app-form-field>
            <div class="grid gap-4 sm:grid-cols-3">
              <app-form-field
                label="Giờ mở ca (dd/mm/yyyy hh:mm)"
                [required]="true"
                [error]="errors()['openAt'] ?? ''"
              >
                <!-- Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - start -->
                <!-- đóng code cũ -->
                <!-- <input -->
                <!-- class="input" -->
                <!-- name="openAt" -->
                <!-- inputmode="numeric" -->
                <!-- [value]="openAt()" -->
                <!-- (input)="openAt.set(mask($event))" -->
                <!-- /> -->
                <app-datetime-field name="openAt" [(value)]="openAt" />
                <!-- Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - end -->
              </app-form-field>
              <app-form-field
                label="Giờ đóng ca"
                [required]="true"
                [error]="errors()['closeAt'] ?? ''"
              >
                <!-- Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - start -->
                <!-- đóng code cũ -->
                <!-- <input -->
                <!-- class="input" -->
                <!-- name="closeAt" -->
                <!-- inputmode="numeric" -->
                <!-- [value]="closeAt()" -->
                <!-- (input)="closeAt.set(mask($event))" -->
                <!-- /> -->
                <app-datetime-field name="closeAt" [(value)]="closeAt" />
                <!-- Haihs: ô giờ có bảng chọn ngày giờ như bản gốc - end -->
              </app-form-field>
              <app-form-field
                label="Thời gian làm bài (phút)"
                [required]="true"
                [error]="errors()['duration'] ?? ''"
              >
                <input
                  class="input"
                  name="duration"
                  inputmode="numeric"
                  [value]="duration()"
                  (input)="duration.set($any($event.target).value)"
                />
              </app-form-field>
            </div>
            <label class="flex items-center gap-2 text-base"
              ><input
                type="checkbox"
                name="shuffle"
                [checked]="shuffle()"
                (change)="shuffle.set($any($event.target).checked)"
              />
              Đảo thứ tự câu hỏi</label
            >
            <label class="flex items-center gap-2 text-base"
              ><input
                type="checkbox"
                name="antiCheat"
                [checked]="antiCheat()"
                (change)="antiCheat.set($any($event.target).checked)"
              />
              Bật giám sát chuyển tab</label
            >
          </div>
          <app-questions-editor
            [(questions)]="questions"
            [errors]="qErrors()"
            [readOnly]="locked()"
          />
        </form>
      }
    </div>
  `,
})
export class SittingEditor implements OnDestroy {
  private readonly api = inject(SittingsApi);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly openAt = signal('');
  protected readonly closeAt = signal('');
  protected readonly duration = signal('');
  protected readonly shuffle = signal(false);
  protected readonly antiCheat = signal(false);
  protected readonly questions = signal<EditorQuestion[]>([]);
  protected readonly locked = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly qErrors = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly mask = (e: Event) => maskVnDateTime((e.target as HTMLInputElement).value);
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
    this.sub = this.api.get(this.id).subscribe({
      next: (d) => {
        this.title.set(d.title);
        this.description.set(d.description);
        this.openAt.set(formatDateTime(d.openAt));
        this.closeAt.set(formatDateTime(d.closeAt));
        this.duration.set(String(d.durationMinutes));
        this.shuffle.set(d.shuffleQuestions);
        this.antiCheat.set(d.antiCheat);
        this.questions.set(ensureUniqueIds(d.questions as unknown as Record<string, unknown>[]));
        this.locked.set(d.locked);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeSittingError(e, 'Không tải được ca thi.'));
        this.loading.set(false);
      },
    });
  }

  protected save(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const errs = validateSittingForm({
      title: this.title(),
      description: this.description(),
      openAt: this.openAt(),
      closeAt: this.closeAt(),
      duration: this.duration(),
      classIds: ['x'], // classes are edited on the detail page
    });
    this.errors.set(errs);
    const qErrs = this.locked() ? {} : validateQuestions(this.questions());
    this.qErrors.set(qErrs);
    const first = Object.values(errs)[0] ?? Object.values(qErrs)[0];
    if (first) return void this.alert.error(first);
    this.busy.set(true);
    this.api
      .update(this.id, {
        title: this.title().trim(),
        description: this.description().trim(),
        openAt: (parseVnDateTime(this.openAt()) as Date).toISOString(),
        closeAt: (parseVnDateTime(this.closeAt()) as Date).toISOString(),
        durationMinutes: Number(this.duration()),
        shuffleQuestions: this.shuffle(),
        antiCheat: this.antiCheat(),
        ...(this.locked() ? {} : { questions: this.questions().map(toPayloadQuestion) }),
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (d) => {
          const extra =
            (d.updatedSubmissionsCount ?? 0) > 0
              ? ` Đã chấm lại ${d.updatedSubmissionsCount} bài đã nộp.`
              : '';
          void this.alert
            .success(`Đã lưu ca thi.${extra}`)
            .then(() => this.router.navigate(['/teacher/sittings', this.id]));
        },
        error: (err: unknown) => {
          const msg = describeSittingError(err, 'Không lưu được ca thi.');
          if ((err as { code?: string }).code === 'SITTING_TITLE_TAKEN')
            this.errors.update((m) => ({ ...m, title: msg }));
          void this.alert.error(msg);
        },
      });
  }
}
