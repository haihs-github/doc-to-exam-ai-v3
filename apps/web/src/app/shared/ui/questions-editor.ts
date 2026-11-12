// Created by Haihs on 12/11/2026
// <app-questions-editor>: edit the questions of a template (mcq and essay with rubric). Port of QuestionsEditor/QuestionCard/EssayQuestionEditor.
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import {
  EditorQuestion,
  OptionKey,
  RubricItem,
  computeScoringPreview,
  convertQuestionType,
  createEssayQuestion,
  createMcqQuestion,
  essayScoreError,
  isEssay,
  maxAllowedForQuestion,
  nextRubricKey,
  questionErrorsOf,
  redistributeCriteria,
  remainingScore,
  sumRubric,
} from '../utils/exam-questions';
import { FormattedText } from './formatted-text';

const OPTS: OptionKey[] = ['A', 'B', 'C', 'D'];
const AREA = 'input min-h-[72px] w-full';

@Component({
  selector: 'app-questions-editor',
  imports: [FormattedText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4" aria-label="Danh sách câu hỏi">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Câu hỏi ({{ questions().length }})
        </h2>
        <p class="text-base text-gray-700 dark:text-gray-300" role="status">
          Thang điểm: trắc nghiệm {{ scoring().mcqMax }} · tự luận {{ scoring().essayMax }}
          @if (scoring().essayMax > 0) {
            · {{ remaining().label }}
          }
        </p>
      </div>
      @if (errors()['_scoring']) {
        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
          {{ errors()['_scoring'] }}
        </p>
      }
      @if (errors()['questions']) {
        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
          {{ errors()['questions'] }}
        </p>
      }

      <fieldset [disabled]="readOnly()" class="space-y-4">
        @for (q of questions(); track q.id; let i = $index) {
          @let qe = errorsOf(q.id);
          <article
            class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            [attr.aria-label]="'Câu ' + (i + 1)"
          >
            <header class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-bold">
                Câu {{ i + 1 }} · {{ isEssay(q) ? 'Tự luận' : 'Trắc nghiệm' }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="i === 0"
                  (click)="move(i, -1)"
                  [attr.aria-label]="'Đưa câu ' + (i + 1) + ' lên'"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="i === questions().length - 1"
                  (click)="move(i, 1)"
                  [attr.aria-label]="'Đưa câu ' + (i + 1) + ' xuống'"
                >
                  ↓
                </button>
                <button type="button" class="btn-secondary" (click)="switchType(q)">
                  Đổi sang {{ isEssay(q) ? 'trắc nghiệm' : 'tự luận' }}
                </button>
                <button
                  type="button"
                  class="btn-danger"
                  (click)="remove(q.id)"
                  [attr.aria-label]="'Xóa câu ' + (i + 1)"
                >
                  Xóa
                </button>
              </div>
            </header>

            @if (q.needsReview) {
              <div
                role="note"
                class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              >
                {{ q.reviewReason || 'Cần xác nhận loại câu hỏi.' }}
                <button
                  type="button"
                  class="ml-2 font-semibold underline"
                  (click)="patch(q.id, { needsReview: false, reviewReason: '' })"
                >
                  Xác nhận
                </button>
              </div>
              @if (qe['review']) {
                <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                  {{ qe['review'] }}
                </p>
              }
            }

            <label class="block text-base font-medium"
              >Chỉ dẫn / bài đọc (dùng chung nhóm câu)
              <textarea
                [class]="area"
                [value]="q.context"
                (input)="text(q.id, 'context', $event)"
              ></textarea>
            </label>
            <label class="block text-base font-medium"
              >{{ isEssay(q) ? 'Đề bài' : 'Nội dung câu hỏi' }}
              <textarea
                [class]="area"
                [value]="q.questionText"
                (input)="text(q.id, 'questionText', $event)"
              ></textarea>
            </label>
            @if (qe['text']) {
              <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                {{ qe['text'] }}
              </p>
            }

            @if (isEssay(q)) {
              <label class="block text-base font-medium"
                >Yêu cầu
                <textarea
                  [class]="area"
                  [value]="q.requirements ?? ''"
                  (input)="text(q.id, 'requirements', $event)"
                ></textarea>
              </label>
              <div class="space-y-2">
                <label class="block text-base font-medium"
                  >Điểm của câu (bội số của 0,25)
                  <input
                    type="text"
                    inputmode="decimal"
                    class="input w-32"
                    [value]="q.maxScore ?? ''"
                    (input)="setScore(i, $event)"
                  />
                </label>
                @if (scoreError(i); as se) {
                  <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ se }}
                  </p>
                }
                @if (qe['score']) {
                  <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ qe['score'] }}
                  </p>
                }
                <h4 class="font-semibold">Tiêu chí chấm (tổng {{ sum(q) }})</h4>
                @for (c of q.rubric ?? []; track c.key; let ci = $index) {
                  <div class="flex flex-wrap items-center gap-2">
                    <input
                      class="input flex-1"
                      [value]="c.label"
                      (input)="setCriterion(q, ci, 'label', $event)"
                      [attr.aria-label]="'Tên tiêu chí ' + (ci + 1)"
                    />
                    <input
                      type="text"
                      inputmode="decimal"
                      class="input w-24"
                      [value]="c.max"
                      (input)="setCriterion(q, ci, 'max', $event)"
                      [attr.aria-label]="'Điểm tiêu chí ' + (ci + 1)"
                    />
                    <button
                      type="button"
                      class="btn-secondary"
                      (click)="removeCriterion(q, ci)"
                      [attr.aria-label]="'Xóa tiêu chí ' + (ci + 1)"
                    >
                      Xóa
                    </button>
                  </div>
                  @if (qe['criteria:' + ci + ':label']) {
                    <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                      {{ qe['criteria:' + ci + ':label'] }}
                    </p>
                  }
                  @if (qe['criteria:' + ci + ':max']) {
                    <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                      {{ qe['criteria:' + ci + ':max'] }}
                    </p>
                  }
                }
                @if (qe['criteria']) {
                  <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ qe['criteria'] }}
                  </p>
                }
                <button type="button" class="btn-secondary" (click)="addCriterion(q)">
                  Thêm tiêu chí
                </button>
              </div>
            } @else {
              <div
                class="space-y-2"
                role="radiogroup"
                [attr.aria-label]="'Đáp án đúng của câu ' + (i + 1)"
              >
                @for (k of opts; track k) {
                  <div class="flex items-center gap-2">
                    <input
                      type="radio"
                      [name]="'correct-' + q.id"
                      [checked]="q.correctAnswer === k"
                      (change)="patch(q.id, { correctAnswer: k })"
                      [attr.aria-label]="'Chọn ' + k + ' là đáp án đúng'"
                    />
                    <span class="w-5 font-bold">{{ k }}</span>
                    <input
                      class="input flex-1"
                      [value]="q.options[k]"
                      (input)="setOption(q.id, k, $event)"
                      [attr.aria-label]="'Phương án ' + k + ' của câu ' + (i + 1)"
                    />
                  </div>
                }
                @if (qe['options']) {
                  <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ qe['options'] }}
                  </p>
                }
                @if (qe['correct']) {
                  <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                    {{ qe['correct'] }}
                  </p>
                }
              </div>
            }
            <label class="block text-base font-medium"
              >Giải thích
              <textarea
                [class]="area"
                [value]="q.explanation"
                (input)="text(q.id, 'explanation', $event)"
              ></textarea>
            </label>
            <details class="text-sm text-gray-600 dark:text-gray-400">
              <summary class="cursor-pointer">Xem trước</summary>
              <div class="mt-2 space-y-1">
                <p><app-formatted-text [text]="q.context" /></p>
                <p><app-formatted-text [text]="q.questionText" /></p>
                @if (!isEssay(q)) {
                  @for (k of opts; track k) {
                    <p>{{ k }}. <app-formatted-text [text]="q.options[k]" /></p>
                  }
                }
              </div>
            </details>
          </article>
        }
      </fieldset>

      @if (!readOnly()) {
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secondary" (click)="addMcq()">
            Thêm câu trắc nghiệm
          </button>
          <button type="button" class="btn-secondary" (click)="addEssay()">Thêm câu tự luận</button>
        </div>
      }
    </section>
  `,
})
export class QuestionsEditor {
  /** Two-way: the parent owns the list. */
  readonly questions = model.required<EditorQuestion[]>();
  readonly errors = input<Record<string, string>>({});
  readonly readOnly = input(false);
  protected readonly opts = OPTS;
  protected readonly area = AREA;
  protected readonly isEssay = isEssay;
  protected readonly scoring = computed(() => computeScoringPreview(this.questions()));
  protected readonly remaining = computed(() =>
    remainingScore({
      essayMax: this.scoring().essayMax,
      hasMcq: this.questions().some((q) => !isEssay(q)),
    }),
  );

  protected errorsOf(id: number): Record<string, string> {
    return questionErrorsOf(this.errors(), id);
  }
  protected sum = (q: EditorQuestion): number => sumRubric(q.rubric);

  private nextId(): number {
    return this.questions().reduce((m, q) => Math.max(m, q.id), 0) + 1; // ids are never reused or renumbered
  }
  private update(fn: (list: EditorQuestion[]) => EditorQuestion[]): void {
    this.questions.set(fn(this.questions()));
  }
  protected patch(id: number, p: Partial<EditorQuestion>): void {
    this.update((l) => l.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }
  protected text(
    id: number,
    field: 'context' | 'questionText' | 'explanation' | 'requirements',
    e: Event,
  ): void {
    this.patch(id, { [field]: (e.target as HTMLTextAreaElement).value });
  }
  protected setOption(id: number, k: OptionKey, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.update((l) =>
      l.map((q) => (q.id === id ? { ...q, options: { ...q.options, [k]: value } } : q)),
    );
  }
  protected addMcq(): void {
    this.update((l) => [...l, createMcqQuestion(this.nextId(), l.at(-1)?.context ?? '')]);
  }
  protected addEssay(): void {
    this.update((l) => [...l, createEssayQuestion(this.nextId())]);
  }
  protected remove(id: number): void {
    this.update((l) => l.filter((q) => q.id !== id));
  }
  protected move(i: number, d: number): void {
    this.update((l) => {
      const next = [...l];
      const j = i + d;
      if (j < 0 || j >= next.length) return l;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  protected switchType(q: EditorQuestion): void {
    const next = convertQuestionType(q, isEssay(q) ? 'mcq' : 'essay');
    this.update((l) => l.map((x) => (x.id === q.id ? next : x)));
  }

  protected scoreError(i: number): string {
    const q = this.questions()[i];
    const hasMcq = this.questions().some((x) => !isEssay(x));
    return essayScoreError(q.maxScore, {
      limit: maxAllowedForQuestion({ questions: this.questions(), index: i }),
      strict: hasMcq,
    });
  }
  /** Changing the question points re-splits the criteria so their sum stays equal to it. */
  protected setScore(i: number, e: Event): void {
    const raw = (e.target as HTMLInputElement).value.replace(',', '.');
    const q = this.questions()[i];
    const r = redistributeCriteria(q.rubric, raw);
    this.patch(q.id, { maxScore: raw, ...(r.error ? {} : { rubric: r.criteria }) });
  }
  protected setCriterion(q: EditorQuestion, ci: number, field: 'label' | 'max', e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const rubric = (q.rubric ?? []).map((c, idx) =>
      idx === ci ? { ...c, [field]: field === 'max' ? raw.replace(',', '.') : raw } : c,
    ) as RubricItem[];
    this.patch(q.id, { rubric, ...(field === 'max' ? { maxScore: sumRubric(rubric) } : {}) });
  }
  protected addCriterion(q: EditorQuestion): void {
    const rubric = [...(q.rubric ?? []), { key: nextRubricKey(q.rubric), label: '', max: 0.25 }];
    this.patch(q.id, { rubric, maxScore: sumRubric(rubric) });
  }
  protected removeCriterion(q: EditorQuestion, ci: number): void {
    const rubric = (q.rubric ?? []).filter((_, idx) => idx !== ci);
    this.patch(q.id, { rubric, maxScore: sumRubric(rubric) });
  }
}
