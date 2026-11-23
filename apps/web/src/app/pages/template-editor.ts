// Created by Haihs on 12/11/2026
// <app-template-editor> at /teacher/templates/new and /:id/edit: title, description, questions; loads a parsed draft. Port of TemplateEditor.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { TemplateBody } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { TemplatesApi } from '../core/templates.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal'; // Haihs: popup xác nhận lưu đề và tạo ca thi - start - end
import { FormField } from '../shared/ui/form-field';
import { QuestionsEditor } from '../shared/ui/questions-editor';
import { Skeleton } from '../shared/ui/skeleton';
import {
  EditorQuestion,
  createMcqQuestion,
  ensureUniqueIds,
  toPayloadQuestion,
} from '../shared/utils/exam-questions';
import {
  DRAFT_KEY,
  describeTemplateError,
  isTitleTaken,
  validateTemplateForm,
} from '../shared/utils/template-form';
import { Icon } from '../shared/ui/icon';

type Draft = { title?: string; description?: string; questions?: Record<string, unknown>[] };

/** Draft from the router state (just parsed) or sessionStorage (after F5); anything malformed is ignored. */
function readDraft(): Draft | null {
  const fromState = (history.state as { draftExam?: unknown } | null)?.draftExam;
  let raw: unknown = fromState;
  if (!raw) {
    try {
      const s = sessionStorage.getItem(DRAFT_KEY);
      raw = s ? JSON.parse(s) : null;
    } catch {
      raw = null;
    }
  }
  return raw && typeof raw === 'object' && Array.isArray((raw as Draft).questions)
    ? (raw as Draft)
    : null;
}

@Component({
  selector: 'app-template-editor',
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [RouterLink, FormField, QuestionsEditor, Skeleton],
  // imports: [RouterLink, FormField, QuestionsEditor, Skeleton, Icon],
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end
  imports: [RouterLink, FormField, QuestionsEditor, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start -->
      <!-- đóng code cũ -->
      <!-- class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400" -->
      <!-- >← Đề mẫu</a -->
      <!-- > -->
      <a
        routerLink="/teacher/templates"
        class="inline-flex rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        title="Về trang Đề mẫu"
        aria-label="Về trang Đề mẫu"
        ><app-icon name="arrow-left" svgClass="h-5 w-5" /></a>
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end -->
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (loadError()) {
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
        <!-- {{ loadError() }} -->
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>{{ loadError() }}</span>
          <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
          @if (!notFound()) {
            <button type="button" class="ml-2 font-semibold underline" (click)="load()">
              Thử lại
            </button>
          }
        </div>
      } @else {
        <!-- Haihs: chừa chỗ cho nút Lưu nổi trên điện thoại - start -->
        <!-- đóng code cũ -->
        <!-- <form (submit)="save($event)" novalidate class="space-y-6"> -->
        <form (submit)="save($event)" novalidate class="space-y-6 pb-20 md:pb-0">
        <!-- Haihs: chừa chỗ cho nút Lưu nổi trên điện thoại - end -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {{ isNew ? 'Tạo đề mẫu' : 'Sửa đề mẫu' }}
            </h1>
            <div class="flex flex-wrap items-center gap-2"> <!-- Haihs: gom nút Lưu và Tạo ca thi cùng phía phải - start - end -->
            <button type="submit" class="btn-primary" [disabled]="busy()">
              {{ isNew ? 'Lưu đề mẫu' : 'Lưu thay đổi' }}
            </button>
            <!-- Haihs: nút Tạo ca thi từ đề (chỉ khi đề đã lưu) bên phải nút Lưu - start -->
            <button type="button" class="btn-secondary" [disabled]="busy()" (click)="createSitting()">
              Tạo ca thi từ đề
            </button>
            <!-- Haihs: nút Tạo ca thi từ đề (chỉ khi đề đã lưu) bên phải nút Lưu - end -->
            </div> <!-- Haihs: đóng nhóm nút - start - end -->
          </div>
          <app-form-field label="Tên đề mẫu" [required]="true" [error]="errors()['title'] ?? ''">
            <input
              class="input"
              name="title"
              maxlength="300"
              [value]="title()"
              (input)="title.set($any($event.target).value); clear('title')"
            />
          </app-form-field>
          <app-form-field label="Mô tả" [error]="errors()['description'] ?? ''">
            <input
              class="input"
              name="description"
              maxlength="300"
              [value]="description()"
              (input)="description.set($any($event.target).value); clear('description')"
            />
          </app-form-field>
          <!-- Haihs: truyền chữ nút Lưu cho nút cố định dưới Bảng đáp án - start -->
          <!-- đóng code cũ -->
          <!-- <app-questions-editor [(questions)]="questions" [errors]="errors()" /> -->
          <app-questions-editor
            [(questions)]="questions"
            [errors]="errors()"
            [saveLabel]="isNew ? 'Lưu đề mẫu' : 'Lưu thay đổi'"
            [saving]="busy()"
            (createSitting)="createSitting()"
          />
          <!-- Haihs: truyền chữ nút Lưu cho nút cố định dưới Bảng đáp án - end -->
        </form>
      }
    </div>
  `,
})
export class TemplateEditor implements OnDestroy {
  private readonly api = inject(TemplatesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService); // Haihs: popup xác nhận lưu đề và tạo ca thi - start - end
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly isNew = !this.id;
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly questions = signal<EditorQuestion[]>([]);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly loading = signal(!this.isNew);
  protected readonly loadError = signal('');
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  private sub?: Subscription;
  // Haihs: nút Tạo ca thi từ đề: nhận biết đề chưa lưu, hỏi xác nhận rồi lưu và chuyển sang trang tạo ca thi - start
  private readonly saved = signal('');
  private snapshot = (): string =>
    JSON.stringify([this.title(), this.description(), this.questions()]);

  protected async createSitting(): Promise<void> {
    if (this.busy()) return;
    const toSittings = (id: string): void =>
      void this.router.navigate(['/teacher/sittings/new'], { queryParams: { templateId: id } });
    if (this.id && this.snapshot() === this.saved()) return toSittings(this.id); // đã lưu: chuyển luôn
    const ok = await this.confirm.confirm(
      this.id
        ? 'Đề mẫu có thay đổi chưa lưu. Lưu đề mẫu và tạo ca thi?'
        : 'Đề mẫu chưa được lưu. Lưu đề mẫu và tạo ca thi?',
      { title: 'Lưu đề và tạo ca thi', confirmText: 'Lưu và tạo ca thi', cancelText: 'Hủy' },
    );
    if (!ok) return;
    const errs = validateTemplateForm({
      title: this.title(),
      description: this.description(),
      questions: this.questions(),
    });
    this.errors.set(errs);
    const first = Object.values(errs)[0];
    if (first) return void this.alert.error(first);
    const body: TemplateBody = {
      title: this.title().trim(),
      description: this.description().trim(),
      questions: this.questions().map(toPayloadQuestion) as unknown as TemplateBody['questions'],
    };
    this.busy.set(true);
    const op = this.id ? this.api.update(this.id, body) : this.api.create(body);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (t) => {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        this.saved.set(this.snapshot());
        toSittings(t.id);
      },
      error: (err: unknown) => {
        if (isTitleTaken(err)) {
          this.errors.update((m) => ({ ...m, title: 'Tên đề mẫu đã tồn tại. Vui lòng chọn tên khác!' }));
          void this.alert.error('Tên đề mẫu đã tồn tại. Vui lòng chọn tên khác!');
        } else void this.alert.error(describeTemplateError(err, 'Không lưu được đề mẫu.'));
      },
    });
  }
  // Haihs: nút Tạo ca thi từ đề: nhận biết đề chưa lưu, hỏi xác nhận rồi lưu và chuyển sang trang tạo ca thi - end

  protected readonly dirty = computed(() => this.questions().length > 0 || this.title() !== '');

  constructor() {
    if (this.isNew) {
      const draft = readDraft();
      if (draft) {
        this.title.set(String(draft.title ?? ''));
        this.description.set(String(draft.description ?? ''));
        this.questions.set(ensureUniqueIds(draft.questions));
      } else this.questions.set([createMcqQuestion(1)]);
    } else this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected load(): void {
    if (!this.id) return;
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api.get(this.id).subscribe({
      next: (t) => {
        this.title.set(t.title);
        this.description.set(t.description);
        this.questions.set(ensureUniqueIds(t.questions as unknown as Record<string, unknown>[]));
        this.saved.set(this.snapshot()); // Haihs: mốc để biết đề có thay đổi chưa lưu - start - end
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.notFound.set((e as { code?: string }).code === 'NOT_FOUND');
        this.loadError.set(describeTemplateError(e, 'Không tải được đề mẫu.'));
        this.loading.set(false);
      },
    });
  }

  protected clear(key: string): void {
    if (this.errors()[key])
      this.errors.update((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== key)));
  }

  protected save(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const errs = validateTemplateForm({
      title: this.title(),
      description: this.description(),
      questions: this.questions(),
    });
    this.errors.set(errs);
    const first = Object.values(errs)[0];
    if (first) return void this.alert.error(first);
    const body: TemplateBody = {
      title: this.title().trim(),
      description: this.description().trim(),
      questions: this.questions().map(toPayloadQuestion) as unknown as TemplateBody['questions'],
    };
    this.busy.set(true);
    const op = this.id ? this.api.update(this.id, body) : this.api.create(body);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        // the success popup must be dismissed (OK) before leaving, like the source
        void this.alert
          .success('Đã lưu đề mẫu.')
          .then(() => void this.router.navigate(['/teacher/templates']));
      },
      error: (err: unknown) => {
        if (isTitleTaken(err)) {
          this.errors.update((m) => ({
            ...m,
            title: 'Tên đề mẫu đã tồn tại. Vui lòng chọn tên khác!',
          }));
          void this.alert.error('Tên đề mẫu đã tồn tại. Vui lòng chọn tên khác!');
        } else void this.alert.error(describeTemplateError(err, 'Không lưu được đề mẫu.'));
      },
    });
  }
}
