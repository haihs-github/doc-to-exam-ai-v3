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
  imports: [RouterLink, FormField, QuestionsEditor, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <a
        routerLink="/teacher/templates"
        class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400"
        >← Đề mẫu</a
      >
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (loadError()) {
        <div role="alert" class="text-base text-red-700 dark:text-red-400">
          {{ loadError() }}
          @if (!notFound()) {
            <button type="button" class="ml-2 font-semibold underline" (click)="load()">
              Thử lại
            </button>
          }
        </div>
      } @else {
        <form (submit)="save($event)" novalidate class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {{ isNew ? 'Tạo đề mẫu' : 'Sửa đề mẫu' }}
            </h1>
            <button type="submit" class="btn-primary" [disabled]="busy()">
              {{ isNew ? 'Lưu đề mẫu' : 'Lưu thay đổi' }}
            </button>
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
          <app-questions-editor [(questions)]="questions" [errors]="errors()" />
        </form>
      }
    </div>
  `,
})
export class TemplateEditor implements OnDestroy {
  private readonly api = inject(TemplatesApi);
  private readonly alert = inject(AlertService);
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
